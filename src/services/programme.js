// Extrait le nombre de mois depuis le nom du programme — fonctionne pour n'importe quelle
// durée : "1_mois", "2_mois", "4_mois", "12_mois", "suivi_3_mois", etc. Cette seule règle
// remplace les anciennes valeurs fixes, tout en restant compatible avec les comptes déjà créés.
function moisDuProgramme(programme) {
  const correspondance = String(programme || '').match(/(\d+)_mois$/);
  return correspondance ? Number(correspondance[1]) : 4; // 4 mois par défaut si le format est inattendu
}
// Un compte gratuit, ou un programme "suivi_X_mois" (formation déjà suivie ailleurs), n'a pas
// accès à la formation — seulement au suivi, aux outils et à la messagerie avec la conseillère.
function accesFormationInclus(programme) {
  return programme !== 'gratuit' && !String(programme || '').startsWith('suivi_');
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
