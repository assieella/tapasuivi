const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireAdminAuth } = require('../middleware/auth');
const { parseColleBRVM } = require('../services/brvmParser');
const { calculerPositions, calculerMontantNetInvesti } = require('../services/portefeuille');
const { verifierEtExecuterOrdresEnAttente } = require('./portefeuilleVirtuel');
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

  // Email immédiat de notification — jamais bloquant : si l'envoi échoue ou traîne, le message
  // reste bien enregistré dans la messagerie (le client le verra en se connectant), et on ne
  // fait pas attendre la page admin pour autant.
  pool.query('SELECT email, prenom, full_name FROM users WHERE id = $1', [id]).then(async (r) => {
    const client = r.rows[0];
    if (!client) return;
    const { sendMail } = require('../services/email');
    try {
      await sendMail({
        to: client.email,
        subject: 'Nouveau message de votre conseillère — TAPA CONSEIL',
        html: `
          <div style="font-family: Georgia, serif; max-width:600px; margin:auto; color:#1C2733; line-height:1.6;">
            <p>Bonjour ${client.prenom || client.full_name},</p>
            <p>Vous avez reçu un nouveau message de votre conseillère TAPA CONSEIL :</p>
            <div style="background:#F5F7FA; border-radius:8px; padding:16px; margin:16px 0;">${contenu.trim()}</div>
            <p><a href="${process.env.APP_URL || ''}/messages.html" style="background:#0F2F59; color:white; padding:10px 20px; text-decoration:none; border-radius:6px; display:inline-block;">Voir et répondre</a></p>
          </div>
        `
      });
    } catch (e) { console.error('Échec de l\'email de notification de message :', e.message); }
  }).catch(() => {});

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

    // Un nouveau cours peut déclencher l'exécution d'ordres virtuels à cours limité en attente.
    try { await verifierEtExecuterOrdresEnAttente(r.ticker, Number(r.cours)); } catch (e) { console.error('Erreur vérification ordres virtuels en attente :', e.message); }

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

  // Le message est déjà bien enregistré dans sa messagerie à ce stade (le client le verra) —
  // si l'envoi de l'email échoue ou met trop de temps, on ne bloque jamais la page pour autant,
  // on le signale simplement dans la réponse.
  let emailEnvoye = true;
  try {
    await sendMail({
      to: a.email,
      subject: `Votre analyse de portefeuille — ${new Date(a.mois).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
      html: `<div style="font-family: Georgia, serif; max-width:600px; margin:auto; color:#1C2733; line-height:1.6;">${a.contenu}</div>`
    });
  } catch (e) {
    console.error('Échec de l\'envoi de l\'email d\'analyse de portefeuille :', e.message);
    emailEnvoye = false;
  }

  await pool.query('UPDATE analyses_portefeuille SET valide = true, envoyee = true WHERE id = $1', [req.params.id]);

  res.json({ ok: true, email_envoye: emailEnvoye });
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

// Génère une analyse pédagogique du portefeuille À LA DEMANDE (pas besoin d'attendre le 1er du mois) —
// utilise exactement la même logique que la génération mensuelle automatique. Le brouillon atterrit
// dans la même file d'attente que /admin-portefeuilles.html, pour relecture avant envoi au client.
router.post('/clients/:id/analyse-portefeuille', requireAdminAuth, async (req, res) => {
  const clientId = req.params.id;
  const { montant_disponible } = req.body || {};
  const { genererAnalysePortefeuille } = require('../services/analysePortefeuille');
  const moisCourant = new Date().toISOString().slice(0, 8) + '01';

  const clientResult = await pool.query('SELECT id, full_name, prenom FROM users WHERE id = $1', [clientId]);
  if (!clientResult.rows.length) return res.status(404).json({ error: 'Client introuvable.' });
  const client = clientResult.rows[0];

  const transactions = await pool.query('SELECT * FROM portefeuille_transactions WHERE user_id = $1', [clientId]);
  if (!transactions.rows.length) return res.status(400).json({ error: "Ce client n'a encore saisi aucune transaction." });

  const coursResult = await pool.query('SELECT DISTINCT ON (ticker) ticker, cours, variation_pct FROM cours_quotidiens ORDER BY ticker, date_cours DESC');
  const coursParTicker = Object.fromEntries(coursResult.rows.map(r => [r.ticker, r]));
  const positions = calculerPositions(transactions.rows, coursParTicker);
  const valeurTotale = positions.reduce((s, p) => s + (p.valeur_actuelle || 0), 0);
  const montantNetInvesti = calculerMontantNetInvesti(transactions.rows);

  const secteursResult = await pool.query('SELECT ticker, secteur, nom FROM titres_brvm');
  const secteursParTicker = Object.fromEntries(secteursResult.rows.map(r => [r.ticker, r.secteur]));
  // Catalogue complet (ticker, nom, secteur, cours réel, variation du jour) — pour proposer des pistes
  // de diversification et d'opportunités de marché chiffrées et réelles, jamais inventées.
  const catalogueTitres = secteursResult.rows
    .filter(t => coursParTicker[t.ticker])
    .map(t => ({ ticker: t.ticker, nom: t.nom, secteur: t.secteur, cours: coursParTicker[t.ticker].cours, variation_pct: coursParTicker[t.ticker].variation_pct }));

  const planResult = await pool.query('SELECT strategie, objectif_montant, horizon_mois, versement_mensuel, created_at FROM investment_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [clientId]);
  const plan = planResult.rows[0] || {};

  const paragraphes = genererAnalysePortefeuille({
    prenom: client.prenom, full_name: client.full_name,
    positions, valeurTotale, montantNetInvesti,
    strategie: plan.strategie, objectifMontant: plan.objectif_montant,
    secteursParTicker, horizonMois: plan.horizon_mois, versementMensuel: plan.versement_mensuel, planCreeLe: plan.created_at,
    montantDisponible: montant_disponible ? Number(montant_disponible) : null, catalogueTitres
  });
  const contenuHtml = paragraphes.map(p => `<p>${p}</p>`).join('');

  const result = await pool.query(
    `INSERT INTO analyses_portefeuille (user_id, mois, contenu, valide, envoyee)
     VALUES ($1, $2, $3, false, false)
     ON CONFLICT (user_id, mois) DO UPDATE SET contenu = $3, valide = false, envoyee = false
     RETURNING *`,
    [clientId, moisCourant, contenuHtml]
  );
  res.json({ analyse: result.rows[0] });
});

// --- Données financières fondamentales (base du futur Score TAPA INVEST) ---

router.get('/titres/:ticker/donnees-financieres', requireAdminAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM donnees_financieres WHERE ticker = $1 ORDER BY annee DESC',
    [req.params.ticker.toUpperCase()]
  );
  res.json({ donnees: result.rows });
});

router.post('/titres/:ticker/donnees-financieres', requireAdminAuth, async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const { annee, chiffre_affaires, benefice_net, capitaux_propres, dettes_totales } = req.body;
  if (!annee) return res.status(400).json({ error: 'L\'année est obligatoire.' });

  const titreExiste = await pool.query('SELECT 1 FROM titres_brvm WHERE ticker = $1', [ticker]);
  if (!titreExiste.rows.length) return res.status(404).json({ error: 'Titre introuvable.' });

  const result = await pool.query(
    `INSERT INTO donnees_financieres (ticker, annee, chiffre_affaires, benefice_net, capitaux_propres, dettes_totales, valide, saisi_par)
     VALUES ($1, $2, $3, $4, $5, $6, true, $7)
     ON CONFLICT (ticker, annee) DO UPDATE SET
       chiffre_affaires = $3, benefice_net = $4, capitaux_propres = $5, dettes_totales = $6, valide = true, saisi_par = $7, updated_at = NOW()
     RETURNING *`,
    [ticker, annee, chiffre_affaires || null, benefice_net || null, capitaux_propres || null, dettes_totales || null, req.user.email]
  );
  res.json({ donnee: result.rows[0] });
});

// Validation rapide d'une donnée financière saisie par un compte "saisie" — sans la ressaisir.
router.post('/donnees-financieres/:id/valider', requireAdminAuth, async (req, res) => {
  await pool.query('UPDATE donnees_financieres SET valide = true WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- Journal de suivi par client (visible par l'admin ET le client) ---

router.get('/clients/:id/journal', requireAdminAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM journal_suivi WHERE client_id = $1 ORDER BY date_action DESC, created_at DESC',
    [req.params.id]
  );
  res.json({ entrees: result.rows });
});

router.post('/clients/:id/journal', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { date_action, titre, description, statut } = req.body;
  if (!titre || !titre.trim()) return res.status(400).json({ error: 'Le titre de la tâche est obligatoire.' });

  const result = await pool.query(
    `INSERT INTO journal_suivi (client_id, date_action, titre, description, statut, cree_par)
     VALUES ($1, COALESCE($2, CURRENT_DATE), $3, $4, COALESCE($5, 'termine'), $6) RETURNING *`,
    [id, date_action || null, titre.trim(), (description || '').trim() || null, statut || null, req.user.email]
  );
  res.json({ entree: result.rows[0] });
});

router.delete('/journal/:entreeId', requireAdminAuth, async (req, res) => {
  await pool.query('DELETE FROM journal_suivi WHERE id = $1', [req.params.entreeId]);
  res.json({ ok: true });
});

// --- Actualités du marché (agent de veille BRVM) ---

router.post('/actualites/generer', requireAdminAuth, async (req, res) => {
  try {
    const { genererActualiteMarche } = require('../services/actualiteIA');
    const { contenu } = await genererActualiteMarche();
    const result = await pool.query(
      `INSERT INTO actualites_marche (titre, contenu, valide) VALUES ($1, $2, false) RETURNING *`,
      [`Actualités BRVM — ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`, contenu]
    );
    res.json({ actualite: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message || "Erreur lors de la génération." }); }
});

router.get('/actualites', requireAdminAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM actualites_marche ORDER BY created_at DESC LIMIT 30');
  res.json({ actualites: result.rows });
});

router.put('/actualites/:id', requireAdminAuth, async (req, res) => {
  const { titre, contenu } = req.body;
  const result = await pool.query(
    'UPDATE actualites_marche SET titre = $1, contenu = $2 WHERE id = $3 RETURNING *',
    [titre, contenu, req.params.id]
  );
  res.json({ actualite: result.rows[0] });
});

router.post('/actualites/:id/valider', requireAdminAuth, async (req, res) => {
  const result = await pool.query(
    'UPDATE actualites_marche SET valide = true, publiee_le = NOW() WHERE id = $1 RETURNING *',
    [req.params.id]
  );
  res.json({ actualite: result.rows[0] });
});

router.delete('/actualites/:id', requireAdminAuth, async (req, res) => {
  await pool.query('DELETE FROM actualites_marche WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- Fonds OPCVM/FCP ---

router.get('/fonds-opcvm', requireAdminAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM fonds_opcvm ORDER BY nom ASC');
  res.json({ fonds: result.rows });
});

router.post('/fonds-opcvm', requireAdminAuth, async (req, res) => {
  const { nom, societe_gestion, categorie } = req.body;
  if (!nom || !nom.trim()) return res.status(400).json({ error: 'Le nom du fonds est obligatoire.' });
  const result = await pool.query(
    'INSERT INTO fonds_opcvm (nom, societe_gestion, categorie) VALUES ($1, $2, $3) RETURNING *',
    [nom.trim(), societe_gestion || null, categorie || null]
  );
  res.json({ fonds: result.rows[0] });
});

router.get('/fonds-opcvm/:id/vl', requireAdminAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM vl_historique WHERE fonds_id = $1 ORDER BY date_vl DESC', [req.params.id]);
  res.json({ historique: result.rows });
});

router.post('/fonds-opcvm/:id/vl', requireAdminAuth, async (req, res) => {
  const { date_vl, valeur_liquidative, perf_ytd, perf_1an, perf_3ans } = req.body;
  if (!date_vl) return res.status(400).json({ error: 'La date est obligatoire.' });
  const result = await pool.query(
    `INSERT INTO vl_historique (fonds_id, date_vl, valeur_liquidative, perf_ytd, perf_1an, perf_3ans)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (fonds_id, date_vl) DO UPDATE SET
       valeur_liquidative = $3, perf_ytd = $4, perf_1an = $5, perf_3ans = $6
     RETURNING *`,
    [req.params.id, date_vl, valeur_liquidative || null, perf_ytd || null, perf_1an || null, perf_3ans || null]
  );
  res.json({ vl: result.rows[0] });
});

// Collage en masse : reconnaît automatiquement les fonds déjà créés dans le texte collé
// (ex: depuis richbourse.com), sans jamais créer un nouveau fonds tout seul.
router.post('/fonds-opcvm/coller', requireAdminAuth, async (req, res) => {
  const { texte } = req.body;
  if (!texte) return res.status(400).json({ error: 'Aucun texte fourni.' });

  const { parseCollageOPCVM } = require('../services/opcvmParser');
  const fondsExistants = (await pool.query('SELECT id, nom FROM fonds_opcvm')).rows;
  const { resultats, nonTrouves } = parseCollageOPCVM(texte, fondsExistants);

  let miseAJour = 0;
  for (const r of resultats) {
    if (!r.date_vl) continue; // sans date, impossible d'enregistrer une ligne d'historique valide
    await pool.query(
      `INSERT INTO vl_historique (fonds_id, date_vl, valeur_liquidative, perf_ytd, perf_1an, perf_3ans)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (fonds_id, date_vl) DO UPDATE SET
         valeur_liquidative = $3, perf_ytd = $4, perf_1an = $5, perf_3ans = $6`,
      [r.fonds_id, r.date_vl, r.valeur_liquidative, r.perf_ytd, r.perf_1an, r.perf_3ans]
    );
    miseAJour++;
  }

  res.json({ mise_a_jour: miseAJour, non_trouves: nonTrouves });
});

router.delete('/fonds-opcvm/:id', requireAdminAuth, async (req, res) => {
  await pool.query('DELETE FROM fonds_opcvm WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- Réservations formation présentiel ---

router.get('/reservations-presentiel', requireAdminAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM reservations_presentiel ORDER BY created_at DESC');
  res.json({ reservations: result.rows });
});

router.post('/reservations-presentiel/:id/contactee', requireAdminAuth, async (req, res) => {
  const result = await pool.query('UPDATE reservations_presentiel SET contactee = true WHERE id = $1 RETURNING *', [req.params.id]);
  res.json({ reservation: result.rows[0] });
});

// --- Leads du TEST TAPA ---

router.get('/test-tapa', requireAdminAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM test_tapa_reponses ORDER BY created_at DESC');
  res.json({ reponses: result.rows });
});

router.post('/test-tapa/:id/contacte', requireAdminAuth, async (req, res) => {
  const result = await pool.query('UPDATE test_tapa_reponses SET contacte = true WHERE id = $1 RETURNING *', [req.params.id]);
  res.json({ reponse: result.rows[0] });
});

module.exports = router;
