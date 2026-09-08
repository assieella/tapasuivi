const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Un compte "saisie" ne peut accéder qu'à ces routes précises — jamais aux clients,
// à la messagerie, aux notes internes ou à quoi que ce soit d'autre du back-office.
function requireSaisie(req, res, next) {
  if (req.user.role !== 'saisie') return res.status(403).json({ error: 'Accès réservé.' });
  next();
}

// Liste des titres (ticker + nom uniquement) — pour remplir le menu déroulant.
router.get('/titres', requireAuth, requireSaisie, async (req, res) => {
  const result = await pool.query('SELECT ticker, nom FROM titres_brvm ORDER BY ticker ASC');
  res.json({ titres: result.rows });
});

router.get('/titres/:ticker/donnees-financieres', requireAuth, requireSaisie, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM donnees_financieres WHERE ticker = $1 ORDER BY annee DESC',
    [req.params.ticker.toUpperCase()]
  );
  res.json({ donnees: result.rows });
});

// Toute saisie via ce compte reste "en attente de validation" — jamais utilisée
// telle quelle tant que l'admin ne l'a pas vérifiée et validée.
router.post('/titres/:ticker/donnees-financieres', requireAuth, requireSaisie, async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const { annee, chiffre_affaires, benefice_net, capitaux_propres, dettes_totales } = req.body;
  if (!annee) return res.status(400).json({ error: 'L\'année est obligatoire.' });

  const titreExiste = await pool.query('SELECT 1 FROM titres_brvm WHERE ticker = $1', [ticker]);
  if (!titreExiste.rows.length) return res.status(404).json({ error: 'Titre introuvable.' });

  const result = await pool.query(
    `INSERT INTO donnees_financieres (ticker, annee, chiffre_affaires, benefice_net, capitaux_propres, dettes_totales, valide, saisi_par)
     VALUES ($1, $2, $3, $4, $5, $6, false, $7)
     ON CONFLICT (ticker, annee) DO UPDATE SET
       chiffre_affaires = $3, benefice_net = $4, capitaux_propres = $5, dettes_totales = $6,
       valide = false, saisi_par = $7, updated_at = NOW()
     RETURNING *`,
    [ticker, annee, chiffre_affaires || null, benefice_net || null, capitaux_propres || null, dettes_totales || null, req.user.email]
  );
  res.json({ donnee: result.rows[0] });
});

module.exports = router;
