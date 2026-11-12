const express = require('express');
const pool = require('../db');
const router = express.Router();

// Publique — aucune authentification requise, c'est un formulaire de réservation
// sur la page d'accueil, pas un espace client.
router.post('/', async (req, res) => {
  const { nom, prenom, whatsapp } = req.body;
  const OPTIONS = ['BRVM Starter Adultes', 'BRVM Starter Jeunes', 'TAPA Invest Femme', 'Formation en présentiel', 'Formation en ligne', 'Séance femmes', 'Séance jeunes 20-30 ans'];
  const TRANCHES = ['Moins de 18 ans', '18 à 25 ans', '26 à 45 ans', '46 ans et plus', 'Moins de 20 ans', '20 à 30 ans', '31 à 45 ans'];
  const OBJECTIFS = ['Mieux gérer mon budget', 'Épargner et sortir des dettes', 'Apprendre à investir', 'Construire mon autonomie financière'];
  const FORMATS = ['En ligne', 'En présentiel'];
  const format = FORMATS.includes(req.body.format) ? req.body.format : null;
  const tranche = TRANCHES.includes(req.body.tranche_age) ? req.body.tranche_age : null;
  const objectif = OBJECTIFS.includes(req.body.objectif) ? req.body.objectif : null;
  const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre','Je ne sais pas encore'];
  const mois = MOIS.includes(req.body.mois) ? req.body.mois : null;
  const contactCommercial = req.body.contact_commercial === true;
  const option = OPTIONS.includes(req.body.option) ? req.body.option : 'Formation en présentiel';
  if (!nom || !prenom || !whatsapp) {
    return res.status(400).json({ error: 'Nom, prénom et numéro WhatsApp sont obligatoires.' });
  }
  const result = await pool.query(
    'INSERT INTO reservations_presentiel (nom, prenom, whatsapp, option_choisie, tranche_age, objectif, format_choisi, contact_commercial, mois_souhaite) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
    [nom.trim(), prenom.trim(), whatsapp.trim(), option, tranche, objectif, format, contactCommercial, mois]
  );

  // Notification à l'admin — jamais bloquante, la réservation reste valide même si l'email échoue.
  try {
    const { sendMail } = require('../services/email');
    await sendMail({
      to: 'contact@tapaconseilagence.com',
      subject: `Nouvelle inscription — ${option}`,
      html: `<p>${prenom.trim()} ${nom.trim()} vient de s'inscrire sur la liste d'attente : <strong>${option}</strong>.</p><p>WhatsApp : ${whatsapp.trim()}</p><p>Format : ${format || '—'}<br>Mois souhaité : ${mois || '—'}<br>Tranche d'âge : ${tranche || '—'}<br>Objectif : ${objectif || '—'}</p>${contactCommercial ? '<p><strong>📞 Souhaite être recontacté(e) par un(e) commercial(e).</strong></p>' : ''}`
    });
  } catch (e) { console.error('Échec de la notification de réservation présentiel :', e.message); }

  res.json({ reservation: result.rows[0] });
});

module.exports = router;
