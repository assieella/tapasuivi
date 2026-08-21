const { STRATEGIES } = require('../data/strategies');

function formatMontant(n) {
  return Number(n).toLocaleString('fr-FR') + ' FCFA';
}

// Génère un brouillon d'analyse pédagogique, que Ella relit et ajuste avant envoi.
// Ne se contente jamais d'un chiffre brut : explique ce qu'il signifie pour le client.
function genererAnalysePortefeuille({ prenom, full_name, positions, valeurTotale, montantNetInvesti, strategie, objectifMontant, secteursParTicker }) {
  const nomAffiche = prenom || full_name;
  const paragraphes = [];

  paragraphes.push(`Bonjour ${nomAffiche},`);

  if (!positions.length) {
    paragraphes.push(`Vous n'avez pas encore enregistré d'achat dans votre espace ce mois-ci. N'hésitez pas à saisir vos investissements dès que vous passez un ordre — c'est ce qui nous permet de vous accompagner concrètement.`);
    return paragraphes;
  }

  // Performance globale
  const performance = montantNetInvesti > 0 ? Math.round(((valeurTotale - montantNetInvesti) / montantNetInvesti) * 10000) / 100 : 0;
  let paraPerf = `Voici la lecture de votre portefeuille ce mois-ci. Vous avez investi <strong>${formatMontant(montantNetInvesti)}</strong> au total, pour une valeur actuelle de <strong>${formatMontant(valeurTotale)}</strong>`;
  paraPerf += performance >= 0
    ? `, soit une performance de <strong>+${performance}%</strong>. C'est encourageant — gardez à l'esprit que la Bourse évolue par cycles, et qu'une performance positive sur quelques mois ne préjuge pas de l'avenir.`
    : `, soit une performance de <strong>${performance}%</strong>. Une baisse temporaire fait partie du jeu en Bourse ; ce qui compte est de rester cohérent avec votre horizon de placement plutôt que de réagir à chaud.`;
  paragraphes.push(paraPerf);

  // Diversification
  const nbTitres = positions.length;
  const secteursDetenus = new Set(positions.map(p => secteursParTicker[p.ticker]).filter(Boolean));
  let paraDiv = `Votre portefeuille est composé de <strong>${nbTitres} titre${nbTitres > 1 ? 's' : ''}</strong>`;
  if (secteursDetenus.size) paraDiv += `, répartis sur <strong>${secteursDetenus.size} secteur${secteursDetenus.size > 1 ? 's' : ''}</strong>`;
  if (nbTitres === 1) {
    paraDiv += `. Concentrer son épargne sur un seul titre augmente le risque : si cette entreprise traverse une difficulté, tout votre portefeuille en ressent l'effet. Envisager d'ajouter 2 à 3 titres d'autres secteurs pourrait mieux répartir ce risque.`;
  } else if (secteursDetenus.size <= 1) {
    paraDiv += `. Vos titres appartiennent au même secteur : une bonne diversification consiste aussi à répartir entre plusieurs secteurs, pas seulement entre plusieurs entreprises.`;
  } else {
    paraDiv += `. C'est une diversification saine, qui limite votre dépendance à un seul secteur de l'économie.`;
  }
  paragraphes.push(paraDiv);

  // Concentration
  const poidsParTitre = positions.map(p => ({ ticker: p.ticker, poids: valeurTotale > 0 ? (p.valeur_actuelle || 0) / valeurTotale : 0 }));
  const plusGrosPoids = poidsParTitre.sort((a, b) => b.poids - a.poids)[0];
  if (plusGrosPoids && plusGrosPoids.poids > 0.5 && nbTitres > 1) {
    paragraphes.push(`À noter : <strong>${plusGrosPoids.ticker}</strong> représente à lui seul plus de la moitié de la valeur de votre portefeuille (${Math.round(plusGrosPoids.poids * 100)}%). C'est un point de vigilance si vous souhaitez limiter votre exposition à une seule entreprise.`);
  }

  // Cohérence avec la stratégie
  if (strategie && STRATEGIES[strategie]) {
    const secteursStrategie = STRATEGIES[strategie].secteurs;
    const valeurCoherente = positions.reduce((somme, p) => {
      const secteur = secteursParTicker[p.ticker];
      return secteur && secteursStrategie.includes(secteur) ? somme + (p.valeur_actuelle || 0) : somme;
    }, 0);
    const pctCoherent = valeurTotale > 0 ? Math.round((valeurCoherente / valeurTotale) * 100) : 0;
    paragraphes.push(`Par rapport à votre stratégie <strong>${STRATEGIES[strategie].nom}</strong>, environ <strong>${pctCoherent}%</strong> de votre portefeuille est investi dans des secteurs cohérents avec cette orientation. ${pctCoherent < 50 ? "Vous pourriez orienter vos prochains achats davantage vers cette stratégie pour rester aligné avec votre plan." : "Vous restez globalement fidèle à votre stratégie de départ, ce qui est une bonne pratique."}`);
  }

  // Écart à l'objectif
  if (objectifMontant) {
    const pctObjectif = Math.round((valeurTotale / objectifMontant) * 100);
    paragraphes.push(`Vous êtes actuellement à <strong>${pctObjectif}%</strong> de votre objectif de ${formatMontant(objectifMontant)}. ${pctObjectif < 100 ? "Continuez vos versements réguliers : c'est la régularité, plus que les montants ponctuels, qui fait la différence sur la durée." : "Félicitations, vous avez atteint votre objectif initial — c'est le bon moment pour en définir un nouveau avec votre conseillère."}`);
  }

  paragraphes.push(`N'hésitez pas à nous écrire si vous avez des questions sur cette analyse.<br><br>L'équipe TAPA CONSEIL`);

  return paragraphes;
}

module.exports = { genererAnalysePortefeuille };
