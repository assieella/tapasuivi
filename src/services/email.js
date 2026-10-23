const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Sans ces délais, une connexion SMTP qui ne répond pas peut bloquer la page indéfiniment
    // (plusieurs minutes) sans jamais échouer ni réussir — on préfère un échec rapide et clair.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

// Envoi d'un email. Resend (par internet, HTTPS) passe en premier : Railway bloque ou ralentit
// les connexions SMTP vers l'extérieur (« Connection timeout »). Le SMTP ne sert plus que de repli.
// Lève une erreur si aucun des deux ne réussit, pour que les appelants (bilans, rapports) réessaient plus tard.
const EXPEDITEUR_RESEND = 'TAPA CONSEIL <contact@tapaconseilagence.com>';

async function envoyerParResend({ to, subject, html }) {
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), 15000);
  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EXPEDITEUR_RESEND, to, subject, html }),
      signal: controle.signal
    });
    if (reponse.ok) return;
    const corps = await reponse.text().catch(() => '');
    throw new Error(`Resend a refusé l'envoi (${reponse.status}) : ${corps.slice(0, 300)}`);
  } finally { clearTimeout(minuterie); }
}

async function sendMail({ to, subject, html }) {
  let erreurResend = null;
  if (process.env.RESEND_API_KEY) {
    try { await envoyerParResend({ to, subject, html }); return { via: 'resend' }; }
    catch (e) { erreurResend = e; console.error(`[EMAIL] Resend en échec pour ${to} : ${e.message}${process.env.SMTP_HOST ? ' — repli sur SMTP.' : ''}`); }
  }
  if (!process.env.SMTP_HOST) {
    if (erreurResend) throw erreurResend;
    console.log(`[EMAIL non envoyé - ni Resend ni SMTP configuré] À: ${to} | Sujet: ${subject}`);
    return { skipped: true };
  }
  const transporter = getTransporter();
  return transporter.sendMail({ from: process.env.SMTP_FROM || '"TAPA CONSEIL" <no-reply@tapaconseil.com>', to, subject, html });
}

function emailProfilInvestisseur({ full_name, prenom, infos, answers, profile_type, score, max_score, reco }) {
  const { genererAnalyseRedigee } = require('./analyse');
  const paragraphes = genererAnalyseRedigee({ full_name, prenom, infos, answers, profile_type, score, max_score, reco });
  const logoUrl = `${require('./appUrl').appUrl()}/images/logo.png`;
  return {
    subject: `Votre analyse de profil investisseur — ${profile_type}`,
    html: `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 640px; margin: auto; color: #1C2733; line-height: 1.6;">
        <div style="background:#0F2F59; padding:20px 24px; border-radius:8px 8px 0 0; text-align:center;">
          ${logoUrl ? `<img src="${logoUrl}" alt="TAPA CONSEIL" style="height:56px; margin-bottom:8px;"><br>` : `<h2 style="color:white; margin:0;">TAPA CONSEIL</h2>`}
          <p style="color:#DAAA37; margin:4px 0 0 0; font-size:13px; letter-spacing:0.5px; text-transform:uppercase;">Votre analyse de profil investisseur</p>
        </div>
        <div style="border:1px solid #E1E5EC; border-top:none; padding:28px 24px; border-radius:0 0 8px 8px;">
          ${paragraphes.map(p => `<p style="margin:0 0 16px 0;">${p}</p>`).join('')}
        </div>
        <p style="margin-top:20px; font-size:12px; color:#888; text-align:center;">TAPA CONSEIL — Beyond the limit</p>
      </div>
    `
  };
}

function emailPlanInvestissement({ full_name, plan, correction, strategieInfo }) {
  const statutTexte = plan.objectif_realiste ? "Bonne nouvelle : votre objectif est réaliste avec ces paramètres." : "Votre objectif initial nécessite un ajustement pour rester réaliste.";
  const logoUrl = `${require('./appUrl').appUrl()}/images/logo.png`;
  let correctionHtml = '';
  if (!plan.objectif_realiste && correction) {
    correctionHtml = `
      <div style="background:#FCF3DC; border-left:4px solid #DAAA37; padding:12px 16px; margin:16px 0;">
        <p style="margin:0 0 8px 0;"><strong>Ajustement recommandé :</strong></p>
        <p style="margin:0;">Pour atteindre votre objectif au même horizon, portez votre versement mensuel à environ
        <strong>${correction.versement_recommande?.toLocaleString('fr-FR')} FCFA</strong>.</p>
        <p style="margin:8px 0 0 0;">Ou, en gardant le même versement mensuel, l'objectif serait atteignable en environ
        <strong>${correction.horizon_recommande_mois ? Math.ceil(correction.horizon_recommande_mois / 12) + ' ans' : 'un horizon plus long que 40 ans'}</strong>.</p>
      </div>
    `;
  }
  return {
    subject: `Votre plan d'investissement — analyse`,
    html: `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 640px; margin: auto; color: #1C2733; line-height: 1.6;">
        <div style="background:#0F2F59; padding:20px 24px; border-radius:8px 8px 0 0; text-align:center;">
          ${logoUrl ? `<img src="${logoUrl}" alt="TAPA CONSEIL" style="height:56px; margin-bottom:8px;"><br>` : `<h2 style="color:white; margin:0;">TAPA CONSEIL</h2>`}
          <p style="color:#DAAA37; margin:4px 0 0 0; font-size:13px; letter-spacing:0.5px; text-transform:uppercase;">Votre plan d'investissement</p>
        </div>
        <div style="border:1px solid #E1E5EC; border-top:none; padding:28px 24px; border-radius:0 0 8px 8px;">
          <p>Bonjour ${full_name},</p>
          <p>Voici l'analyse de votre plan d'investissement :</p>
          ${strategieInfo ? `<p><strong>Stratégie choisie : ${strategieInfo.nom}</strong><br>${strategieInfo.description}</p>` : ''}
          <ul>
            <li>Objectif : <strong>${Number(plan.objectif_montant).toLocaleString('fr-FR')} FCFA</strong></li>
            <li>Horizon : <strong>${Math.round(plan.horizon_mois / 12)} ans</strong></li>
            <li>Montant initial : <strong>${Number(plan.montant_initial).toLocaleString('fr-FR')} FCFA</strong></li>
            <li>Versement mensuel : <strong>${Number(plan.versement_mensuel).toLocaleString('fr-FR')} FCFA</strong></li>
            <li>Montant projeté à l'horizon : <strong>${plan.montant_projete.toLocaleString('fr-FR')} FCFA</strong></li>
          </ul>
          <p>${statutTexte}</p>
          ${correctionHtml}
          <p>Vous recevrez chaque semaine 2 études de titres BRVM, et une analyse complète de votre portefeuille chaque mois.</p>
        </div>
        <p style="margin-top:20px; font-size:12px; color:#888; text-align:center;">TAPA CONSEIL — Beyond the limit</p>
      </div>
    `
  };
}

module.exports = { sendMail, emailProfilInvestisseur, emailPlanInvestissement };
