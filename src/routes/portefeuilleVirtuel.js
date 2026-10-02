const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireProgrammeActif } = require('../middleware/programmeActif');
const { calculerPositions } = require('../services/portefeuille');
const router = express.Router();

const CAPITAL_DEPART = 1000000; // FCFA fictifs, pour démarrer
const TAUX_FRAIS = 0.01; // 1% de frais de courtage simulés, sur achat comme sur vente

// Crée le solde de départ au premier accès, s'il n'existe pas encore.
async function obtenirOuCreerSolde(userId) {
  const result = await pool.query('SELECT solde_fictif FROM portefeuille_virtuel_solde WHERE user_id = $1', [userId]);
  if (result.rows.length) return Number(result.rows[0].solde_fictif);
  await pool.query('INSERT INTO portefeuille_virtuel_solde (user_id, solde_fictif) VALUES ($1, $2)', [userId, CAPITAL_DEPART]);
  return CAPITAL_DEPART;
}

// Exécute réellement un ordre (débite/crédite le solde) — utilisé à la fois pour un ordre
// "au marché" (immédiat) et pour un ordre "à cours limité" une fois sa condition remplie.
async function executerOrdre(userId, ordre, prixExecution) {
  const montantBrut = ordre.quantite * prixExecution;
  const frais = Math.round(montantBrut * TAUX_FRAIS);

  if (ordre.type === 'achat') {
    const coutTotal = montantBrut + frais;
    const solde = await obtenirOuCreerSolde(userId);
    if (coutTotal > solde) return { succes: false, raison: 'solde insuffisant au moment de l\'exécution' };
    await pool.query('UPDATE portefeuille_virtuel_solde SET solde_fictif = solde_fictif - $1 WHERE user_id = $2', [coutTotal, userId]);
  } else {
    const quantiteDetenue = await calculerQuantiteDetenue(userId, ordre.ticker);
    if (ordre.quantite > quantiteDetenue) return { succes: false, raison: 'quantité insuffisante au moment de l\'exécution' };
    const montantNet = montantBrut - frais;
    await pool.query('UPDATE portefeuille_virtuel_solde SET solde_fictif = solde_fictif + $1 WHERE user_id = $2', [montantNet, userId]);
  }

  await pool.query(
    `UPDATE portefeuille_virtuel_ordres SET prix_execution = $1, frais = $2, statut = 'execute' WHERE id = $3`,
    [prixExecution, frais, ordre.id]
  );
  return { succes: true };
}

async function calculerQuantiteDetenue(userId, ticker) {
  const ordresExecutes = (await pool.query(
    `SELECT type, quantite FROM portefeuille_virtuel_ordres WHERE user_id = $1 AND ticker = $2 AND statut = 'execute'`,
    [userId, ticker]
  )).rows;
  return ordresExecutes.reduce((s, o) => s + (o.type === 'achat' ? o.quantite : -o.quantite), 0);
}

// Appelée depuis l'admin juste après l'enregistrement des cours du jour d'un titre —
// vérifie si des ordres à cours limité, pour ce titre, peuvent maintenant s'exécuter.
async function verifierEtExecuterOrdresEnAttente(ticker, nouveauCours) {
  const ordresEnAttente = (await pool.query(
    `SELECT * FROM portefeuille_virtuel_ordres WHERE ticker = $1 AND statut = 'en_attente'`,
    [ticker]
  )).rows;

  for (const ordre of ordresEnAttente) {
    const prixLimite = Number(ordre.prix_limite);
    const conditionRemplie = ordre.type === 'achat' ? nouveauCours <= prixLimite : nouveauCours >= prixLimite;
    if (!conditionRemplie) continue;

    const resultat = await executerOrdre(ordre.user_id, ordre, nouveauCours);
    if (!resultat.succes) {
      await pool.query(`UPDATE portefeuille_virtuel_ordres SET statut = 'annule' WHERE id = $1`, [ordre.id]);
    }
  }
}

router.get('/', requireAuth, requireProgrammeActif, async (req, res) => {
  const solde = await obtenirOuCreerSolde(req.user.id);
  const tousLesOrdres = (await pool.query('SELECT * FROM portefeuille_virtuel_ordres WHERE user_id = $1 ORDER BY date_ordre ASC', [req.user.id])).rows;
  const ordresExecutes = tousLesOrdres.filter(o => o.statut === 'execute');

  const coursResult = await pool.query('SELECT DISTINCT ON (ticker) ticker, cours FROM cours_quotidiens ORDER BY ticker, date_cours DESC');
  const coursParTicker = Object.fromEntries(coursResult.rows.map(r => [r.ticker, r]));

  // On réutilise exactement la même logique de calcul de positions que le vrai portefeuille —
  // seuls les ordres réellement exécutés comptent, jamais ceux encore en attente.
  const transactionsFormatees = ordresExecutes.map(o => ({ ticker: o.ticker, type: o.type, quantite: o.quantite, prix_unitaire: o.prix_execution }));
  const positions = calculerPositions(transactionsFormatees, coursParTicker);
  const valeurPositions = positions.reduce((s, p) => s + (p.valeur_actuelle || 0), 0);

  res.json({
    solde_fictif: Math.round(solde),
    positions,
    valeur_totale: Math.round(solde + valeurPositions),
    ordres: [...tousLesOrdres].reverse() // les plus récents en premier pour l'affichage
  });
});

router.post('/ordre', requireAuth, requireProgrammeActif, async (req, res) => {
  const { ticker, type, quantite, type_ordre, prix_limite } = req.body;
  if (!ticker || !['achat', 'vente'].includes(type) || !quantite || quantite <= 0) {
    return res.status(400).json({ error: 'Titre, type (achat/vente) et quantité valides sont obligatoires.' });
  }
  const typeOrdre = type_ordre === 'limite' ? 'limite' : 'marche';

  const coursResult = await pool.query('SELECT cours FROM cours_quotidiens WHERE ticker = $1 ORDER BY date_cours DESC LIMIT 1', [ticker]);
  if (!coursResult.rows.length) return res.status(400).json({ error: 'Aucun cours connu pour ce titre — impossible de passer l\'ordre.' });
  const coursActuel = Number(coursResult.rows[0].cours);

  if (typeOrdre === 'limite') {
    if (!prix_limite || prix_limite <= 0) return res.status(400).json({ error: 'Le prix limite est obligatoire pour un ordre à cours limité.' });
    if (type === 'vente') {
      const quantiteDetenue = await calculerQuantiteDetenue(req.user.id, ticker);
      if (quantite > quantiteDetenue) {
        return res.status(400).json({ error: `Vous ne détenez que ${quantiteDetenue} action(s) fictive(s) de ${ticker} — impossible d'en vendre ${quantite}.` });
      }
    }
    const result = await pool.query(
      `INSERT INTO portefeuille_virtuel_ordres (user_id, ticker, type, quantite, type_ordre, prix_limite, statut)
       VALUES ($1, $2, $3, $4, 'limite', $5, 'en_attente') RETURNING *`,
      [req.user.id, ticker, type, quantite, prix_limite]
    );
    return res.json({ ordre: result.rows[0] });
  }

  // Ordre au marché — exécution immédiate au dernier cours connu.
  const solde = await obtenirOuCreerSolde(req.user.id);
  const montantBrut = quantite * coursActuel;
  const frais = Math.round(montantBrut * TAUX_FRAIS);

  if (type === 'achat') {
    const coutTotal = montantBrut + frais;
    if (coutTotal > solde) {
      return res.status(400).json({ error: `Solde fictif insuffisant. Cet achat coûterait ${Math.round(coutTotal).toLocaleString('fr-FR')} FCFA (frais inclus), mais il ne vous reste que ${Math.round(solde).toLocaleString('fr-FR')} FCFA fictifs.` });
    }
    await pool.query('UPDATE portefeuille_virtuel_solde SET solde_fictif = solde_fictif - $1 WHERE user_id = $2', [coutTotal, req.user.id]);
  } else {
    const quantiteDetenue = await calculerQuantiteDetenue(req.user.id, ticker);
    if (quantite > quantiteDetenue) {
      return res.status(400).json({ error: `Vous ne détenez que ${quantiteDetenue} action(s) fictive(s) de ${ticker} — impossible d'en vendre ${quantite}.` });
    }
    const montantNet = montantBrut - frais;
    await pool.query('UPDATE portefeuille_virtuel_solde SET solde_fictif = solde_fictif + $1 WHERE user_id = $2', [montantNet, req.user.id]);
  }

  const result = await pool.query(
    `INSERT INTO portefeuille_virtuel_ordres (user_id, ticker, type, quantite, prix_execution, frais, type_ordre, statut)
     VALUES ($1, $2, $3, $4, $5, $6, 'marche', 'execute') RETURNING *`,
    [req.user.id, ticker, type, quantite, coursActuel, frais]
  );
  res.json({ ordre: result.rows[0] });
});

router.post('/ordre/:id/annuler', requireAuth, requireProgrammeActif, async (req, res) => {
  await pool.query(
    `UPDATE portefeuille_virtuel_ordres SET statut = 'annule' WHERE id = $1 AND user_id = $2 AND statut = 'en_attente'`,
    [req.params.id, req.user.id]
  );
  res.json({ ok: true });
});

router.post('/reinitialiser', requireAuth, requireProgrammeActif, async (req, res) => {
  await pool.query('DELETE FROM portefeuille_virtuel_ordres WHERE user_id = $1', [req.user.id]);
  await pool.query('UPDATE portefeuille_virtuel_solde SET solde_fictif = $1 WHERE user_id = $2', [CAPITAL_DEPART, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
module.exports.verifierEtExecuterOrdresEnAttente = verifierEtExecuterOrdresEnAttente;
