const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireProgrammeActif } = require('../middleware/programmeActif');
const { evaluerPlan } = require('../services/planCalc');
const { PROFILE_RECOMMENDATIONS } = require('../services/scoring');
const { STRATEGIES } = require('../data/strategies');
const { sendMail, emailPlanInvestissement } = require('../services/email');
const router = express.Router();

router.get('/strategies', (req, res) => { res.json({ strategies: STRATEGIES }); });

router.post('/', requireAuth, requireProgrammeActif, async (req, res) => {
  try {
    const { objectif_montant, horizon_mois, montant_initial, versement_mensuel, accepter_correction, strategie } = req.body;
    if (!objectif_montant || !horizon_mois) return res.status(400).json({ error: 'Objectif et horizon sont requis.' });
    if (!strategie || !STRATEGIES[strategie]) return res.status(400).json({ error: 'Merci de choisir une stratégie d\'investissement.' });
    const profileResult = await pool.query(`SELECT * FROM investor_profiles WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [req.user.id]);
    const profile = profileResult.rows[0];
    if (!profile) return res.status(400).json({ error: "Veuillez d'abord compléter le questionnaire de profil investisseur." });
    const taux_annuel = PROFILE_RECOMMENDATIONS[profile.profile_type].taux_rendement_estime;
    const evaluation = evaluerPlan({ objectif_montant: Number(objectif_montant), montant_initial: Number(montant_initial || 0), versement_mensuel: Number(versement_mensuel || 0), taux_annuel, horizon_mois: Number(horizon_mois) });
    let versement_final = Number(versement_mensuel || 0);
    if (!evaluation.objectif_realiste && accepter_correction && evaluation.versement_recommande != null) versement_final = evaluation.versement_recommande;
    const result = await pool.query(
      `INSERT INTO investment_plans (user_id, objectif_montant, horizon_mois, montant_initial, versement_mensuel, taux_annuel_estime, montant_projete, objectif_realiste, versement_recommande, horizon_recommande_mois, objectif_final_retenu, strategie) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.user.id, objectif_montant, horizon_mois, montant_initial || 0, versement_final, taux_annuel, evaluation.montant_projete, evaluation.objectif_realiste, evaluation.versement_recommande, evaluation.horizon_recommande_mois, objectif_montant, strategie]
    );
    const plan = result.rows[0];
    const { subject, html } = emailPlanInvestissement({ full_name: req.user.full_name, plan, correction: evaluation, strategieInfo: STRATEGIES[strategie] });
    await sendMail({ to: req.user.email, subject, html });
    res.json({ plan, evaluation });
  } catch (err) { console.error(err); res.status(400).json({ error: err.message || 'Erreur lors du calcul du plan.' }); }
});

router.get('/latest', requireAuth, requireProgrammeActif, async (req, res) => {
  const result = await pool.query(`SELECT * FROM investment_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [req.user.id]);
  res.json({ plan: result.rows[0] || null });
});

router.get('/rapport', requireAuth, requireProgrammeActif, async (req, res) => {
  const result = await pool.query(`SELECT * FROM investment_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [req.user.id]);
  const plan = result.rows[0];
  if (!plan) return res.status(404).json({ error: "Aucun plan d'investissement n'a encore été défini." });
  res.json({ plan, strategieInfo: plan.strategie ? STRATEGIES[plan.strategie] : null });
});

module.exports = router;
