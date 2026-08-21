const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { computeProgrammeStatus } = require('../services/programme');
const { construireLienGoogleCalendar, construireFichierICS } = require('../services/calendrier');
const router = express.Router();

const TITRE_RAPPEL = "Investir sur la BRVM — TAPA CONSEIL";
const DESCRIPTION_RAPPEL = "Rappel mensuel : c'est le moment de faire votre versement et de revoir votre portefeuille BRVM avec TAPA CONSEIL.";

router.get('/status', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT created_at, programme FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  const statut = computeProgrammeStatus(user);
  const lien_google_calendar = construireLienGoogleCalendar({ date_fin: statut.date_fin, titre: TITRE_RAPPEL, description: DESCRIPTION_RAPPEL });
  res.json({ ...statut, lien_google_calendar });
});

router.get('/prochain-appel', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT id, date_appel, plateforme, lien, notes FROM appels_mensuels WHERE date_appel > NOW() ORDER BY date_appel ASC LIMIT 1`
  );
  res.json({ appel: result.rows[0] || null });
});

router.get('/rappel.ics', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT created_at, programme FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  const statut = computeProgrammeStatus(user);
  const ics = construireFichierICS({ date_fin: statut.date_fin, titre: TITRE_RAPPEL, description: DESCRIPTION_RAPPEL, uid: `rappel-investissement-${req.user.id}` });
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="rappel-investissement-tapa.ics"');
  res.send(ics);
});

module.exports = router;
