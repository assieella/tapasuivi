// Génère le bilan envoyé automatiquement à un client quand son programme se termine,
// avec une invitation à renouveler. Envoyé uniquement par email : à ce stade le client
// est déjà verrouillé hors de son espace, l'email est le seul canal fiable qui reste.

function construireBilanHtml({ prenom, full_name, mois, profile, plan, modulesReussis, totalModules, nombreMessages }) {
  const nomAffiche = prenom || full_name;
  const logoUrl = process.env.APP_URL ? `${process.env.APP_URL}/images/logo.png` : null;
  const lienRenouvellement = `https://wa.me/2250504775774?text=${encodeURIComponent("Bonjour, je voudrais renouveler mon accompagnement TAPA INVEST.")}`;

  return `
    <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 640px; margin: auto; color: #1C2733; line-height: 1.6;">
      <div style="background:#0F2F59; padding:20px 24px; border-radius:8px 8px 0 0; text-align:center;">
        ${logoUrl ? `<img src="${logoUrl}" alt="TAPA CONSEIL" style="height:56px; margin-bottom:8px;"><br>` : `<h2 style="color:white; margin:0;">TAPA CONSEIL</h2>`}
        <p style="color:#DAAA37; margin:4px 0 0 0; font-size:13px; letter-spacing:0.5px; text-transform:uppercase;">Bilan de votre accompagnement</p>
      </div>
      <div style="border:1px solid #E1E5EC; border-top:none; padding:28px 24px; border-radius:0 0 8px 8px;">
        <p>Bonjour ${nomAffiche},</p>
        <p>Votre accompagnement TAPA INVEST de ${mois} mois se termine aujourd'hui. Merci de nous avoir fait confiance — voici un récapitulatif de votre parcours :</p>
        <ul>
          ${profile ? `<li>Profil investisseur : <strong>${profile.profile_type}</strong></li>` : ''}
          ${plan?.strategie ? `<li>Stratégie suivie : <strong>${plan.strategie.charAt(0).toUpperCase() + plan.strategie.slice(1)}</strong></li>` : ''}
          <li>Modules de formation validés : <strong>${modulesReussis} / ${totalModules}</strong></li>
          <li>Échanges avec votre conseillère : <strong>${nombreMessages}</strong> message(s)</li>
        </ul>
        <p>L'investissement est un exercice de régularité et de patience — continuer votre accompagnement est le meilleur moyen de rester sur la bonne trajectoire, avec des études de titres, des suggestions mensuelles et l'appel collectif chaque mois.</p>
        <p style="text-align:center; margin:28px 0;">
          <a href="${lienRenouvellement}" style="display:inline-block; background:#DAAA37; color:#081b36; text-decoration:none; font-weight:700; padding:14px 28px; border-radius:40px;">Renouveler mon accompagnement</a>
        </p>
        <p>Nous restons à votre disposition pour toute question.<br><br>L'équipe TAPA CONSEIL</p>
      </div>
      <p style="margin-top:20px; font-size:12px; color:#888; text-align:center;">TAPA CONSEIL — Beyond the limit</p>
    </div>
  `;
}

module.exports = { construireBilanHtml };
