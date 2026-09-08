const pool = require('../db');
const { computeProgrammeStatus } = require('../services/programme');

// Bloque l'accès aux données du suivi et de la formation :
// 1. Tant que le client n'a pas signé numériquement son contrat d'accompagnement
// 2. Une fois la période d'accompagnement terminée (4 ou 12 mois selon son option)
// Ne s'applique qu'aux clients — les admins et prospects ne sont pas concernés.
async function requireProgrammeActif(req, res, next) {
  if (req.user.role !== 'client') return next();

  const result = await pool.query('SELECT created_at, programme, contrat_signe_le FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  if (!user.contrat_signe_le && user.programme !== 'gratuit') {
    return res.status(403).json({
      error: "Merci de lire et signer numériquement votre contrat d'accompagnement avant d'accéder à votre espace.",
      contrat_non_signe: true
    });
  }

  const statut = computeProgrammeStatus(user);
  if (statut.termine) {
    return res.status(403).json({
      error: "Votre accompagnement est terminé. Contactez-nous pour renouveler votre accès.",
      acces_termine: true
    });
  }
  next();
}

// Bloque spécifiquement les fonctionnalités "premium" (messagerie avec la conseillère,
// notamment) — un compte gratuit garde accès aux outils génériques, mais jamais à ce qui
// implique un vrai accompagnement humain personnalisé.
async function requireCompteNonGratuit(req, res, next) {
  if (req.user.role !== 'client') return next();
  const result = await pool.query('SELECT programme FROM users WHERE id = $1', [req.user.id]);
  if (result.rows[0]?.programme === 'gratuit') {
    return res.status(403).json({
      error: "Cette fonctionnalité fait partie de l'accompagnement BRVM Starter. Passez à une formule payante pour en profiter.",
      compte_gratuit: true
    });
  }
  next();
}

module.exports = { requireProgrammeActif, requireCompteNonGratuit };
