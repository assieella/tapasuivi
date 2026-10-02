const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { computeProgrammeStatus } = require('../services/programme');
const router = express.Router();

const LABELS_FORMULE = { '4_mois': 'BRVM Starter — 4 mois', '12_mois': 'BRVM Starter — 12 mois' };

// Infos du contrat pré-remplies avec les vraies données du client — jamais de champ vide à deviner.
router.get('/', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT full_name, prenom, nom, programme, created_at, contrat_signe_le FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  const statut = computeProgrammeStatus(user);
  res.json({
    nom_complet: user.full_name || `${user.prenom} ${user.nom}`.trim(),
    formule: LABELS_FORMULE[user.programme] || user.programme || 'BRVM Starter',
    date_debut: statut.date_debut,
    date_fin: statut.date_fin,
    deja_signe: !!user.contrat_signe_le,
    signe_le: user.contrat_signe_le
  });
});

// Signature numérique : le client doit taper exactement "lu et approuvé" pour valider.
router.post('/signer', requireAuth, async (req, res) => {
  const { confirmation } = req.body || {};
  const texteAttendu = 'lu et approuvé';
  if (!confirmation || confirmation.trim().toLowerCase() !== texteAttendu) {
    return res.status(400).json({ error: `Merci de taper exactement "${texteAttendu}" pour valider votre signature.` });
  }
  await pool.query('UPDATE users SET contrat_signe_le = NOW() WHERE id = $1', [req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
