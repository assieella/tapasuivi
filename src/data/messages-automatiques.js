const MESSAGES_AUTOMATIQUES = [
  "Bonjour 👋 Petit coucou de l'équipe TAPA CONSEIL ! Comment se passe votre semaine ? N'hésitez pas si vous avez des questions sur votre portefeuille.",
  "Bonjour ! Un petit rappel amical : c'est le bon moment pour jeter un œil à vos études de titres de la semaine 📈. On reste disponibles si besoin.",
  "Coucou 🙂 On voulait juste prendre de vos nouvelles. Tout se passe bien avec votre suivi BRVM ? Écrivez-nous si quelque chose n'est pas clair.",
  "Bonjour ! Petit rappel : pensez à votre versement mensuel si ce n'est pas encore fait. Chaque petit geste compte sur le long terme 💪",
  "Bonjour 👋 On espère que vous allez bien. Une question sur un titre en particulier ? On est là pour en discuter avec vous.",
  "Petit message du jour : investir demande de la patience, et vous êtes sur la bonne voie. Continuez comme ça ! On reste à votre écoute.",
  "Bonjour ! Avez-vous eu l'occasion de regarder l'évolution de votre portefeuille ce mois-ci ? N'hésitez pas à nous en parler.",
  "Coucou de l'équipe TAPA CONSEIL 🙂 Comment vous sentez-vous par rapport à vos investissements en ce moment ?"
];

function messageAleatoire() {
  return MESSAGES_AUTOMATIQUES[Math.floor(Math.random() * MESSAGES_AUTOMATIQUES.length)];
}

module.exports = { MESSAGES_AUTOMATIQUES, messageAleatoire };
