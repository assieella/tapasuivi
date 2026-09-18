// Grille de notification (retour qualitatif) donnée à l'apprenant selon son score au quiz,
// exprimée en fraction du score maximum pour s'adapter à n'importe quel nombre de questions.
// Basée sur le barème fourni par Ella pour un quiz sur 12 points :
// 10-12/12 (≥83%) / 7-9/12 (≥58%) / 4-6/12 (≥33%) / 0-3/12 (<33%)

function messageNiveau(score_pct) {
  const fraction = score_pct / 100;
  if (fraction >= 0.83) return 'Très bonne maîtrise du module.';
  if (fraction >= 0.58) return 'Connaissances globalement acquises.';
  if (fraction >= 0.33) return 'Plusieurs notions sont à revoir.';
  return 'Le module doit être repris en profondeur.';
}

module.exports = { messageNiveau };
