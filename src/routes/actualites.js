const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireProgrammeActif } = require('../middleware/programmeActif');
const router = express.Router();

// Uniquement les actualités validées par TAPA CONSEIL — jamais un brouillon en attente.
router.get('/', requireAuth, requireProgrammeActif, async (req, res) => {
  const result = await pool.query(
    'SELECT id, titre, contenu, publiee_le FROM actualites_marche WHERE valide = true ORDER BY publiee_le DESC LIMIT 20'
  );
  res.json({ actualites: result.rows });
});

module.exports = router;
