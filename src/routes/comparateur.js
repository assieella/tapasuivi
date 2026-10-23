const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireProgrammeActif } = require('../middleware/programmeActif');
const router = express.Router();

// Renvoie, pour chaque série demandée (titres + éventuellement l'indice), l'évolution
// en pourcentage depuis la première date commune — pour que des titres à des prix très
// différents (ex: 2 000 FCFA et 30 000 FCFA) soient comparables sur un même graphique.
router.get('/', requireAuth, requireProgrammeActif, async (req, res) => {
  const tickers = String(req.query.tickers || '').split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  const avecIndice = req.query.indice === 'BRVM-C';

  if (!tickers.length && !avecIndice) return res.status(400).json({ error: 'Choisis au moins un titre à comparer.' });
  if (tickers.length > 5) return res.status(400).json({ error: 'Choisis 5 titres maximum pour garder un graphique lisible.' });

  const series = [];

  for (const ticker of tickers) {
    const result = await pool.query(
      'SELECT date_cours, cours FROM cours_quotidiens WHERE ticker = $1 ORDER BY date_cours ASC',
      [ticker]
    );
    if (result.rows.length < 2) continue; // pas assez de points pour comparer
    const titreInfo = await pool.query('SELECT nom FROM titres_brvm WHERE ticker = $1', [ticker]);
    series.push({
      id: ticker,
      label: titreInfo.rows[0]?.nom || ticker,
      points: result.rows.map(r => ({ date: r.date_cours, valeur: Number(r.cours) }))
    });
  }

  if (avecIndice) {
    const result = await pool.query(
      "SELECT date_indice AS date_cours, valeur AS cours FROM indices_quotidiens WHERE indice = 'BRVM-C' ORDER BY date_indice ASC"
    );
    if (result.rows.length >= 2) {
      series.push({
        id: 'BRVM-C',
        label: 'Indice BRVM Composite',
        points: result.rows.map(r => ({ date: r.date_cours, valeur: Number(r.cours) }))
      });
    }
  }

  if (!series.length) return res.json({ series: [], message: "Pas assez d'historique enregistré pour ces titres (colle les cours plusieurs jours de suite pour activer la comparaison)." });

  // Date de départ commune : la plus tardive des premières dates de chaque série,
  // pour que toutes les courbes démarrent au même point de référence (0%).
  const dateDepart = series.reduce((max, s) => {
    const premiereDate = s.points[0].date;
    return premiereDate > max ? premiereDate : max;
  }, series[0].points[0].date);

  const normalisees = series.map(s => {
    const pointsApresDepart = s.points.filter(p => p.date >= dateDepart);
    if (!pointsApresDepart.length) return { ...s, points: [] };
    const valeurDepart = pointsApresDepart[0].valeur;
    return {
      id: s.id,
      label: s.label,
      points: pointsApresDepart.map(p => ({
        date: p.date,
        valeur: p.valeur,
        variation_pct: valeurDepart ? Math.round(((p.valeur - valeurDepart) / valeurDepart) * 10000) / 100 : 0
      }))
    };
  }).filter(s => s.points.length > 0);

  res.json({ series: normalisees, date_depart: dateDepart });
});

module.exports = router;
