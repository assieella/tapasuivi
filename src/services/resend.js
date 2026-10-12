// Service de notification en masse via Resend — séparé du système d'email transactionnel
// existant (contrat, mot de passe oublié...), pour ne jamais risquer de casser ce qui
// fonctionne déjà. Utilisé uniquement pour prévenir les clients qu'un nouveau contenu
// (étude, actualité, article de blog) est disponible sur leur espace.

const EXPEDITEUR = 'TAPA CONSEIL <contact@tapaconseilagence.com>';

// Envoie une notification à une liste d'emails — jamais bloquant : un échec sur un seul
// destinataire n'empêche jamais les autres de recevoir la leur, ni ne fait planter l'action
// de publication qui a déclenché l'envoi.
async function notifierNouveauContenu({ destinataires, sujet, titre, texte, lien, texteBouton }) {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY non configurée — notification ignorée.');
    return { envoyees: 0, echecs: destinataires.length };
  }

  let envoyees = 0;
  let echecs = 0;

  for (const email of destinataires) {
    try {
      const reponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: EXPEDITEUR,
          to: email,
          subject: sujet,
          html: `
            <div style="font-family: Georgia, serif; max-width:600px; margin:auto; color:#1C2733; line-height:1.6;">
              <h2 style="color:#0F2F59;">${titre}</h2>
              <p>${texte}</p>
              <p><a href="${lien}" style="background:#0F2F59; color:white; padding:10px 20px; text-decoration:none; border-radius:6px; display:inline-block;">${texteBouton || 'Voir dans mon espace'}</a></p>
              <p style="font-size:12px; color:#888; margin-top:20px;">TAPA CONSEIL — Beyond the limit</p>
            </div>
          `
        })
      });
      if (reponse.ok) envoyees++; else echecs++;
    } catch (e) {
      console.error(`Échec de la notification Resend pour ${email} :`, e.message);
      echecs++;
    }
  }

  return { envoyees, echecs };
}

// Envoie un email à une seule personne — utilisé pour la confirmation d'email à l'inscription.
// Ne bloque jamais l'action qui l'a déclenchée en cas d'échec (le compte reste créé même si
// l'email ne part pas, la personne peut toujours redemander le lien plus tard).
async function envoyerEmailUnique({ destinataire, sujet, titre, texte, lien, texteBouton }) {
  const html = `
          <div style="font-family: Georgia, serif; max-width:600px; margin:auto; color:#1C2733; line-height:1.6;">
            <h2 style="color:#0F2F59;">${titre}</h2>
            <p>${texte}</p>
            <p><a href="${lien}" style="background:#0F2F59; color:white; padding:10px 20px; text-decoration:none; border-radius:6px; display:inline-block;">${texteBouton || 'Voir dans mon espace'}</a></p>
            <p style="font-size:12px; color:#888; margin-top:20px;">TAPA CONSEIL — Beyond the limit</p>
          </div>`;

  // 1) Resend en premier — avec le motif exact de l'échec écrit dans les logs (avant, il était avalé).
  if (!process.env.RESEND_API_KEY) {
    console.error('[EMAIL] RESEND_API_KEY non configurée — bascule sur SMTP.');
  } else {
    try {
      const reponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: EXPEDITEUR, to: destinataire, subject: sujet, html })
      });
      if (reponse.ok) { console.log(`[EMAIL] Resend OK -> ${destinataire}`); return { succes: true, via: 'resend' }; }
      const corps = await reponse.text().catch(() => '');
      console.error(`[EMAIL] Resend REFUSÉ (${reponse.status}) pour ${destinataire} : ${corps.slice(0, 400)} — bascule sur SMTP.`);
    } catch (e) {
      console.error(`[EMAIL] Resend erreur réseau pour ${destinataire} : ${e.message} — bascule sur SMTP.`);
    }
  }

  // 2) Repli : le SMTP déjà utilisé pour le mot de passe oublié et le contrat.
  try {
    const { sendMail } = require('./email');
    const r = await sendMail({ to: destinataire, subject: sujet, html });
    if (r && r.skipped) { console.error('[EMAIL] SMTP non configuré — aucun email envoyé.'); return { succes: false }; }
    console.log(`[EMAIL] SMTP OK -> ${destinataire}`);
    return { succes: true, via: 'smtp' };
  } catch (e) {
    console.error(`[EMAIL] SMTP ÉCHEC pour ${destinataire} : ${e.message}`);
    return { succes: false };
  }
}

module.exports = { notifierNouveauContenu, envoyerEmailUnique };
