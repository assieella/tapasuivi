const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireProgrammeActif } = require('../middleware/programmeActif');
const { messageNiveau } = require('../data/notation');
const router = express.Router();

router.get('/', requireAuth, requireProgrammeActif, async (req, res) => {
  const modules = await pool.query('SELECT id, ordre, titre, description, seuil_reussite FROM modules_formation WHERE actif = true ORDER BY ordre ASC');
  const progression = await pool.query('SELECT module_id, reussi, score_pct, tentatives FROM progression_formation WHERE user_id = $1', [req.user.id]);
  const progressionParModule = Object.fromEntries(progression.rows.map(p => [p.module_id, p]));
  let precedentReussi = true;
  const resultat = [];
  for (const m of modules.rows) {
    const lecons = await pool.query('SELECT id, ordre, titre, youtube_id FROM lecons_formation WHERE module_id = $1 ORDER BY ordre ASC', [m.id]);
    const prog = progressionParModule[m.id] || { reussi: false, score_pct: null, tentatives: 0 };
    const debloque = precedentReussi;
    precedentReussi = prog.reussi;
    resultat.push({ ...m, lecons: lecons.rows, reussi: prog.reussi, score_pct: prog.score_pct, tentatives: prog.tentatives, debloque });
  }
  res.json({ modules: resultat });
});

router.get('/:id', requireAuth, requireProgrammeActif, async (req, res) => {
  const { id } = req.params;
  const moduleResult = await pool.query('SELECT * FROM modules_formation WHERE id = $1 AND actif = true', [id]);
  const module = moduleResult.rows[0];
  if (!module) return res.status(404).json({ error: 'Module introuvable.' });
  if (module.ordre > 1) {
    const precedent = await pool.query(
      `SELECT m.id FROM modules_formation m LEFT JOIN progression_formation p ON p.module_id = m.id AND p.user_id = $1
       WHERE m.ordre < $2 AND m.actif = true AND COALESCE(p.reussi, false) = false ORDER BY m.ordre DESC LIMIT 1`,
      [req.user.id, module.ordre]
    );
    if (precedent.rows.length) return res.status(403).json({ error: 'Ce module est verrouillé. Terminez le module précédent d\'abord.' });
  }
  const lecons = await pool.query('SELECT id, ordre, titre, youtube_id FROM lecons_formation WHERE module_id = $1 ORDER BY ordre ASC', [id]);
  const questionsSansReponses = module.questions.map(q => ({ question: q.question, options: q.options }));
  const progression = await pool.query('SELECT reussi, score_pct, tentatives FROM progression_formation WHERE user_id = $1 AND module_id = $2', [req.user.id, id]);
  res.json({
    module: { id: module.id, ordre: module.ordre, titre: module.titre, description: module.description, seuil_reussite: module.seuil_reussite },
    lecons: lecons.rows,
    questions: questionsSansReponses,
    progression: progression.rows[0] || { reussi: false, score_pct: null, tentatives: 0 }
  });
});

router.post('/:id/repondre', requireAuth, requireProgrammeActif, async (req, res) => {
  const { id } = req.params;
  const { reponses } = req.body;
  const moduleResult = await pool.query('SELECT * FROM modules_formation WHERE id = $1 AND actif = true', [id]);
  const module = moduleResult.rows[0];
  if (!module) return res.status(404).json({ error: 'Module introuvable.' });
  if (!module.questions.length) return res.status(400).json({ error: "Le quiz de ce module n'est pas encore disponible." });
  if (!Array.isArray(reponses) || reponses.length !== module.questions.length) return res.status(400).json({ error: 'Merci de répondre à toutes les questions.' });
  let bonnesReponses = 0;
  module.questions.forEach((q, i) => {
    if (Number(reponses[i]) === Number(q.bonne_reponse)) bonnesReponses++;
  });
  const score_pct = Math.round((bonnesReponses / module.questions.length) * 100);
  const reussi = score_pct >= module.seuil_reussite;
  const existant = await pool.query('SELECT tentatives FROM progression_formation WHERE user_id = $1 AND module_id = $2', [req.user.id, id]);
  const tentatives = (existant.rows[0]?.tentatives || 0) + 1;
  await pool.query(
    `INSERT INTO progression_formation (user_id, module_id, reussi, score_pct, tentatives, date_reussite) VALUES ($1,$2,$3,$4,$5, CASE WHEN $3 THEN NOW() ELSE NULL END)
     ON CONFLICT (user_id, module_id) DO UPDATE SET reussi = GREATEST(progression_formation.reussi::int, $3::int)::boolean, score_pct = $4, tentatives = $5,
     date_reussite = CASE WHEN $3 AND progression_formation.date_reussite IS NULL THEN NOW() ELSE progression_formation.date_reussite END`,
    [req.user.id, id, reussi, score_pct, tentatives]
  );
  // Aucune bonne réponse n'est jamais renvoyée au client — seulement le score et un message qualitatif.
  res.json({ reussi, score_pct, bonnes_reponses: bonnesReponses, total_questions: module.questions.length, seuil_reussite: module.seuil_reussite, message_niveau: messageNiveau(score_pct) });
});

module.exports = router;
