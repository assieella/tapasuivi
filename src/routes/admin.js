const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireAdminAuth } = require('../middleware/auth');
const { parseColleBRVM } = require('../services/brvmParser');
const { calculerPositions, calculerMontantNetInvesti } = require('../services/portefeuille');
const router = express.Router();

// Génère un mot de passe à 6 chiffres, facile à transmettre par WhatsApp/email,
// tout en restant nettement plus sûr qu'un code à 4 chiffres (1 000 000 de combinaisons),
// combiné à l'email du client lors de la connexion.
function genererMotDePasse() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Crée le compte d'un client après règlement du programme. Le mot de passe est généré
// automatiquement et renvoyé UNE SEULE FOIS dans la réponse (jamais stocké en clair).
router.post('/clients', requireAdminAuth, async (req, res) => {
  const { nom, prenom, email, phone, programme } = req.body;
  if (!nom || !prenom || !email) return res.status(400).json({ error: 'Nom, prénom et email sont requis.' });

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });

  const password = genererMotDePasse();
  const password_hash = await bcrypt.hash(password, 10);
  const full_name = `${prenom} ${nom}`.trim();

  const result = await pool.query(
    `INSERT INTO users (email, password_hash, nom, prenom, full_name, phone, programme, role)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'client') RETURNING id, email, full_name, programme, created_at`,
    [email.toLowerCase(), password_hash, nom, prenom, full_name, phone || null, programme || '4_mois']
  );

  res.json({ client: result.rows[0], mot_de_passe_genere: password });
});

router.get('/clients', requireAdminAuth, async (req, res) => {
  const result = await pool.query(`
    SELECT
      u.id, u.full_name, u.email, u.phone, u.programme, u.created_at,
      p.profile_type, p.score, p.profession, p.revenu_mensuel, p.capital_disponible,
      p.situation_familiale, p.nombre_enfants, p.created_at AS profile_date,
      (SELECT COUNT(*) FROM messages m WHERE m.client_id = u.id AND m.sender = 'client' AND m.lu_par_admin = false) AS messages_non_lus,
      pl.objectif_montant, pl.horizon_mois, pl.versement_mensuel,
      pl.objectif_realiste, pl.montant_projete, pl.strategie, pl.created_at AS plan_date
    FROM users u
    LEFT JOIN LATERAL (SELECT * FROM investor_profiles ip WHERE ip.user_id = u.id ORDER BY created_at DESC LIMIT 1) p ON true
    LEFT JOIN LATERAL (SELECT * FROM investment_plans ipl WHERE ipl.user_id = u.id ORDER BY created_at DESC LIMIT 1) pl ON true
    WHERE u.role = 'client'
    ORDER BY u.created_at DESC
  `);
  res.json({ clients: result.rows });
});

router.get('/clients/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const user = await pool.query('SELECT id, full_name, email, phone, programme, created_at FROM users WHERE id = $1', [id]);
  if (!user.rows.length) return res.status(404).json({ error: 'Client introuvable.' });
  const profiles = await pool.query('SELECT * FROM investor_profiles WHERE user_id = $1 ORDER BY created_at DESC', [id]);
  const plans = await pool.query('SELECT * FROM investment_plans WHERE user_id = $1 ORDER BY created_at DESC', [id]);
  const portfolios = await pool.query('SELECT * FROM portfolio_snapshots WHERE user_id = $1 ORDER BY mois DESC', [id]);
  res.json({ client: user.rows[0], profiles: profiles.rows, plans: plans.rows, portfolios: portfolios.rows });
});

router.get('/clients/:id/messages', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query('SELECT id, sender, contenu, created_at FROM messages WHERE client_id = $1 ORDER BY created_at ASC', [id]);
  await pool.query(`UPDATE messages SET lu_par_admin = true WHERE client_id = $1 AND sender = 'client' AND lu_par_admin = false`, [id]);
  res.json({ messages: result.rows });
});

router.post('/clients/:id/messages', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { contenu } = req.body;
  if (!contenu || !contenu.trim()) return res.status(400).json({ error: 'Message vide.' });
  const result = await pool.query(`INSERT INTO messages (client_id, sender, contenu, lu_par_client) VALUES ($1, 'conseiller', $2, false) RETURNING *`, [id, contenu.trim()]);
  res.json({ message: result.rows[0] });
});

router.get('/clients/:id/notes', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const result = await pool.query('SELECT contenu, updated_at FROM notes_internes WHERE client_id = $1', [id]);
  res.json({ note: result.rows[0] || { contenu: '', updated_at: null } });
});

router.put('/clients/:id/notes', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { contenu } = req.body;
  const result = await pool.query(
    `INSERT INTO notes_internes (client_id, contenu, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (client_id) DO UPDATE SET contenu = $2, updated_at = NOW() RETURNING *`,
    [id, contenu || '']
  );
  res.json({ note: result.rows[0] });
});

// --- Gestion des titres BRVM ---

router.post('/cours/coller', requireAdminAuth, async (req, res) => {
  const { texte, date_cours } = req.body;
  if (!texte) return res.status(400).json({ error: 'Aucun texte fourni.' });
  const { resultats, indices, erreurs } = parseColleBRVM(texte);
  const date = date_cours || new Date().toISOString().slice(0, 10);
  let inseres = 0;
  let fichesCompletees = 0;
  let ignores = [];
  for (const r of resultats) {
    const titreExistant = await pool.query('SELECT nom FROM titres_brvm WHERE ticker = $1', [r.ticker]);
    if (!titreExistant.rows.length) { ignores.push(r.ticker); continue; }

    await pool.query(
      `INSERT INTO cours_quotidiens (ticker, date_cours, cours, variation_pct, volume) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (ticker, date_cours) DO UPDATE SET cours = $3, variation_pct = $4, volume = $5`,
      [r.ticker, date, r.cours, r.variation_pct, r.volume || null]
    );
    inseres++;

    // Complète automatiquement le nom (et le pays si reconnu) tant que la fiche
    // n'a pas encore été validée manuellement — ne touche jamais à une fiche déjà confirmée.
    if (r.nom && (!titreExistant.rows[0].nom || titreExistant.rows[0].nom === 'À vérifier')) {
      await pool.query(
        'UPDATE titres_brvm SET nom = $1, pays = COALESCE(pays, $2), updated_at = NOW() WHERE ticker = $3',
        [r.nom, r.pays, r.ticker]
      );
      fichesCompletees++;
    }
  }

  for (const idx of (indices || [])) {
    await pool.query(
      `INSERT INTO indices_quotidiens (indice, date_indice, valeur) VALUES ($1, $2, $3) ON CONFLICT (indice, date_indice) DO UPDATE SET valeur = $3`,
      [idx.indice, date, idx.valeur]
    );
  }

  res.json({ inseres, fiches_completees: fichesCompletees, indices_enregistres: (indices || []).length, lignes_non_reconnues: erreurs, tickers_inconnus: ignores, total_lignes_detectees: resultats.length });
});

router.put('/titres/:ticker', requireAdminAuth, async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const { nom, secteur, pays, description, date_introduction } = req.body;
  const result = await pool.query(
    `UPDATE titres_brvm SET nom = $1, secteur = $2, pays = $3, description = $4, date_introduction = $5, fiche_complete = true, updated_at = NOW() WHERE ticker = $6 RETURNING *`,
    [nom, secteur, pays, description || null, date_introduction || null, ticker]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Titre introuvable.' });
  res.json({ titre: result.rows[0] });
});

router.post('/titres/:ticker/dividendes', requireAdminAuth, async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const { annee, montant_par_action } = req.body;
  if (!annee || montant_par_action === undefined) return res.status(400).json({ error: "Année et montant par action requis." });
  const result = await pool.query(
    `INSERT INTO dividendes_historique (ticker, annee, montant_par_action) VALUES ($1, $2, $3) ON CONFLICT (ticker, annee) DO UPDATE SET montant_par_action = $3 RETURNING *`,
    [ticker, annee, montant_par_action]
  );
  res.json({ dividende: result.rows[0] });
});

router.post('/titres/:ticker/etudes/generer', requireAdminAuth, async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  try {
    const titreResult = await pool.query('SELECT * FROM titres_brvm WHERE ticker = $1', [ticker]);
    if (!titreResult.rows.length) return res.status(404).json({ error: 'Titre introuvable.' });

    const historique = await pool.query(
      'SELECT cours, date_cours, volume FROM cours_quotidiens WHERE ticker = $1 ORDER BY date_cours DESC LIMIT 90',
      [ticker]
    );
    const dividendes = await pool.query(
      'SELECT annee, montant_par_action FROM dividendes_historique WHERE ticker = $1 ORDER BY annee DESC',
      [ticker]
    );

    const { genererEtudeIA } = require('../services/etudeIA');
    const resultat = await genererEtudeIA({
      titre: titreResult.rows[0],
      historiqueCours: historique.rows,
      dividendes: dividendes.rows
    });

    res.json({
      titre_suggere: `${titreResult.rows[0].nom} — étude ${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
      contenu: resultat.contenu,
      plus_bas: resultat.plus_bas,
      plus_haut: resultat.plus_haut
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Erreur lors de la génération.' });
  }
});

router.post('/titres/:ticker/etudes', requireAdminAuth, async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const { titre, contenu, date_publication } = req.body;
  if (!titre || !contenu) return res.status(400).json({ error: 'Titre et contenu requis.' });
  const result = await pool.query(
    `INSERT INTO etudes_titres (ticker, titre, contenu, date_publication) VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE)) RETURNING *`,
    [ticker, titre, contenu, date_publication || null]
  );
  res.json({ etude: result.rows[0] });
});

// --- Formation ---

router.get('/formation/modules', requireAdminAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM modules_formation ORDER BY ordre ASC');
  res.json({ modules: result.rows });
});

router.post('/formation/modules', requireAdminAuth, async (req, res) => {
  const { ordre, titre, description, questions, seuil_reussite } = req.body;
  if (!ordre || !titre) return res.status(400).json({ error: 'Ordre et titre sont requis.' });
  const result = await pool.query(
    `INSERT INTO modules_formation (ordre, titre, description, questions, seuil_reussite) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [ordre, titre, description || null, JSON.stringify(questions || []), seuil_reussite || 60]
  );
  res.json({ module: result.rows[0] });
});

router.put('/formation/modules/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { ordre, titre, description, questions, seuil_reussite, actif } = req.body;
  const result = await pool.query(
    `UPDATE modules_formation SET ordre = $1, titre = $2, description = $3, questions = $4, seuil_reussite = $5, actif = $6 WHERE id = $7 RETURNING *`,
    [ordre, titre, description || null, JSON.stringify(questions || []), seuil_reussite || 60, actif !== false, id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Module introuvable.' });
  res.json({ module: result.rows[0] });
});

router.delete('/formation/modules/:id', requireAdminAuth, async (req, res) => {
  await pool.query('UPDATE modules_formation SET actif = false WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- Leçons (vidéos) d'un module ---

router.get('/formation/modules/:id/lecons', requireAdminAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM lecons_formation WHERE module_id = $1 ORDER BY ordre ASC', [req.params.id]);
  res.json({ lecons: result.rows });
});

router.post('/formation/modules/:id/lecons', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { ordre, titre, type, youtube_id, contenu_texte } = req.body;
  const typeLecon = type === 'texte' ? 'texte' : 'video';
  if (!titre) return res.status(400).json({ error: 'Titre requis.' });
  if (typeLecon === 'video' && !youtube_id) return res.status(400).json({ error: 'Identifiant YouTube requis pour une leçon vidéo.' });
  if (typeLecon === 'texte' && !contenu_texte) return res.status(400).json({ error: 'Contenu texte requis pour une leçon texte.' });
  const result = await pool.query(
    `INSERT INTO lecons_formation (module_id, ordre, titre, type, youtube_id, contenu_texte) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id, ordre || 1, titre, typeLecon, typeLecon === 'video' ? youtube_id : null, typeLecon === 'texte' ? contenu_texte : null]
  );
  res.json({ lecon: result.rows[0] });
});

router.delete('/formation/lecons/:id', requireAdminAuth, async (req, res) => {
  await pool.query('DELETE FROM lecons_formation WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

router.get('/formation/progression', requireAdminAuth, async (req, res) => {
  const result = await pool.query(`
    SELECT u.id AS user_id, u.full_name, u.email,
      COUNT(p.id) FILTER (WHERE p.reussi) AS modules_reussis,
      (SELECT COUNT(*) FROM modules_formation WHERE actif = true) AS total_modules
    FROM users u LEFT JOIN progression_formation p ON p.user_id = u.id
    WHERE u.role = 'client' GROUP BY u.id, u.full_name, u.email ORDER BY u.full_name ASC
  `);
  res.json({ progression: result.rows });
});

// --- Vidéos gratuites (lead magnet avec compte) ---

router.get('/videos-gratuites', requireAdminAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM videos_gratuites ORDER BY ordre ASC');
  res.json({ videos: result.rows });
});

router.post('/videos-gratuites', requireAdminAuth, async (req, res) => {
  const { ordre, titre, description, youtube_id } = req.body;
  if (!titre || !youtube_id) return res.status(400).json({ error: 'Titre et identifiant YouTube requis.' });
  const result = await pool.query(`INSERT INTO videos_gratuites (ordre, titre, description, youtube_id) VALUES ($1, $2, $3, $4) RETURNING *`, [ordre || 1, titre, description || null, youtube_id]);
  res.json({ video: result.rows[0] });
});

router.delete('/videos-gratuites/:id', requireAdminAuth, async (req, res) => {
  await pool.query('UPDATE videos_gratuites SET actif = false WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- Prospects (comptes gratuits avec mot de passe) ---

router.get('/prospects', requireAdminAuth, async (req, res) => {
  const result = await pool.query(`SELECT id, full_name, email, phone, created_at FROM users WHERE role = 'prospect' ORDER BY created_at DESC`);
  res.json({ prospects: result.rows });
});

// --- Leads Découverte BRVM (capture légère, sans compte) ---

router.get('/leads-decouverte', requireAdminAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM leads_decouverte ORDER BY created_at DESC');
  res.json({ leads: result.rows });
});

// --- Appels collectifs mensuels ---

router.get('/appels-mensuels', requireAdminAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM appels_mensuels ORDER BY date_appel DESC LIMIT 20');
  res.json({ appels: result.rows });
});

router.post('/appels-mensuels', requireAdminAuth, async (req, res) => {
  const { date_appel, plateforme, lien, notes } = req.body;
  if (!date_appel) return res.status(400).json({ error: 'Date et heure requises.' });
  const result = await pool.query(
    `INSERT INTO appels_mensuels (date_appel, plateforme, lien, notes) VALUES ($1, $2, $3, $4) RETURNING *`,
    [date_appel, plateforme || null, lien || null, notes || null]
  );
  res.json({ appel: result.rows[0] });
});

router.delete('/appels-mensuels/:id', requireAdminAuth, async (req, res) => {
  await pool.query('DELETE FROM appels_mensuels WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- Analyses de portefeuille : validation avant envoi ---

router.get('/analyses-portefeuille', requireAdminAuth, async (req, res) => {
  const result = await pool.query(`
    SELECT a.*, u.full_name, u.email FROM analyses_portefeuille a
    JOIN users u ON u.id = a.user_id
    WHERE a.envoyee = false
    ORDER BY a.created_at ASC
  `);
  res.json({ analyses: result.rows });
});

router.put('/analyses-portefeuille/:id', requireAdminAuth, async (req, res) => {
  const { contenu } = req.body;
  const result = await pool.query(
    'UPDATE analyses_portefeuille SET contenu = $1 WHERE id = $2 RETURNING *',
    [contenu, req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Analyse introuvable.' });
  res.json({ analyse: result.rows[0] });
});

router.post('/analyses-portefeuille/:id/valider', requireAdminAuth, async (req, res) => {
  const { sendMail } = require('../services/email');
  const analyse = await pool.query(
    `SELECT a.*, u.full_name, u.email FROM analyses_portefeuille a JOIN users u ON u.id = a.user_id WHERE a.id = $1`,
    [req.params.id]
  );
  if (!analyse.rows.length) return res.status(404).json({ error: 'Analyse introuvable.' });
  const a = analyse.rows[0];

  await pool.query(
    `INSERT INTO messages (client_id, sender, contenu, lu_par_client) VALUES ($1, 'conseiller', $2, false)`,
    [a.user_id, a.contenu]
  );
  await sendMail({
    to: a.email,
    subject: `Votre analyse de portefeuille — ${new Date(a.mois).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
    html: `<div style="font-family: Georgia, serif; max-width:600px; margin:auto; color:#1C2733; line-height:1.6;">${a.contenu}</div>`
  });
  await pool.query('UPDATE analyses_portefeuille SET valide = true, envoyee = true WHERE id = $1', [req.params.id]);

  res.json({ ok: true });
});

// --- Blog ---

router.get('/blog', requireAdminAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM articles_blog ORDER BY created_at DESC');
  res.json({ articles: result.rows });
});

function genererSlug(titre) {
  return String(titre).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

router.post('/blog', requireAdminAuth, async (req, res) => {
  const { titre, extrait, contenu, image_url, publie, date_publication } = req.body;
  if (!titre || !contenu) return res.status(400).json({ error: 'Titre et contenu requis.' });
  let slug = genererSlug(titre);
  const existe = await pool.query('SELECT 1 FROM articles_blog WHERE slug = $1', [slug]);
  if (existe.rows.length) slug = `${slug}-${Date.now().toString().slice(-5)}`;
  const result = await pool.query(
    `INSERT INTO articles_blog (titre, slug, extrait, contenu, image_url, publie, date_publication) VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, CURRENT_DATE)) RETURNING *`,
    [titre, slug, extrait || null, contenu, image_url || null, publie === true, date_publication || null]
  );
  res.json({ article: result.rows[0] });
});

router.put('/blog/:id', requireAdminAuth, async (req, res) => {
  const { titre, extrait, contenu, image_url, publie } = req.body;
  const result = await pool.query(
    `UPDATE articles_blog SET titre = $1, extrait = $2, contenu = $3, image_url = $4, publie = $5 WHERE id = $6 RETURNING *`,
    [titre, extrait || null, contenu, image_url || null, publie === true, req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Article introuvable.' });
  res.json({ article: result.rows[0] });
});

router.delete('/blog/:id', requireAdminAuth, async (req, res) => {
  await pool.query('DELETE FROM articles_blog WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- Ressources documentaires ---

router.get('/ressources', requireAdminAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM ressources_documents ORDER BY ordre ASC, created_at DESC');
  res.json({ ressources: result.rows });
});

router.post('/ressources', requireAdminAuth, async (req, res) => {
  const { titre, description, categorie, organisme, lien_url, ordre } = req.body;
  if (!titre || !lien_url) return res.status(400).json({ error: 'Titre et lien requis.' });
  const result = await pool.query(
    `INSERT INTO ressources_documents (titre, description, categorie, organisme, lien_url, ordre) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [titre, description || null, categorie || 'Formulaire', organisme || null, lien_url, ordre || 1]
  );
  res.json({ ressource: result.rows[0] });
});

router.delete('/ressources/:id', requireAdminAuth, async (req, res) => {
  await pool.query('DELETE FROM ressources_documents WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- Annuaire SGI/SGO ---

router.get('/annuaire-sgi', requireAdminAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM annuaire_sgi ORDER BY ordre ASC, nom ASC');
  res.json({ annuaire: result.rows });
});

router.post('/annuaire-sgi', requireAdminAuth, async (req, res) => {
  const { nom, type, pays, investissement_initial_min, telephone, email, site_web, adresse, description, ordre } = req.body;
  if (!nom) return res.status(400).json({ error: 'Nom requis.' });
  const result = await pool.query(
    `INSERT INTO annuaire_sgi (nom, type, pays, investissement_initial_min, telephone, email, site_web, adresse, description, ordre)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [nom, type || 'SGI', pays || null, investissement_initial_min || null, telephone || null, email || null, site_web || null, adresse || null, description || null, ordre || 1]
  );
  res.json({ entree: result.rows[0] });
});

router.delete('/annuaire-sgi/:id', requireAdminAuth, async (req, res) => {
  await pool.query('DELETE FROM annuaire_sgi WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- Portefeuille d'un client (lecture seule, côté admin) ---

router.get('/clients/:id/portefeuille', requireAdminAuth, async (req, res) => {
  const clientId = req.params.id;
  const transactions = await pool.query(
    'SELECT * FROM portefeuille_transactions WHERE user_id = $1 ORDER BY date_transaction ASC',
    [clientId]
  );
  const coursResult = await pool.query(
    'SELECT DISTINCT ON (ticker) ticker, cours FROM cours_quotidiens ORDER BY ticker, date_cours DESC'
  );
  const coursParTicker = Object.fromEntries(coursResult.rows.map(r => [r.ticker, r]));
  const positions = calculerPositions(transactions.rows, coursParTicker);
  const montantNetInvesti = calculerMontantNetInvesti(transactions.rows);
  const valeurTotale = positions.reduce((s, p) => s + (p.valeur_actuelle || 0), 0);
  res.json({
    positions,
    montant_net_investi: montantNetInvesti,
    valeur_totale: valeurTotale,
    transactions: [...transactions.rows].reverse() // les plus récentes en premier pour l'affichage
  });
});

module.exports = router;
