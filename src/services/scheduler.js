const pool = require('../db');
const { messageAleatoire } = require('../data/messages-automatiques');
const { STRATEGIES } = require('../data/strategies');
const { sendMail } = require('./email');
const { computeProgrammeStatus } = require('./programme');
const { construireBilanHtml } = require('./bilan');
const { calculerPositions, calculerMontantNetInvesti } = require('./portefeuille');
const { genererAnalysePortefeuille } = require('./analysePortefeuille');

const INTERVALLE_VERIFICATION_MS = 6 * 60 * 60 * 1000;
const DELAI_ENTRE_MESSAGES_JOURS = 7;
const JOUR_SUGGESTIONS_MENSUELLES = 25;

async function envoyerMessagesAutomatiquesDus() {
  try {
    const clients = await pool.query(`
      SELECT u.id, u.full_name, u.email,
        (SELECT MAX(created_at) FROM messages m WHERE m.client_id = u.id AND m.sender = 'systeme') AS dernier_message_auto
      FROM users u WHERE u.role = 'client'
    `);
    for (const client of clients.rows) {
      const jamaisEnvoye = !client.dernier_message_auto;
      const delaiEcoule = client.dernier_message_auto &&
        (Date.now() - new Date(client.dernier_message_auto).getTime()) > DELAI_ENTRE_MESSAGES_JOURS * 24 * 60 * 60 * 1000;
      if (jamaisEnvoye || delaiEcoule) {
        const contenu = messageAleatoire();
        await pool.query(`INSERT INTO messages (client_id, sender, contenu, lu_par_client) VALUES ($1, 'systeme', $2, false)`, [client.id, contenu]);
        await sendMail({
          to: client.email, subject: 'Un petit message de TAPA CONSEIL',
          html: `<div style="font-family: Arial, sans-serif; max-width:500px; margin:auto;"><p>${contenu}</p><p style="font-size:12px; color:#888;">Répondez directement depuis votre espace client TAPA CONSEIL.</p></div>`
        });
      }
    }
  } catch (err) { console.error('Erreur lors de l\'envoi des messages automatiques :', err.message); }
}

async function genererSuggestionsMensuelles() {
  const maintenant = new Date();
  if (maintenant.getDate() < JOUR_SUGGESTIONS_MENSUELLES) return;
  try {
    const plans = await pool.query(`
      SELECT DISTINCT ON (pl.user_id) pl.id, pl.user_id, pl.strategie, pl.dernieres_suggestions_le, u.full_name, u.email
      FROM investment_plans pl JOIN users u ON u.id = pl.user_id
      WHERE pl.strategie IS NOT NULL ORDER BY pl.user_id, pl.created_at DESC
    `);
    for (const plan of plans.rows) {
      const dejaEnvoyeCeMois = plan.dernieres_suggestions_le &&
        new Date(plan.dernieres_suggestions_le).getMonth() === maintenant.getMonth() &&
        new Date(plan.dernieres_suggestions_le).getFullYear() === maintenant.getFullYear();
      if (dejaEnvoyeCeMois) continue;
      const strategieInfo = STRATEGIES[plan.strategie];
      if (!strategieInfo) continue;
      const candidats = await pool.query(`
        SELECT t.ticker, t.nom, c.cours, c.variation_pct FROM titres_brvm t
        JOIN LATERAL (SELECT cours, variation_pct FROM cours_quotidiens cq WHERE cq.ticker = t.ticker ORDER BY date_cours DESC LIMIT 1) c ON true
        WHERE t.secteur = ANY($1) ORDER BY RANDOM() LIMIT 3
      `, [strategieInfo.secteurs]);
      if (!candidats.rows.length) continue;
      const listeHtml = candidats.rows.map(c => `<li><strong>${c.ticker}</strong> — ${c.nom} (${Number(c.cours).toLocaleString('fr-FR')} FCFA, ${c.variation_pct > 0 ? '+' : ''}${c.variation_pct}%)</li>`).join('');
      const listeTexte = candidats.rows.map(c => `${c.ticker} (${c.nom})`).join(', ');
      const contenuMessage = `Bonjour ! Comme chaque fin de mois, voici quelques suggestions de titres en lien avec votre stratégie "${strategieInfo.nom}" : ${listeTexte}. Ce sont des pistes de réflexion, pas une recommandation ferme — n'hésitez pas à nous écrire pour en discuter avant toute décision.`;
      await pool.query(`INSERT INTO messages (client_id, sender, contenu, lu_par_client) VALUES ($1, 'systeme', $2, false)`, [plan.user_id, contenuMessage]);
      await sendMail({
        to: plan.email, subject: `Vos suggestions de titres du mois — stratégie ${strategieInfo.nom}`,
        html: `<div style="font-family: Georgia, serif; max-width:600px; margin:auto; color:#1C2733; line-height:1.6;"><h2 style="color:#0F2F59;">Bonjour ${plan.full_name},</h2><p>Voici vos suggestions de titres BRVM pour ce mois, en cohérence avec votre stratégie <strong>${strategieInfo.nom}</strong> :</p><ul>${listeHtml}</ul><p style="font-size:13px; color:#666;">Ces suggestions sont des pistes de réflexion basées sur votre stratégie, pas des recommandations d'achat fermes. Chaque décision d'investissement reste la vôtre — écrivez-nous si vous voulez en discuter avant d'agir.</p><p style="margin-top:20px; font-size:12px; color:#888;">TAPA CONSEIL — Beyond the limit</p></div>`
      });
      await pool.query('UPDATE investment_plans SET dernieres_suggestions_le = CURRENT_DATE WHERE id = $1', [plan.id]);
    }
  } catch (err) { console.error('Erreur lors de la génération des suggestions mensuelles :', err.message); }
}

function demarrerPlanificateur() {
  setTimeout(envoyerMessagesAutomatiquesDus, 60 * 1000);
  setTimeout(genererSuggestionsMensuelles, 90 * 1000);
  setTimeout(envoyerRappelsAppelMensuel, 120 * 1000);
  setTimeout(envoyerBilansFinProgramme, 150 * 1000);
  setTimeout(genererAnalysesPortefeuilleMensuelles, 180 * 1000);
  setInterval(envoyerMessagesAutomatiquesDus, INTERVALLE_VERIFICATION_MS);
  setInterval(genererSuggestionsMensuelles, INTERVALLE_VERIFICATION_MS);
  setInterval(envoyerRappelsAppelMensuel, INTERVALLE_VERIFICATION_MS);
  setInterval(envoyerBilansFinProgramme, INTERVALLE_VERIFICATION_MS);
  setInterval(genererAnalysesPortefeuilleMensuelles, INTERVALLE_VERIFICATION_MS);
}

// Rappelle l'appel collectif mensuel à tous les clients actifs, la veille de l'appel.
async function envoyerRappelsAppelMensuel() {
  try {
    const demain = new Date();
    demain.setDate(demain.getDate() + 1);
    const debutDemain = new Date(demain.setHours(0, 0, 0, 0));
    const finDemain = new Date(demain.setHours(23, 59, 59, 999));

    const appels = await pool.query(
      `SELECT * FROM appels_mensuels WHERE date_appel BETWEEN $1 AND $2 AND rappel_envoye = false`,
      [debutDemain, finDemain]
    );
    if (!appels.rows.length) return;

    const clients = await pool.query(`SELECT id, full_name, email, created_at, programme FROM users WHERE role = 'client'`);

    for (const appel of appels.rows) {
      const heureAppel = new Date(appel.date_appel).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
      for (const client of clients.rows) {
        const statut = computeProgrammeStatus(client);
        if (statut.termine) continue;

        const contenu = `📞 Rappel : notre appel collectif mensuel a lieu demain, ${heureAppel}${appel.plateforme ? ' sur ' + appel.plateforme : ''}.${appel.lien ? ' Lien : ' + appel.lien : ''}`;
        await pool.query(`INSERT INTO messages (client_id, sender, contenu, lu_par_client) VALUES ($1, 'systeme', $2, false)`, [client.id, contenu]);
        await sendMail({
          to: client.email,
          subject: 'Rappel — appel collectif TAPA INVEST demain',
          html: `<div style="font-family: Arial, sans-serif; max-width:500px; margin:auto;"><p>${contenu}</p>${appel.notes ? `<p style="color:#666; font-size:14px;">${appel.notes}</p>` : ''}</div>`
        });
      }
      await pool.query('UPDATE appels_mensuels SET rappel_envoye = true WHERE id = $1', [appel.id]);
    }
  } catch (err) { console.error('Erreur lors de l\'envoi des rappels d\'appel mensuel :', err.message); }
}

// Envoie le bilan de fin de programme (une seule fois) dès qu'un client atteint la fin de son accompagnement.
async function envoyerBilansFinProgramme() {
  try {
    const clients = await pool.query(`
      SELECT u.id, u.full_name, u.prenom, u.email, u.created_at, u.programme
      FROM users u
      LEFT JOIN bilans_envoyes b ON b.user_id = u.id
      WHERE u.role = 'client' AND b.user_id IS NULL
    `);

    for (const client of clients.rows) {
      const statut = computeProgrammeStatus(client);
      if (!statut.termine) continue;

      const profileResult = await pool.query('SELECT profile_type FROM investor_profiles WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [client.id]);
      const planResult = await pool.query('SELECT strategie FROM investment_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [client.id]);
      const formationResult = await pool.query('SELECT COUNT(*) FILTER (WHERE reussi) AS reussis FROM progression_formation WHERE user_id = $1', [client.id]);
      const totalModulesResult = await pool.query('SELECT COUNT(*) FROM modules_formation WHERE actif = true');
      const messagesResult = await pool.query('SELECT COUNT(*) FROM messages WHERE client_id = $1', [client.id]);

      const html = construireBilanHtml({
        prenom: client.prenom,
        full_name: client.full_name,
        mois: statut.mois,
        profile: profileResult.rows[0] || null,
        plan: planResult.rows[0] || null,
        modulesReussis: Number(formationResult.rows[0]?.reussis || 0),
        totalModules: Number(totalModulesResult.rows[0]?.count || 0),
        nombreMessages: Number(messagesResult.rows[0]?.count || 0)
      });

      await sendMail({ to: client.email, subject: 'Votre bilan TAPA INVEST — merci pour votre confiance', html });
      await pool.query('INSERT INTO bilans_envoyes (user_id) VALUES ($1)', [client.id]);
    }
  } catch (err) { console.error('Erreur lors de l\'envoi des bilans de fin de programme :', err.message); }
}

// Génère, dans les 5 premiers jours du mois, un brouillon d'analyse pour chaque client
// ayant au moins une transaction — ce brouillon attend la validation d'Ella avant envoi.
const JOUR_LIMITE_GENERATION_ANALYSES = 5;

async function genererAnalysesPortefeuilleMensuelles() {
  const maintenant = new Date();
  if (maintenant.getDate() > JOUR_LIMITE_GENERATION_ANALYSES) return;

  const moisCourant = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1).toISOString().slice(0, 10);

  try {
    const clients = await pool.query(`SELECT id, full_name, prenom, created_at, programme FROM users WHERE role = 'client'`);

    for (const client of clients.rows) {
      const statut = computeProgrammeStatus(client);
      if (statut.termine) continue;

      const dejaGeneree = await pool.query('SELECT 1 FROM analyses_portefeuille WHERE user_id = $1 AND mois = $2', [client.id, moisCourant]);
      if (dejaGeneree.rows.length) continue;

      const transactions = await pool.query('SELECT * FROM portefeuille_transactions WHERE user_id = $1', [client.id]);
      if (!transactions.rows.length) continue;

      const coursResult = await pool.query(`SELECT DISTINCT ON (ticker) ticker, cours FROM cours_quotidiens ORDER BY ticker, date_cours DESC`);
      const coursParTicker = Object.fromEntries(coursResult.rows.map(r => [r.ticker, r]));
      const positions = calculerPositions(transactions.rows, coursParTicker);
      const valeurTotale = positions.reduce((s, p) => s + (p.valeur_actuelle || 0), 0);
      const montantNetInvesti = calculerMontantNetInvesti(transactions.rows);

      const secteursResult = await pool.query('SELECT ticker, secteur FROM titres_brvm');
      const secteursParTicker = Object.fromEntries(secteursResult.rows.map(r => [r.ticker, r.secteur]));

      const planResult = await pool.query('SELECT strategie, objectif_montant FROM investment_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [client.id]);
      const plan = planResult.rows[0] || {};

      const paragraphes = genererAnalysePortefeuille({
        prenom: client.prenom, full_name: client.full_name,
        positions, valeurTotale, montantNetInvesti,
        strategie: plan.strategie, objectifMontant: plan.objectif_montant,
        secteursParTicker
      });
      const contenuHtml = paragraphes.map(p => `<p>${p}</p>`).join('');

      await pool.query(
        `INSERT INTO analyses_portefeuille (user_id, mois, contenu, valide, envoyee) VALUES ($1, $2, $3, false, false)`,
        [client.id, moisCourant, contenuHtml]
      );
    }
  } catch (err) { console.error('Erreur lors de la génération des analyses de portefeuille :', err.message); }
}

module.exports = { demarrerPlanificateur, envoyerMessagesAutomatiquesDus, genererSuggestionsMensuelles, envoyerRappelsAppelMensuel, envoyerBilansFinProgramme, genererAnalysesPortefeuilleMensuelles };
