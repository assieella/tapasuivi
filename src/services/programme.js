function moisDuProgramme(programme) {
  if (programme === '12_mois') return 12;
  if (programme === 'suivi_3_mois') return 3;
  return 4;
}
// Un compte "suivi_3_mois" n'a pas accès à la formation (déjà suivie ailleurs) —
// seulement au suivi, aux outils et à la messagerie avec la conseillère.
function accesFormationInclus(programme) {
  return programme !== 'suivi_3_mois';
}
function ajouterMois(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}
function joursEntre(dateA, dateB) {
  const MS_PAR_JOUR = 1000 * 60 * 60 * 24;
  return Math.ceil((dateA.getTime() - dateB.getTime()) / MS_PAR_JOUR);
}
function computeProgrammeStatus({ created_at, programme }) {
  // Un compte gratuit n'a pas de durée limitée — accès permanent aux outils gratuits.
  if (programme === 'gratuit') {
    return { mois: null, date_debut: new Date(created_at).toISOString(), date_fin: null, jours_restants: null, pourcentage: null, termine: false, alerte_fin_proche: false };
  }
  const mois = moisDuProgramme(programme);
  const date_debut = new Date(created_at);
  const date_fin = ajouterMois(date_debut, mois);
  const maintenant = new Date();
  const duree_totale_jours = joursEntre(date_fin, date_debut);
  const jours_ecoules = joursEntre(maintenant, date_debut);
  const jours_restants = joursEntre(date_fin, maintenant);
  const pourcentage = Math.min(100, Math.max(0, Math.round((jours_ecoules / duree_totale_jours) * 100)));
  return {
    mois, date_debut: date_debut.toISOString(), date_fin: date_fin.toISOString(),
    jours_restants, pourcentage, termine: jours_restants <= 0,
    alerte_fin_proche: jours_restants > 0 && jours_restants <= 14
  };
}
// Un compte gratuit n'a accès à aucune fonctionnalité "premium" (conseillère, formation,
// rapport hebdomadaire, analyse personnalisée) — seulement aux outils génériques.
function estCompteGratuit(programme) {
  return programme === 'gratuit';
}
module.exports = { computeProgrammeStatus, moisDuProgramme, ajouterMois, accesFormationInclus, estCompteGratuit };
