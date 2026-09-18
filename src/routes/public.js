const express = require('express');
const pool = require('../db');
const router = express.Router();

// Aucune donnée sensible ici — juste les cours du jour, publics sur brvm.org comme partout
// ailleurs. Utilisée pour la bande de cours défilante sur la page d'accueil publique.
router.get('/cours-marche', async (req, res) => {
  const result = await pool.query(`
    SELECT DISTINCT ON (t.ticker) t.ticker, t.nom, c.cours, c.variation_pct
    FROM titres_brvm t
    JOIN cours_quotidiens c ON c.ticker = t.ticker
    ORDER BY t.ticker, c.date_cours DESC
  `);
  res.json({ titres: result.rows });
});

// Les 8 dividendes les plus récemment saisis, tous titres confondus — pour la vitrine
// publique de la page d'accueil.
router.get('/dividendes-recents', async (req, res) => {
  const result = await pool.query(`
    SELECT d.ticker, t.nom, d.annee, d.montant_par_action
    FROM dividendes_historique d
    JOIN titres_brvm t ON t.ticker = d.ticker
    WHERE d.montant_par_action > 0
    ORDER BY d.created_at DESC
    LIMIT 8
  `);
  res.json({ dividendes: result.rows });
});

// Les articles de blog publiés, les plus récents en premier — pour la vitrine publique.
router.get('/articles-recents', async (req, res) => {
  const result = await pool.query(`
    SELECT titre, slug, extrait, image_url, date_publication
    FROM articles_blog
    WHERE publie = true
    ORDER BY date_publication DESC
    LIMIT 3
  `);
  res.json({ articles: result.rows });
});

module.exports = router;
