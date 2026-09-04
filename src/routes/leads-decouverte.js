const express = require('express');
const pool = require('../db');
const router = express.Router();

// Capture publique, sans authentification : Nom, Prénom, WhatsApp, Email
router.post('/', async (req, res) => {
  const { nom, prenom, whatsapp, email } = req.body;
  if (!nom || !prenom || !whatsapp || !email) {
    return res.status(400).json({ error: 'Nom, prénom, numéro WhatsApp et email sont requis.' });
  }
  await pool.query(
    'INSERT INTO leads_decouverte (nom, prenom, whatsapp, email) VALUES ($1, $2, $3, $4)',
    [nom.trim(), prenom.trim(), whatsapp.trim(), email.trim().toLowerCase()]
  );
  res.json({ ok: true });
});

// Vidéos Q&R accessibles publiquement une fois le formulaire rempli (pas de compte requis)
router.get('/videos', async (req, res) => {
  const result = await pool.query('SELECT id, ordre, titre, description, youtube_id FROM videos_gratuites WHERE actif = true ORDER BY ordre ASC');
  res.json({ videos: result.rows });
});

module.exports = router;
