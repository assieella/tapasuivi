const { getReponseLabel } = require('./scoring');

function formatMontant(n) {
  return Number(n).toLocaleString('fr-FR') + ' FCFA';
}

function phraseSituationFamiliale(situation_familiale, nombre_enfants) {
  const enfants = Number(nombre_enfants) || 0;
  if (situation_familiale === 'Célibataire' && enfants === 0) {
    return "Étant célibataire et sans personne à charge, vous disposez d'une réelle liberté de manœuvre dans la gestion de votre épargne : vous pouvez vous permettre un horizon d'investissement plus souple et une prise de risque légèrement supérieure, tant que cela reste cohérent avec vos objectifs de vie à moyen terme.";
  }
  if (situation_familiale === 'Célibataire' && enfants > 0) {
    return `En tant que parent (${enfants} enfant${enfants > 1 ? 's' : ''} à charge), même sans conjoint, il est important de conserver une réserve de précaution solide avant d'investir, et de privilégier une partie de votre portefeuille sur des supports plus stables pour sécuriser l'avenir de vos enfants.`;
  }
  if (situation_familiale === 'Marié(e)' && enfants === 0) {
    return "Votre situation de couple, sans enfant à charge pour le moment, vous permet généralement d'investir avec une visibilité correcte sur vos charges, tout en gardant à l'esprit que vos projets communs (logement, famille future) peuvent évoluer votre horizon d'investissement.";
  }
  if (situation_familiale === 'Marié(e)' && enfants > 0) {
    return `Votre situation familiale (marié(e), ${enfants} enfant${enfants > 1 ? 's' : ''} à charge) implique des charges récurrentes importantes. Il est essentiel de sécuriser d'abord une épargne de précaution suffisante, puis de bâtir votre portefeuille boursier progressivement, sans jamais mobiliser l'argent destiné aux besoins du foyer.`;
  }
  if (situation_familiale === 'Divorcé(e)') {
    return `Votre situation actuelle (divorcé(e)${enfants > 0 ? `, avec ${enfants} enfant${enfants > 1 ? 's' : ''} à charge` : ''}) mérite une gestion prudente de votre trésorerie disponible, avec une priorité donnée à la stabilité avant la recherche de performance.`;
  }
  if (situation_familiale === 'Veuf(ve)') {
    return `Compte tenu de votre situation (veuf/veuve${enfants > 0 ? `, avec ${enfants} enfant${enfants > 1 ? 's' : ''} à charge` : ''}), nous recommandons une approche particulièrement prudente et progressive, en sécurisant d'abord votre stabilité financière avant d'augmenter l'exposition au risque.`;
  }
  return '';
}

function phraseCapaciteFinanciere(revenu_mensuel, capital_disponible) {
  const ratio = capital_disponible / (revenu_mensuel || 1);
  if (ratio > 12) {
    return `Avec un capital disponible de ${formatMontant(capital_disponible)} pour des revenus mensuels de ${formatMontant(revenu_mensuel)}, votre capacité d'investissement est confortable : ce capital représente plus d'un an de vos revenus, ce qui vous laisse une réelle latitude pour investir sereinement sur les marchés.`;
  }
  if (ratio > 4) {
    return `Votre capital disponible de ${formatMontant(capital_disponible)} représente plusieurs mois de vos revenus mensuels (${formatMontant(revenu_mensuel)}) : une base saine pour démarrer un portefeuille diversifié, à condition de conserver une épargne de précaution en parallèle.`;
  }
  return `Votre capital disponible (${formatMontant(capital_disponible)}) reste modeste au regard de vos revenus mensuels (${formatMontant(revenu_mensuel)}). Nous vous recommandons de démarrer prudemment, avec des montants que vous pouvez faire croître progressivement via des versements réguliers plutôt qu'un engagement massif immédiat.`;
}

const EXPLICATION_PROFIL = {
  Prudent: "Un profil Prudent signifie que la priorité, pour vous, est la protection de votre capital. Vous préférez une croissance plus lente mais plus stable, quitte à renoncer à une partie du potentiel de gain, plutôt que de subir des variations de valeur importantes.",
  'Équilibré': "Un profil Équilibré signifie que vous recherchez un compromis entre sécurité et performance. Vous acceptez une part de risque mesurée, en échange d'un potentiel de croissance plus intéressant que les placements strictement sécurisés.",
  Dynamique: "Un profil Dynamique signifie que vous êtes prêt(e) à accepter des fluctuations de valeur significatives sur votre portefeuille, en contrepartie d'un potentiel de performance nettement supérieur sur la durée.",
  Offensif: "Un profil Offensif signifie que la recherche de performance prime sur la stabilité à court terme. Vous acceptez une volatilité importante de votre portefeuille, en gardant en tête que les marchés actions, sur le long terme, ont historiquement récompensé cette prise de risque."
};

function genererAnalyseRedigee({ prenom, full_name, infos, answers, profile_type, score, max_score, reco }) {
  const nomAffiche = prenom || full_name;
  const horizonLabel = getReponseLabel('horizon', answers.horizon);
  const reactionLabel = getReponseLabel('reaction_baisse', answers.reaction_baisse);
  const experienceLabel = getReponseLabel('experience', answers.experience);
  const objectifLabel = getReponseLabel('objectif', answers.objectif);
  const liquiditeLabel = getReponseLabel('besoin_liquidite', answers.besoin_liquidite);

  const paragraphes = [];
  paragraphes.push(`Bonjour ${nomAffiche},`);
  paragraphes.push(`Merci d'avoir pris le temps de compléter votre fiche de profil investisseur. Nous avons étudié attentivement l'ensemble de vos réponses — votre situation personnelle, votre capacité financière, votre expérience et votre rapport au risque — afin de vous proposer un accompagnement réellement adapté à votre cas, et non une recommandation générique.`);

  let paraSituation = `Vous exercez en tant que ${infos.profession}. `;
  paraSituation += phraseCapaciteFinanciere(infos.revenu_mensuel, infos.capital_disponible) + ' ';
  paraSituation += phraseSituationFamiliale(infos.situation_familiale, infos.nombre_enfants);
  paragraphes.push(paraSituation);

  let paraPourquoi = `<strong>${profile_type}</strong> (score ${score}/${max_score}). `;
  paraPourquoi += EXPLICATION_PROFIL[profile_type] + ' ';
  paraPourquoi += `Ce résultat s'explique notamment par les éléments suivants : vous nous avez indiqué un horizon de placement de « ${horizonLabel} », une expérience « ${experienceLabel} » des marchés, et vous nous avez dit qu'en cas de baisse de 15% de votre portefeuille, votre réaction serait : « ${reactionLabel} ». Votre objectif principal exprimé est : « ${objectifLabel} ».`;
  if (liquiditeLabel) {
    paraPourquoi += ` Vous nous avez également précisé, concernant un besoin de liquidité à 12 mois : « ${liquiditeLabel} », un élément que nous avons intégré dans notre analyse de votre capacité réelle à immobiliser ce capital.`;
  }
  paragraphes.push(paraPourquoi);

  let paraReco = `<strong>Nos recommandations pour vous :</strong><br>`;
  paraReco += `Allocation suggérée : ${reco.allocation}<br>`;
  paraReco += `Rendement annuel moyen visé : ${(reco.taux_rendement_estime * 100).toFixed(0)}% (estimation à titre indicatif, non garantie, propre au marché BRVM).<br>`;
  paraReco += `Conseil TAPA CONSEIL : ${reco.conseil}`;
  paragraphes.push(paraReco);

  paragraphes.push(`<strong>Prochaine étape :</strong> rendez-vous dans votre espace client pour définir votre plan d'investissement (montant, objectif chiffré et horizon). Nous vérifierons ensemble si cet objectif est réaliste compte tenu de votre capacité d'épargne, et nous vous proposerons un ajustement si nécessaire. Une fois votre plan validé, vous recevrez chaque semaine deux études de titres cotés à la BRVM, ainsi qu'une analyse complète de votre portefeuille chaque mois.`);
  paragraphes.push(`Nous restons à votre disposition pour toute question.<br><br>L'équipe TAPA CONSEIL`);

  return paragraphes;
}

module.exports = { genererAnalyseRedigee };
