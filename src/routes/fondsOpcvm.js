const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireProgrammeActif } = require('../middleware/programmeActif');
const router = express.Router();

router.get('/', requireAuth, requireProgrammeActif, async (req, res) => {
  const result = await pool.query(`
    SELECT f.id, f.nom, f.societe_gestion, f.categorie,
           v.date_vl, v.valeur_liquidative, v.perf_ytd, v.perf_1an, v.perf_3ans
    FROM fonds_opcvm f
    LEFT JOIN LATERAL (
      SELECT * FROM vl_historique WHERE fonds_id = f.id ORDER BY date_vl DESC LIMIT 1
    ) v ON true
    ORDER BY f.nom ASC
  `);
  res.json({ fonds: result.rows });
});

router.get('/:id', requireAuth, requireProgrammeActif, async (req, res) => {
  const fonds = await pool.query('SELECT * FROM fonds_opcvm WHERE id = $1', [req.params.id]);
  if (!fonds.rows.length) return res.status(404).json({ error: 'Fonds introuvable.' });
  const historique = await pool.query('SELECT * FROM vl_historique WHERE fonds_id = $1 ORDER BY date_vl ASC', [req.params.id]);
  res.json({ fonds: fonds.rows[0], historique: historique.rows });
});

module.exports = router;
