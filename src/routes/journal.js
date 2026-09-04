const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireProgrammeActif } = require('../middleware/programmeActif');
const router = express.Router();

// Lecture seule pour le client — il voit son propre journal, mais ne peut rien y ajouter
// ni modifier. C'est TAPA CONSEIL qui tient ce journal à jour.
router.get('/', requireAuth, requireProgrammeActif, async (req, res) => {
  const result = await pool.query(
    'SELECT date_action, titre, description, statut FROM journal_suivi WHERE client_id = $1 ORDER BY date_action DESC, created_at DESC',
    [req.user.id]
  );
  res.json({ entrees: result.rows });
});

module.exports = router;
