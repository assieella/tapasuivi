function projectionFuture({ montant_initial, versement_mensuel, taux_annuel, horizon_mois }) {
  const n_annees = horizon_mois / 12;
  const r = taux_annuel;
  const capitalFromInitial = montant_initial * Math.pow(1 + r, n_annees);
  let capitalFromVersements = 0;
  const rMensuel = r / 12;
  if (rMensuel > 0) {
    capitalFromVersements = versement_mensuel * ((Math.pow(1 + rMensuel, 12 * n_annees) - 1) / rMensuel);
  } else {
    capitalFromVersements = versement_mensuel * horizon_mois;
  }
  return Math.round(capitalFromInitial + capitalFromVersements);
}

function versementRequis({ objectif, montant_initial, taux_annuel, horizon_mois }) {
  const n_annees = horizon_mois / 12;
  const r = taux_annuel;
  const rMensuel = r / 12;
  const capitalFromInitial = montant_initial * Math.pow(1 + r, n_annees);
  const restant = objectif - capitalFromInitial;
  if (restant <= 0) return 0;
  if (rMensuel > 0) {
    const facteur = (Math.pow(1 + rMensuel, 12 * n_annees) - 1) / rMensuel;
    return Math.ceil(restant / facteur);
  }
  return Math.ceil(restant / horizon_mois);
}

function horizonRequisMois({ objectif, montant_initial, versement_mensuel, taux_annuel, maxMois = 480 }) {
  for (let mois = 1; mois <= maxMois; mois++) {
    const fv = projectionFuture({ montant_initial, versement_mensuel, taux_annuel, horizon_mois: mois });
    if (fv >= objectif) return mois;
  }
  return null;
}

const TOLERANCE = 0.9;

function evaluerPlan({ objectif_montant, montant_initial, versement_mensuel, taux_annuel, horizon_mois }) {
  const montant_projete = projectionFuture({ montant_initial, versement_mensuel, taux_annuel, horizon_mois });
  const objectif_realiste = montant_projete >= objectif_montant * TOLERANCE;
  let versement_recommande = null;
  let horizon_recommande_mois = null;
  if (!objectif_realiste) {
    versement_recommande = versementRequis({ objectif: objectif_montant, montant_initial, taux_annuel, horizon_mois });
    horizon_recommande_mois = horizonRequisMois({ objectif: objectif_montant, montant_initial, versement_mensuel, taux_annuel });
  }
  return { montant_projete, objectif_realiste, versement_recommande, horizon_recommande_mois };
}

module.exports = { projectionFuture, versementRequis, horizonRequisMois, evaluerPlan };
