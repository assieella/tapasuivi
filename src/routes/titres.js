const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireProgrammeActif } = require('../middleware/programmeActif');
const router = express.Router();

router.get('/', requireAuth, requireProgrammeActif, async (req, res) => {
  const result = await pool.query(`
    SELECT t.ticker, t.nom, t.secteur, t.pays, t.fiche_complete, c.cours, c.variation_pct, c.date_cours
    FROM titres_brvm t
    LEFT JOIN LATERAL (SELECT cours, variation_pct, date_cours FROM cours_quotidiens cq WHERE cq.ticker = t.ticker ORDER BY date_cours DESC LIMIT 1) c ON true
    ORDER BY t.ticker ASC
  `);
  res.json({ titres: result.rows });
});

// Placée avant /:ticker, sinon "top-flop" serait interprété comme un code de titre.
router.get('/marche/top-flop', requireAuth, requireProgrammeActif, async (req, res) => {
  const result = await pool.query(`
    SELECT DISTINCT ON (t.ticker) t.ticker, t.nom, c.cours, c.variation_pct
    FROM titres_brvm t
    JOIN cours_quotidiens c ON c.ticker = t.ticker
    ORDER BY t.ticker, c.date_cours DESC
  `);
  const avecVariation = result.rows.filter(t => t.variation_pct !== null);
  const top5 = [...avecVariation].sort((a, b) => Number(b.variation_pct) - Number(a.variation_pct)).slice(0, 5);
  const flop5 = [...avecVariation].sort((a, b) => Number(a.variation_pct) - Number(b.variation_pct)).slice(0, 5);
  res.json({ top5, flop5 });
});

// Bilan hebdomadaire du marché — meilleures et moins bonnes performances de la semaine
// (du lundi au dernier cours connu), avec un résumé chiffré. Calculé directement à partir
// des vrais cours, jamais généré par IA — donc toujours fiable, sans risque d'invention.
router.get('/marche/top-flop-semaine', requireAuth, requireProgrammeActif, async (req, res) => {
  const aujourdhui = new Date();
  const debutSemaine = new Date(aujourdhui);
  debutSemaine.setDate(aujourdhui.getDate() - ((aujourdhui.getDay() + 6) % 7)); // lundi de cette semaine
  debutSemaine.setHours(0, 0, 0, 0);
  const dateDebutSemaineStr = debutSemaine.toISOString().slice(0, 10);

  const titres = (await pool.query('SELECT ticker, nom FROM titres_brvm')).rows;
  const performancesSemaine = [];

  for (const titre of titres) {
    const debutResult = await pool.query(
      `SELECT cours FROM cours_quotidiens WHERE ticker = $1 AND date_cours >= $2 ORDER BY date_cours ASC LIMIT 1`,
      [titre.ticker, dateDebutSemaineStr]
    );
    const finResult = await pool.query(
      `SELECT cours, date_cours FROM cours_quotidiens WHERE ticker = $1 ORDER BY date_cours DESC LIMIT 1`,
      [titre.ticker]
    );
    if (!debutResult.rows.length || !finResult.rows.length) continue;

    const coursDebut = Number(debutResult.rows[0].cours);
    const coursFin = Number(finResult.rows[0].cours);
    if (coursDebut <= 0) continue;

    const variationSemainePct = Math.round(((coursFin - coursDebut) / coursDebut) * 1000) / 10;
    performancesSemaine.push({ ticker: titre.ticker, nom: titre.nom, cours: coursFin, variation_semaine_pct: variationSemainePct });
  }

  const top5Semaine = [...performancesSemaine].sort((a, b) => b.variation_semaine_pct - a.variation_semaine_pct).slice(0, 5);
  const flop5Semaine = [...performancesSemaine].sort((a, b) => a.variation_semaine_pct - b.variation_semaine_pct).slice(0, 5);
  const nombreHausse = performancesSemaine.filter(p => p.variation_semaine_pct > 0).length;
  const nombreBaisse = performancesSemaine.filter(p => p.variation_semaine_pct < 0).length;
  const nombreStable = performancesSemaine.filter(p => p.variation_semaine_pct === 0).length;

  res.json({
    top5: top5Semaine, flop5: flop5Semaine,
    resume: { nombre_hausse: nombreHausse, nombre_baisse: nombreBaisse, nombre_stable: nombreStable, nombre_total: performancesSemaine.length }
  });
});

router.get('/:ticker', requireAuth, requireProgrammeActif, async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const titre = await pool.query('SELECT * FROM titres_brvm WHERE ticker = $1', [ticker]);
  if (!titre.rows.length) return res.status(404).json({ error: 'Titre introuvable.' });
  const historique = await pool.query('SELECT date_cours, cours, variation_pct FROM cours_quotidiens WHERE ticker = $1 ORDER BY date_cours DESC LIMIT 30', [ticker]);
  const dividendes = await pool.query('SELECT annee, montant_par_action FROM dividendes_historique WHERE ticker = $1 ORDER BY annee ASC', [ticker]);
  // Uniquement les données validées — jamais une saisie en attente non vérifiée montrée au client.
  const donneesFinancieres = await pool.query(
    'SELECT annee, chiffre_affaires, benefice_net FROM donnees_financieres WHERE ticker = $1 AND valide = true ORDER BY annee ASC',
    [ticker]
  );
  const etudes = await pool.query('SELECT id, titre, contenu, date_publication FROM etudes_titres WHERE ticker = $1 ORDER BY date_publication DESC LIMIT 10', [ticker]);
  let performance_pct = null;
  if (historique.rows.length >= 2) {
    const plusRecent = Number(historique.rows[0].cours);
    const plusAncien = Number(historique.rows[historique.rows.length - 1].cours);
    if (plusAncien > 0) performance_pct = Math.round(((plusRecent - plusAncien) / plusAncien) * 10000) / 100;
  }
  res.json({ titre: titre.rows[0], historique: historique.rows, dividendes: dividendes.rows, donnees_financieres: donneesFinancieres.rows, etudes: etudes.rows, performance_pct });
});

module.exports = router;
