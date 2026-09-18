const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireProgrammeActif } = require('../middleware/programmeActif');
const router = express.Router();

router.get('/documents', requireAuth, requireProgrammeActif, async (req, res) => {
  const result = await pool.query('SELECT * FROM ressources_documents ORDER BY ordre ASC, created_at DESC');
  res.json({ ressources: result.rows });
});

router.get('/annuaire', requireAuth, requireProgrammeActif, async (req, res) => {
  const result = await pool.query('SELECT * FROM annuaire_sgi ORDER BY ordre ASC, nom ASC');
  res.json({ annuaire: result.rows });
});

module.exports = router;
