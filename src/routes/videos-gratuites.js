const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT id, ordre, titre, description, youtube_id FROM videos_gratuites WHERE actif = true ORDER BY ordre ASC');
  res.json({ videos: result.rows });
});

module.exports = router;
