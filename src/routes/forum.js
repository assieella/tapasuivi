const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireCompteGratuit } = require('../middleware/programmeActif');
const router = express.Router();

router.use(requireAuth, requireCompteGratuit);

// Liste des sujets, les épinglés en premier, puis les plus récents.
router.get('/', async (req, res) => {
  const result = await pool.query(`
    SELECT s.id, s.titre, s.contenu, s.epingle, s.created_at, u.prenom, u.full_name,
           (SELECT COUNT(*) FROM forum_reponses r WHERE r.sujet_id = s.id) AS nombre_reponses
    FROM forum_sujets s
    JOIN users u ON u.id = s.user_id
    ORDER BY s.epingle DESC, s.created_at DESC
  `);
  res.json({ sujets: result.rows });
});

router.post('/', async (req, res) => {
  const { titre, contenu } = req.body;
  if (!titre || !titre.trim() || !contenu || !contenu.trim()) {
    return res.status(400).json({ error: 'Le titre et le contenu sont obligatoires.' });
  }
  const result = await pool.query(
    'INSERT INTO forum_sujets (user_id, titre, contenu) VALUES ($1, $2, $3) RETURNING *',
    [req.user.id, titre.trim(), contenu.trim()]
  );
  res.json({ sujet: result.rows[0] });
});

router.get('/:id', async (req, res) => {
  const sujetResult = await pool.query(
    `SELECT s.*, u.prenom, u.full_name FROM forum_sujets s JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
    [req.params.id]
  );
  if (!sujetResult.rows.length) return res.status(404).json({ error: 'Sujet introuvable.' });

  const reponsesResult = await pool.query(
    `SELECT r.*, u.prenom, u.full_name FROM forum_reponses r JOIN users u ON u.id = r.user_id WHERE r.sujet_id = $1 ORDER BY r.created_at ASC`,
    [req.params.id]
  );
  res.json({ sujet: sujetResult.rows[0], reponses: reponsesResult.rows });
});

router.post('/:id/reponses', async (req, res) => {
  const { contenu } = req.body;
  if (!contenu || !contenu.trim()) return res.status(400).json({ error: 'Le message est vide.' });
  const sujetExiste = await pool.query('SELECT 1 FROM forum_sujets WHERE id = $1', [req.params.id]);
  if (!sujetExiste.rows.length) return res.status(404).json({ error: 'Sujet introuvable.' });
  const result = await pool.query(
    'INSERT INTO forum_reponses (sujet_id, user_id, contenu) VALUES ($1, $2, $3) RETURNING *',
    [req.params.id, req.user.id, contenu.trim()]
  );
  res.json({ reponse: result.rows[0] });
});

module.exports = router;
