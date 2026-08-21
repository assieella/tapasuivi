const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireProgrammeActif } = require('../middleware/programmeActif');
const router = express.Router();

router.get('/', requireAuth, requireProgrammeActif, async (req, res) => {
  const result = await pool.query(`
    SELECT t.ticker, t.nom, t.secteur, t.pays, t.fiche_complete, c.cours, c.variation_pct, c.date_cours
    FROM titres_brvm t
    LEFT JOIN LATERAL (SELECT cours, variation_pct, date_cours FROM cours_quotidiens cq WHERE cq.ticker = t.ticker ORDER BY date_cours DESC LIMIT 1) c ON true
    ORDER BY t.ticker ASC
  `);
  res.json({ titres: result.rows });
});

router.get('/:ticker', requireAuth, requireProgrammeActif, async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const titre = await pool.query('SELECT * FROM titres_brvm WHERE ticker = $1', [ticker]);
  if (!titre.rows.length) return res.status(404).json({ error: 'Titre introuvable.' });
  const historique = await pool.query('SELECT date_cours, cours, variation_pct FROM cours_quotidiens WHERE ticker = $1 ORDER BY date_cours DESC LIMIT 30', [ticker]);
  const dividendes = await pool.query('SELECT annee, montant_par_action FROM dividendes_historique WHERE ticker = $1 ORDER BY annee DESC', [ticker]);
  const etudes = await pool.query('SELECT id, titre, contenu, date_publication FROM etudes_titres WHERE ticker = $1 ORDER BY date_publication DESC LIMIT 10', [ticker]);
  let performance_pct = null;
  if (historique.rows.length >= 2) {
    const plusRecent = Number(historique.rows[0].cours);
    const plusAncien = Number(historique.rows[historique.rows.length - 1].cours);
    if (plusAncien > 0) performance_pct = Math.round(((plusRecent - plusAncien) / plusAncien) * 10000) / 100;
  }
  res.json({ titre: titre.rows[0], historique: historique.rows, dividendes: dividendes.rows, etudes: etudes.rows, performance_pct });
});

module.exports = router;
