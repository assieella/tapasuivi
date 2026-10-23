const express = require('express');
const pool = require('../db');
const router = express.Router();

// Le score est recalculé côté serveur — jamais fait confiance à un score envoyé par le
// client, pour éviter qu'une personne malveillante ne manipule son résultat affiché.
function calculerScore(reponses) {
  const POINTS = { A: 10, B: 5, C: 0 };
  return reponses.reduce((total, r) => total + (POINTS[r] || 0), 0);
}

function determinerPalier(score) {
  if (score >= 80) return 'pret';
  if (score >= 50) return 'presque_pret';
  return 'pas_encore';
}

// Capture publique, sans authentification : le score n'est révélé qu'une fois l'email fourni.
router.post('/', async (req, res) => {
  const { prenom, email, whatsapp, reponses } = req.body;
  if (!email || !Array.isArray(reponses) || reponses.length !== 10) {
    return res.status(400).json({ error: 'Email et 10 réponses sont requis.' });
  }

  const score = calculerScore(reponses);
  const palier = determinerPalier(score);

  await pool.query(
    'INSERT INTO test_tapa_reponses (prenom, email, whatsapp, score, palier) VALUES ($1, $2, $3, $4, $5)',
    [(prenom || '').trim() || null, email.trim().toLowerCase(), (whatsapp || '').trim() || null, score, palier]
  );

  res.json({ score, palier });
});

module.exports = router;
