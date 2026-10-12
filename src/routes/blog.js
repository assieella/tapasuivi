const express = require('express');
const pool = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const result = await pool.query(
    'SELECT id, titre, slug, extrait, image_url, date_publication FROM articles_blog WHERE publie = true ORDER BY date_publication DESC'
  );
  res.json({ articles: result.rows });
});

router.get('/:slug', async (req, res) => {
  const result = await pool.query('SELECT * FROM articles_blog WHERE slug = $1 AND publie = true', [req.params.slug]);
  if (!result.rows.length) return res.status(404).json({ error: 'Article introuvable.' });
  res.json({ article: result.rows[0] });
});

module.exports = router;
