const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireProgrammeActif } = require('../middleware/programmeActif');
const { calculerPositions, calculerMontantNetInvesti } = require('../services/portefeuille');

const router = express.Router();

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
  const { ticker, type, date_transaction, quantite, prix_unitaire } = req.body;
  if (!ticker || !['achat', 'vente'].includes(type) || !date_transaction || !quantite || prix_unitaire === undefined) {
    return res.status(400).json({ error: 'Titre, type, date, quantité et prix sont requis.' });
  }
  const titreExiste = await pool.query('SELECT 1 FROM titres_brvm WHERE ticker = $1', [ticker.toUpperCase()]);
  if (!titreExiste.rows.length) return res.status(400).json({ error: 'Titre inconnu.' });

  if (type === 'vente') {
    const transactions = await pool.query('SELECT * FROM portefeuille_transactions WHERE user_id = $1', [req.user.id]);
    const positions = calculerPositions(transactions.rows, {});
    const position = positions.find(p => p.ticker === ticker.toUpperCase());
    if (!position || position.quantite_detenue < Number(quantite)) {
      return res.status(400).json({ error: "Vous ne détenez pas assez de ce titre pour cette vente." });
    }
  }

  const result = await pool.query(
    `INSERT INTO portefeuille_transactions (user_id, ticker, type, date_transaction, quantite, prix_unitaire) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.id, ticker.toUpperCase(), type, date_transaction, quantite, prix_unitaire]
  );
  res.json({ transaction: result.rows[0] });
});

router.delete('/transactions/:id', requireAuth, requireProgrammeActif, async (req, res) => {
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
