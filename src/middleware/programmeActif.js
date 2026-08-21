const pool = require('../db');
const { computeProgrammeStatus } = require('../services/programme');

// Bloque l'accès aux données du suivi et de la formation une fois la période
// d'accompagnement du client terminée (4 ou 12 mois selon son option).
// Ne s'applique qu'aux clients — les admins et prospects ne sont pas concernés.
async function requireProgrammeActif(req, res, next) {
  if (req.user.role !== 'client') return next();

  const result = await pool.query('SELECT created_at, programme FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  const statut = computeProgrammeStatus(user);
  if (statut.termine) {
    return res.status(403).json({
      error: "Votre accompagnement est terminé. Contactez-nous pour renouveler votre accès.",
      acces_termine: true
    });
  }
  next();
}

module.exports = { requireProgrammeActif };
