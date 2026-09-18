const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireProgrammeActif, requireCompteNonGratuit } = require('../middleware/programmeActif');
const router = express.Router();

router.get('/', requireAuth, requireProgrammeActif, requireCompteNonGratuit, async (req, res) => {
  const result = await pool.query('SELECT id, sender, contenu, created_at FROM messages WHERE client_id = $1 ORDER BY created_at ASC', [req.user.id]);
  await pool.query(`UPDATE messages SET lu_par_client = true WHERE client_id = $1 AND sender != 'client' AND lu_par_client = false`, [req.user.id]);
  res.json({ messages: result.rows });
});

router.post('/', requireAuth, requireProgrammeActif, requireCompteNonGratuit, async (req, res) => {
  const { contenu } = req.body;
  if (!contenu || !contenu.trim()) return res.status(400).json({ error: 'Message vide.' });
  const result = await pool.query(`INSERT INTO messages (client_id, sender, contenu, lu_par_admin) VALUES ($1, 'client', $2, false) RETURNING *`, [req.user.id, contenu.trim()]);
  res.json({ message: result.rows[0] });
});

router.get('/non-lus', requireAuth, requireProgrammeActif, async (req, res) => {
  // Le compteur reste accessible (renvoie toujours 0 pour un compte gratuit, sans erreur) —
  // pour ne pas casser l'affichage du tableau de bord qui l'appelle systématiquement.
  const userResult = await pool.query('SELECT programme FROM users WHERE id = $1', [req.user.id]);
  if (userResult.rows[0]?.programme === 'gratuit') return res.json({ non_lus: 0 });
  const result = await pool.query(`SELECT COUNT(*) FROM messages WHERE client_id = $1 AND sender != 'client' AND lu_par_client = false`, [req.user.id]);
  res.json({ non_lus: Number(result.rows[0].count) });
});

module.exports = router;
