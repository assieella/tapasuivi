const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireProgrammeActif } = require('../middleware/programmeActif');
const { QUESTIONS, INFO_FIELDS, computeProfile, validerInfos, PROFILE_RECOMMENDATIONS, MAX_SCORE } = require('../services/scoring');
const { sendMail, emailProfilInvestisseur } = require('../services/email');
const router = express.Router();

router.get('/questions', (req, res) => { res.json({ questions: QUESTIONS, infoFields: INFO_FIELDS, maxScore: MAX_SCORE }); });

router.post('/', requireAuth, requireProgrammeActif, async (req, res) => {
  try {
    const { answers, infos } = req.body;
    const infosValidees = validerInfos(infos);
    const { score, profile_type } = computeProfile(answers || {});
    const result = await pool.query(
      `INSERT INTO investor_profiles (user_id, profession, revenu_mensuel, capital_disponible, situation_familiale, nombre_enfants, answers, score, profile_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, infosValidees.profession, infosValidees.revenu_mensuel, infosValidees.capital_disponible, infosValidees.situation_familiale, infosValidees.nombre_enfants, JSON.stringify(answers), score, profile_type]
    );
    const reco = PROFILE_RECOMMENDATIONS[profile_type];
    const { subject, html } = emailProfilInvestisseur({ full_name: req.user.full_name, prenom: req.user.prenom, infos: infosValidees, answers, profile_type, score, max_score: MAX_SCORE, reco });
    // L'email ne doit jamais empêcher la validation de réussir — le profil est déjà bien
    // enregistré à ce stade (ligne au-dessus), c'est ce qui compte le plus pour le client.
    try { await sendMail({ to: req.user.email, subject, html }); }
    catch (e) { console.error('Échec de l\'email de confirmation du profil investisseur :', e.message); }
    res.json({ profile: result.rows[0], recommandations: reco, max_score: MAX_SCORE });
  } catch (err) { console.error(err); res.status(400).json({ error: err.message || 'Erreur lors du calcul du profil.' }); }
});

router.get('/latest', requireAuth, requireProgrammeActif, async (req, res) => {
  const result = await pool.query(`SELECT * FROM investor_profiles WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [req.user.id]);
  res.json({ profile: result.rows[0] || null });
});

router.get('/rapport', requireAuth, requireProgrammeActif, async (req, res) => {
  const result = await pool.query(`SELECT * FROM investor_profiles WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [req.user.id]);
  const profile = result.rows[0];
  if (!profile) return res.status(404).json({ error: "Aucun profil investisseur n'a encore été complété." });
  const { genererAnalyseRedigee } = require('../services/analyse');
  const reco = PROFILE_RECOMMENDATIONS[profile.profile_type];
  const paragraphes = genererAnalyseRedigee({
    prenom: req.user.prenom, full_name: req.user.full_name,
    infos: { profession: profile.profession, revenu_mensuel: profile.revenu_mensuel, capital_disponible: profile.capital_disponible, situation_familiale: profile.situation_familiale, nombre_enfants: profile.nombre_enfants },
    answers: profile.answers, profile_type: profile.profile_type, score: profile.score, max_score: MAX_SCORE, reco
  });
  res.json({ paragraphes, profile, reco, date: profile.created_at });
});

module.exports = router;
