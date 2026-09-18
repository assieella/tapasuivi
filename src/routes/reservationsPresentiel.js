const express = require('express');
const pool = require('../db');
const router = express.Router();

// Publique — aucune authentification requise, c'est un formulaire de réservation
// sur la page d'accueil, pas un espace client.
router.post('/', async (req, res) => {
  const { nom, prenom, whatsapp } = req.body;
  if (!nom || !prenom || !whatsapp) {
    return res.status(400).json({ error: 'Nom, prénom et numéro WhatsApp sont obligatoires.' });
  }
  const result = await pool.query(
    'INSERT INTO reservations_presentiel (nom, prenom, whatsapp) VALUES ($1, $2, $3) RETURNING *',
    [nom.trim(), prenom.trim(), whatsapp.trim()]
  );

  // Notification à l'admin — jamais bloquante, la réservation reste valide même si l'email échoue.
  try {
    const { sendMail } = require('../services/email');
    await sendMail({
      to: 'contact@tapaconseilagence.com',
      subject: 'Nouvelle réservation — Formation en présentiel',
      html: `<p>${prenom.trim()} ${nom.trim()} vient de réserver sa place pour la formation en présentiel.</p><p>WhatsApp : ${whatsapp.trim()}</p>`
    });
  } catch (e) { console.error('Échec de la notification de réservation présentiel :', e.message); }

  res.json({ reservation: result.rows[0] });
});

module.exports = router;
