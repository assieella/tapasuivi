const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireProgrammeActif } = require('../middleware/programmeActif');
const { calculerPositions, calculerMontantNetInvesti } = require('../services/portefeuille');

const router = express.Router();


// Vérifie le prix saisi par rapport au dernier cours connu AVANT d'enregistrer : l'erreur la plus
// fréquente est de saisir le montant total de l'opération à la place du prix d'une action
// (ex. 77 939 FCFA au lieu de 7 794 FCFA). Un écart de plus de 50 % déclenche une question —
// jamais un blocage : le client peut confirmer si le prix est bien celui de son ordre.
async function verifierPrixSaisi(tickerMaj, prix_unitaire, quantite) {
  const dernier = await pool.query('SELECT cours FROM cours_quotidiens WHERE ticker = $1 ORDER BY date_cours DESC LIMIT 1', [tickerMaj]);
  const cours = dernier.rows[0] ? Number(dernier.rows[0].cours) : null;
  const prix = Number(prix_unitaire);
  const qte = Number(quantite);
  if (!(cours && cours > 0 && prix > 0 && Math.abs(prix - cours) / cours > 0.5)) return null;
  const fmt = n => Number(n).toLocaleString('fr-FR');
  const messages = [`Le prix saisi (<strong>${fmt(prix)} FCFA</strong>) est très éloigné du dernier cours connu de <strong>${tickerMaj}</strong> (<strong>${fmt(cours)} FCFA</strong>).`];
  let prixSuggere = null;
  if (qte > 1) {
    const parAction = prix / qte;
    if (Math.abs(parAction - cours) / cours <= 0.5) {
      prixSuggere = Math.round(parAction);
      messages.push(`Avez-vous saisi le <strong>montant total</strong> de l'opération ? Pour ${fmt(qte)} actions, cela ferait <strong>${fmt(prixSuggere)} FCFA</strong> l'action.`);
    }
  }
  return { alerte_prix: true, messages, prix_suggere: prixSuggere };
}

// Vérifie qu'un historique reste cohérent : à aucun moment on ne vend plus de titres qu'on n'en détient
// (achats avant ventes à date égale). Sert à la modification et à la suppression d'une transaction.
function historiqueCoherent(transactions) {
  const tri = [...transactions].sort((a, b) => {
    const da = new Date(a.date_transaction).getTime(), db = new Date(b.date_transaction).getTime();
    if (da !== db) return da - db;
    if (a.type !== b.type) return a.type === 'achat' ? -1 : 1;
    return (a.id || 0) - (b.id || 0);
  });
  const qte = {};
  for (const t of tri) {
    qte[t.ticker] = (qte[t.ticker] || 0) + (t.type === 'achat' ? 1 : -1) * Number(t.quantite);
    if (qte[t.ticker] < -1e-9) return { ok: false, ticker: t.ticker };
  }
  return { ok: true };
}

async function chargerDerniersCoursParTicker() {
  const result = await pool.query(`
    SELECT DISTINCT ON (ticker) ticker, cours FROM cours_quotidiens ORDER BY ticker, date_cours DESC
  `);
  return Object.fromEntries(result.rows.map(r => [r.ticker, r]));
}

router.get('/', requireAuth, requireProgrammeActif, async (req, res) => {
  const transactions = await pool.query('SELECT * FROM portefeuille_transactions WHERE user_id = $1 ORDER BY date_transaction ASC', [req.user.id]);
  const coursParTicker = await chargerDerniersCoursParTicker();
  const positions = calculerPositions(transactions.rows, coursParTicker);
  const montantNetInvesti = calculerMontantNetInvesti(transactions.rows);
  const valeurTotale = positions.reduce((s, p) => s + (p.valeur_actuelle || 0), 0);
  res.json({ positions, montant_net_investi: montantNetInvesti, valeur_totale: valeurTotale });
});

router.get('/transactions', requireAuth, requireProgrammeActif, async (req, res) => {
  const result = await pool.query('SELECT * FROM portefeuille_transactions WHERE user_id = $1 ORDER BY date_transaction DESC', [req.user.id]);
  res.json({ transactions: result.rows });
});

router.post('/transactions', requireAuth, requireProgrammeActif, async (req, res) => {
  const { ticker, type, date_transaction, quantite, prix_unitaire, confirmer_malgre_alerte, confirmer_prix } = req.body;
  if (!ticker || !['achat', 'vente'].includes(type) || !date_transaction || !quantite || prix_unitaire === undefined) {
    return res.status(400).json({ error: 'Titre, type, date, quantité et prix sont requis.' });
  }
  const tickerMaj = ticker.toUpperCase();
  const titreExiste = await pool.query('SELECT 1 FROM titres_brvm WHERE ticker = $1', [tickerMaj]);
  if (!titreExiste.rows.length) return res.status(400).json({ error: 'Titre inconnu.' });

  if (!confirmer_prix) {
    const alerte = await verifierPrixSaisi(tickerMaj, prix_unitaire, quantite);
    if (alerte) return res.status(409).json(alerte);
  }

  const transactions = await pool.query('SELECT * FROM portefeuille_transactions WHERE user_id = $1', [req.user.id]);

  if (type === 'vente') {
    const positionsActuelles = calculerPositions(transactions.rows, {});
    const position = positionsActuelles.find(p => p.ticker === tickerMaj);
    if (!position || position.quantite_detenue < Number(quantite)) {
      return res.status(400).json({ error: "Vous ne détenez pas assez de ce titre pour cette vente." });
    }
  }

  // Vérifie la concentration qu'entraînerait cette opération AVANT de l'enregistrer — pas
  // seulement détectée après coup dans une analyse mensuelle. N'empêche jamais la décision
  // finale du client, mais l'avertit clairement s'il ne confirme pas malgré l'alerte.
  if (type === 'achat' && !confirmer_malgre_alerte) {
    const { verifierConcentration } = require('../services/analysePortefeuille');
    const coursResult = await pool.query('SELECT DISTINCT ON (ticker) ticker, cours FROM cours_quotidiens ORDER BY ticker, date_cours DESC');
    const coursParTicker = Object.fromEntries(coursResult.rows.map(r => [r.ticker, r]));
    const secteursResult = await pool.query('SELECT ticker, secteur FROM titres_brvm');
    const secteursParTicker = Object.fromEntries(secteursResult.rows.map(r => [r.ticker, r.secteur]));

    const transactionsSimulees = [...transactions.rows, { ticker: tickerMaj, type, quantite: Number(quantite), prix_unitaire: Number(prix_unitaire) }];
    const positionsSimulees = calculerPositions(transactionsSimulees, coursParTicker);
    const alertes = verifierConcentration(positionsSimulees, secteursParTicker);

    if (alertes.length) {
      return res.status(409).json({ alerte_concentration: true, messages: alertes });
    }
  }

  const result = await pool.query(
    `INSERT INTO portefeuille_transactions (user_id, ticker, type, date_transaction, quantite, prix_unitaire) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.id, tickerMaj, type, date_transaction, quantite, prix_unitaire]
  );
  res.json({ transaction: result.rows[0] });
});

router.put('/transactions/:id', requireAuth, requireProgrammeActif, async (req, res) => {
  const { ticker, type, date_transaction, quantite, prix_unitaire, confirmer_prix } = req.body;
  if (!ticker || !['achat', 'vente'].includes(type) || !date_transaction || !(Number(quantite) > 0) || prix_unitaire === undefined || Number(prix_unitaire) < 0) {
    return res.status(400).json({ error: 'Titre, type, date, quantité et prix sont requis.' });
  }
  const tickerMaj = String(ticker).toUpperCase();
  const titreExiste = await pool.query('SELECT 1 FROM titres_brvm WHERE ticker = $1', [tickerMaj]);
  if (!titreExiste.rows.length) return res.status(400).json({ error: 'Titre inconnu.' });

  const toutes = await pool.query('SELECT * FROM portefeuille_transactions WHERE user_id = $1', [req.user.id]);
  const existe = toutes.rows.find(t => String(t.id) === String(req.params.id));
  if (!existe) return res.status(404).json({ error: 'Transaction introuvable.' });

  if (!confirmer_prix) {
    const alerte = await verifierPrixSaisi(tickerMaj, prix_unitaire, quantite);
    if (alerte) return res.status(409).json(alerte);
  }

  const apres = toutes.rows.map(t => String(t.id) === String(req.params.id)
    ? { ...t, ticker: tickerMaj, type, date_transaction, quantite: Number(quantite), prix_unitaire: Number(prix_unitaire) }
    : t);
  const coherence = historiqueCoherent(apres);
  if (!coherence.ok) {
    return res.status(400).json({ error: `Cette modification rendrait votre historique incohérent : vous vendriez plus de ${coherence.ticker} que vous n'en détenez à cette date. Corrigez d'abord l'achat ou la vente concernée.` });
  }

  const result = await pool.query(
    `UPDATE portefeuille_transactions SET ticker=$1, type=$2, date_transaction=$3, quantite=$4, prix_unitaire=$5 WHERE id=$6 AND user_id=$7 RETURNING *`,
    [tickerMaj, type, date_transaction, quantite, prix_unitaire, req.params.id, req.user.id]
  );
  res.json({ transaction: result.rows[0] });
});

router.delete('/transactions/:id', requireAuth, requireProgrammeActif, async (req, res) => {
  const toutes = await pool.query('SELECT * FROM portefeuille_transactions WHERE user_id = $1', [req.user.id]);
  const reste = toutes.rows.filter(t => String(t.id) !== String(req.params.id));
  const coherence = historiqueCoherent(reste);
  if (!coherence.ok) {
    return res.status(400).json({ error: `Impossible de retirer cette transaction : une vente de ${coherence.ticker} en dépend. Retirez ou modifiez d'abord la vente.` });
  }
  await pool.query('DELETE FROM portefeuille_transactions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// Évolution mensuelle : valeur du portefeuille et montant net investi, mois par mois,
// depuis la première transaction jusqu'à aujourd'hui.
router.get('/evolution', requireAuth, requireProgrammeActif, async (req, res) => {
  const transactions = await pool.query('SELECT * FROM portefeuille_transactions WHERE user_id = $1 ORDER BY date_transaction ASC', [req.user.id]);
  if (!transactions.rows.length) return res.json({ evolution: [] });

  const coursHistorique = await pool.query(`
    SELECT ticker, date_cours, cours FROM cours_quotidiens
    WHERE ticker = ANY($1) ORDER BY date_cours ASC
  `, [[...new Set(transactions.rows.map(t => t.ticker))]]);

  const premiereDate = new Date(transactions.rows[0].date_transaction);
  const maintenant = new Date();
  const points = [];
  let curseur = new Date(premiereDate.getFullYear(), premiereDate.getMonth(), 1);

  while (curseur <= maintenant) {
    const finDeMois = new Date(curseur.getFullYear(), curseur.getMonth() + 1, 0, 23, 59, 59);
    const transactionsJusquIci = transactions.rows.filter(t => new Date(t.date_transaction) <= finDeMois);
    const montantNetInvesti = calculerMontantNetInvesti(transactionsJusquIci);

    // Cours le plus récent connu, pour chaque titre, à cette date
    const coursAlaDate = {};
    for (const c of coursHistorique.rows) {
      if (new Date(c.date_cours) <= finDeMois) coursAlaDate[c.ticker] = c;
    }
    const positions = calculerPositions(transactionsJusquIci, coursAlaDate);
    const valeurTotale = positions.reduce((s, p) => s + (p.valeur_actuelle || 0), 0);

    points.push({ mois: curseur.toISOString().slice(0, 7), valeur_totale: valeurTotale, montant_net_investi: montantNetInvesti });
    curseur = new Date(curseur.getFullYear(), curseur.getMonth() + 1, 1);
  }

  res.json({ evolution: points });
});

// Analyses mensuelles déjà validées et envoyées (le client ne voit jamais un brouillon)
router.get('/analyses', requireAuth, requireProgrammeActif, async (req, res) => {
  const result = await pool.query(
    'SELECT mois, contenu, created_at FROM analyses_portefeuille WHERE user_id = $1 AND envoyee = true ORDER BY mois DESC',
    [req.user.id]
  );
  res.json({ analyses: result.rows });
});

module.exports = router;
