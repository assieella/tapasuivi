const { STRATEGIES, PROFILS_COMPATIBLES } = require('../data/strategies');

function formatMontant(n) {
  return Number(n).toLocaleString('fr-FR') + ' FCFA';
}

const SEUIL_CONCENTRATION_TITRE = 0.40; // au-delà, un seul titre pèse trop lourd
const SEUIL_CONCENTRATION_SECTEUR = 0.50; // au-delà, un seul secteur pèse trop lourd

// Vérifie la concentration d'un ensemble de positions (titre et secteur) — appelée au moment
// même de la saisie d'une transaction, pas seulement dans l'analyse mensuelle après coup.
// Retourne un tableau d'alertes (vide si tout va bien), jamais un blocage strict : le client
// reste libre de confirmer malgré l'avertissement.
function verifierConcentration(positions, secteursParTicker) {
  const valeurTotale = positions.reduce((s, p) => s + (p.valeur_actuelle || 0), 0);
  if (valeurTotale <= 0) return [];
  const alertes = [];

  const poidsParTitre = positions
    .map(p => ({ ticker: p.ticker, poids: (p.valeur_actuelle || 0) / valeurTotale }))
    .sort((a, b) => b.poids - a.poids);
  if (poidsParTitre[0] && poidsParTitre[0].poids > SEUIL_CONCENTRATION_TITRE) {
    alertes.push(`Après cette opération, <strong>${poidsParTitre[0].ticker}</strong> représenterait <strong>${Math.round(poidsParTitre[0].poids * 100)}%</strong> du portefeuille — une concentration élevée sur un seul titre.`);
  }

  const poidsParSecteur = {};
  for (const p of positions) {
    const secteur = secteursParTicker[p.ticker];
    if (!secteur) continue;
    poidsParSecteur[secteur] = (poidsParSecteur[secteur] || 0) + (p.valeur_actuelle || 0);
  }
  const secteurDominant = Object.entries(poidsParSecteur).sort((a, b) => b[1] - a[1])[0];
  if (secteurDominant && (secteurDominant[1] / valeurTotale) > SEUIL_CONCENTRATION_SECTEUR) {
    alertes.push(`Après cette opération, le secteur <strong>${secteurDominant[0]}</strong> représenterait <strong>${Math.round((secteurDominant[1] / valeurTotale) * 100)}%</strong> du portefeuille — peu de diversification entre secteurs.`);
  }

  return alertes;
}

// Graphique de trajectoire : compare "l'objectif" (ligne pointillée dorée, linéaire de 0 à
// l'objectif sur l'horizon prévu) au "rythme actuel" (ligne pleine, verte si ça mène à
// l'objectif ou au-delà, rouge sinon) — un calcul simple et honnête, cohérent avec le même
// raisonnement linéaire déjà utilisé dans le texte (pas une simulation de rendement composé,
// qui donnerait une fausse impression de précision).
function genererGraphiqueTrajectoire({ objectifMontant, horizonMois, rythmeMensuel, moisEcoules }) {
  if (!objectifMontant || !horizonMois || horizonMois <= 0) return '';
  const largeur = 600, hauteur = 220, marge = 42;
  const zoneL = largeur - 2 * marge, zoneH = hauteur - 2 * marge;
  const montantFinRythme = rythmeMensuel * horizonMois;
  const maxY = Math.max(objectifMontant, montantFinRythme, 1) * 1.15;

  const x = (mois) => marge + (mois / horizonMois) * zoneL;
  const y = (montant) => hauteur - marge - (montant / maxY) * zoneH;

  const enAvance = montantFinRythme >= objectifMontant;
  const couleurRythme = enAvance ? '#0B6E4F' : '#C0392B';
  let markerAujourdhui = '';
  if (moisEcoules > 0 && moisEcoules <= horizonMois) {
    markerAujourdhui = `<line x1="${x(moisEcoules)}" y1="${marge}" x2="${x(moisEcoules)}" y2="${hauteur - marge}" stroke="#BBB" stroke-dasharray="3,3" /><text x="${x(moisEcoules)}" y="${marge - 8}" font-size="10" fill="#999" text-anchor="middle">Aujourd'hui</text>`;
  }

  return `
    <svg viewBox="0 0 ${largeur} ${hauteur}" style="width:100%; max-width:560px; height:auto; background:white; border-radius:8px; margin:10px 0;">
      <line x1="${marge}" y1="${hauteur - marge}" x2="${largeur - marge}" y2="${hauteur - marge}" stroke="#E1E5EC" />
      <line x1="${marge}" y1="${marge}" x2="${marge}" y2="${hauteur - marge}" stroke="#E1E5EC" />
      <polyline points="${x(0)},${y(0)} ${x(horizonMois)},${y(objectifMontant)}" fill="none" stroke="#DAAA37" stroke-width="2" stroke-dasharray="6,4" />
      <polyline points="${x(0)},${y(0)} ${x(horizonMois)},${y(montantFinRythme)}" fill="none" stroke="${couleurRythme}" stroke-width="2.5" />
      ${markerAujourdhui}
      <circle cx="${x(horizonMois)}" cy="${y(objectifMontant)}" r="4" fill="#DAAA37" />
      <circle cx="${x(horizonMois)}" cy="${y(montantFinRythme)}" r="4" fill="${couleurRythme}" />
      <text x="${Math.max(marge, x(horizonMois) - 4)}" y="${y(objectifMontant) - 8}" font-size="10" fill="#B8891E" text-anchor="end">Objectif (${formatMontant(objectifMontant)})</text>
      <text x="${Math.max(marge, x(horizonMois) - 4)}" y="${y(montantFinRythme) + 14}" font-size="10" fill="${couleurRythme}" text-anchor="end">Votre rythme actuel</text>
    </svg>
  `;
}

// Calcule les éléments de cohérence du plan — utilisés à la fois pour un client qui démarre
// et pour un client qui a déjà un portefeuille. Toujours transparent sur le calcul, jamais
// une boîte noire : chaque point du score est explicable en une phrase.
function calculerCoherencePlan({ profileType, strategie, objectifMontant, horizonMois, versementMensuel, revenuMensuel, valeurActuelle, moisEcoules }) {
  const alertes = [];
  let scoreTotal = 0;
  let scoreMax = 0;

  // 1. Profil de risque vs stratégie choisie (30 points)
  if (profileType && strategie && STRATEGIES[strategie]) {
    scoreMax += 30;
    const compatibles = PROFILS_COMPATIBLES[strategie] || [];
    if (compatibles.includes(profileType)) {
      scoreTotal += 30;
    } else {
      alertes.push({ gravite: 'rouge', texte: `Votre profil de risque (<strong>${profileType}</strong>) et votre stratégie choisie (<strong>${STRATEGIES[strategie].nom}</strong>) ne sont pas alignés. Une stratégie plus cohérente avec un profil ${profileType} serait plutôt orientée ${compatibles.length ? compatibles.join(' ou ') : 'différemment'} — c'est à évoquer avec votre conseillère avant d'aller plus loin.` });
    }
  }

  // 2. Réalisme de l'objectif (40 points) — calcul linéaire simple, cohérent avec le reste.
  let rythmeMensuelProjete = null;
  if (objectifMontant && horizonMois) {
    scoreMax += 40;
    const moisEcoulesReel = Math.max(0, moisEcoules || 0);
    const moisRestants = Math.max(0, horizonMois - moisEcoulesReel);
    rythmeMensuelProjete = versementMensuel || (moisEcoulesReel > 0 ? valeurActuelle / moisEcoulesReel : 0);
    const montantProjeteFin = rythmeMensuelProjete * horizonMois;

    if (montantProjeteFin >= objectifMontant) {
      scoreTotal += 40;
    } else {
      const montantRestant = objectifMontant - valeurActuelle;
      const versementNecessaire = moisRestants > 0 ? Math.round(montantRestant / moisRestants) : montantRestant;
      const ecartPct = objectifMontant > 0 ? (montantProjeteFin / objectifMontant) : 0;
      scoreTotal += Math.round(40 * Math.min(1, ecartPct)); // score partiel proportionnel à l'écart, jamais tout ou rien
      alertes.push({ gravite: 'rouge', texte: `Au rythme actuel (${formatMontant(rythmeMensuelProjete)}/mois), votre objectif de ${formatMontant(objectifMontant)} sur ${horizonMois} mois <strong>ne sera pas atteint</strong> — vous arriveriez plutôt autour de ${formatMontant(Math.round(montantProjeteFin))}. Pour l'atteindre, il faudrait investir environ <strong>${formatMontant(versementNecessaire)}/mois</strong>${moisRestants > 0 ? ` sur les ${moisRestants} mois restants` : ''}.` });
    }

    // 3. Le versement nécessaire est-il réaliste par rapport au revenu déclaré ? (info, pas de points retirés,
    // mais un vrai signal si le rythme nécessaire dépasse une part raisonnable du revenu mensuel)
    if (revenuMensuel && revenuMensuel > 0) {
      const rythmeAEvaluer = montantProjeteFin >= objectifMontant ? rythmeMensuelProjete : Math.round((objectifMontant - valeurActuelle) / Math.max(1, moisRestants));
      const partRevenu = rythmeAEvaluer / revenuMensuel;
      if (partRevenu > 0.4) {
        alertes.push({ gravite: 'orange', texte: `Le rythme d'investissement nécessaire (${formatMontant(Math.round(rythmeAEvaluer))}/mois) représente plus de <strong>${Math.round(partRevenu * 100)}%</strong> du revenu mensuel déclaré — un rythme aussi élevé est rarement tenable dans la durée. Mieux vaut revoir l'objectif ou l'horizon avec votre conseillère plutôt que de viser un montant intenable.` });
      }
    }
  }

  const scorePct = scoreMax > 0 ? Math.round((scoreTotal / scoreMax) * 100) : null;
  return { scorePct, alertes, rythmeMensuelProjete };
}

function blocCoherence({ scorePct, alertes, objectifMontant, horizonMois, rythmeMensuelProjete, moisEcoules }) {
  if (scorePct === null) return '';
  const couleurScore = scorePct >= 75 ? '#0B6E4F' : scorePct >= 50 ? '#B8891E' : '#C0392B';
  let html = `<div style="background:#F5F7FA; border-radius:10px; padding:16px; margin:10px 0;">`;
  html += `<p style="margin:0 0 8px; font-weight:700;">Score de cohérence de votre plan : <span style="color:${couleurScore}; font-size:20px;">${scorePct}/100</span></p>`;
  for (const a of alertes) {
    const couleur = a.gravite === 'rouge' ? '#C0392B' : '#B8891E';
    html += `<p style="color:${couleur}; font-weight:600; margin:8px 0;">⚠️ ${a.texte}</p>`;
  }
  if (!alertes.length) html += `<p style="color:#0B6E4F; margin:8px 0;">✅ Votre profil, votre stratégie et votre objectif sont cohérents entre eux.</p>`;
  if (objectifMontant && horizonMois) {
    html += genererGraphiqueTrajectoire({ objectifMontant, horizonMois, rythmeMensuel: rythmeMensuelProjete || 0, moisEcoules: moisEcoules || 0 });
  }
  html += `</div>`;
  return html;
}

// Génère un brouillon d'analyse pédagogique, que Ella relit et ajuste avant envoi.
// Ne se contente jamais d'un chiffre brut : explique ce qu'il signifie pour le client.

// ---------------------------------------------------------------------------------------------
// Blocs d'analyse détaillée (tableau des positions, secteurs, anomalies, stress test, lecture
// par titre). Tout est calculé à partir des positions réelles — rien n'est inventé.
// ---------------------------------------------------------------------------------------------
const SEUIL_ANOMALIE_PRIX = 0.5; // écart > 50 % entre prix d'achat et cours actuel = donnée à vérifier

function signe(n) { return n > 0 ? '+' : ''; }
function pct1(n) { return (Math.round(n * 10) / 10).toString().replace('.', ',') + ' %'; }

// Détecte les achats dont le prix est très éloigné du cours actuel — le plus souvent une erreur
// de saisie (montant total saisi à la place du prix unitaire). Retourne les anomalies et, quand
// c'est possible, le scénario "le montant saisi était le total de l'opération".
function detecterAnomaliesPrix(transactions, positions) {
  const coursParTicker = Object.fromEntries(positions.filter(p => p.dernier_cours).map(p => [p.ticker, p.dernier_cours]));
  const anomalies = [];
  for (const t of (transactions || [])) {
    if (t.type !== 'achat') continue;
    const cours = coursParTicker[t.ticker];
    const prix = Number(t.prix_unitaire);
    const qte = Number(t.quantite);
    if (!cours || !(prix > 0)) continue;
    if (Math.abs(prix - cours) / cours > SEUIL_ANOMALIE_PRIX) {
      const parAction = qte > 1 ? prix / qte : null;
      const scenarioPossible = parAction !== null && Math.abs(parAction - cours) / cours <= SEUIL_ANOMALIE_PRIX;
      anomalies.push({ ticker: t.ticker, date: t.date_transaction, quantite: qte, prix, cours, scenarioPossible, prixCorrige: scenarioPossible ? Math.round(parAction) : null });
    }
  }
  return anomalies;
}

function blocAnomalies(anomalies) {
  if (!anomalies.length) return null;
  let html = `<div style="background:#FBEAEA; border-left:4px solid #C0392B; padding:12px 14px; border-radius:6px;"><strong>⚠️ Donnée à vérifier avant de lire la performance</strong><ul style="margin:8px 0 0 18px;">`;
  for (const a of anomalies) {
    html += `<li><strong>${a.ticker}</strong> : un achat est enregistré à <strong>${formatMontant(a.prix)}</strong> l'action, alors que le cours actuel est de <strong>${formatMontant(a.cours)}</strong>.`;
    if (a.scenarioPossible) html += ` S'il s'agit en réalité du <em>montant total</em> de l'opération pour ${a.quantite} actions, le prix par action serait d'environ <strong>${formatMontant(a.prixCorrige)}</strong>.`;
    html += ` Merci de corriger cette ligne dans « Mes transactions » : la performance ci-dessous est <strong>provisoire</strong> tant que ce n'est pas fait.</li>`;
  }
  return html + `</ul></div>`;
}

// Tableau position par position : valeur, poids, coût, gain/perte en FCFA et en %.
function blocTableauPositions(positions, valeurTotale, nomParTicker) {
  const lignes = positions
    .map(p => {
      const cout = p.prix_moyen_achat * p.quantite_detenue;
      const gain = p.plus_value;
      const pct = (gain !== null && gain !== undefined && cout > 0) ? (gain / cout) * 100 : null;
      return { ...p, cout, gain, pct, poids: valeurTotale > 0 ? ((p.valeur_actuelle || 0) / valeurTotale) * 100 : 0 };
    })
    .sort((a, b) => b.poids - a.poids);
  const coutTotal = lignes.reduce((s, l) => s + l.cout, 0);
  const gainTotal = lignes.reduce((s, l) => s + (l.gain || 0), 0);
  const pctTotal = coutTotal > 0 ? (gainTotal / coutTotal) * 100 : 0;
  const couleur = n => n > 0 ? '#0B6E4F' : (n < 0 ? '#C0392B' : '#555');
  const th = 'style="text-align:left; padding:6px 8px; border-bottom:2px solid #0F2F59; font-size:12px; color:#0F2F59; white-space:nowrap;"';
  const thr = 'style="text-align:right; padding:6px 8px; border-bottom:2px solid #0F2F59; font-size:12px; color:#0F2F59; white-space:nowrap;"';
  const td = 'style="padding:6px 8px; border-bottom:1px solid #E1E5EC; font-size:13px;"';
  const tdr = 'style="padding:6px 8px; border-bottom:1px solid #E1E5EC; font-size:13px; text-align:right; white-space:nowrap;"';
  let html = `<strong>Vos positions, titre par titre</strong><div style="overflow-x:auto;"><table style="border-collapse:collapse; width:100%; margin-top:8px;"><thead><tr><th ${th}>Titre</th><th ${thr}>Qté</th><th ${thr}>Prix moyen</th><th ${thr}>Cours</th><th ${thr}>Valeur</th><th ${thr}>Poids</th><th ${thr}>Gain / perte</th></tr></thead><tbody>`;
  for (const l of lignes) {
    const nom = nomParTicker[l.ticker];
    html += `<tr><td ${td}><strong>${l.ticker}</strong>${nom ? `<br><span style="font-size:11px; color:#777;">${nom}</span>` : ''}</td><td ${tdr}>${l.quantite_detenue}</td><td ${tdr}>${l.prix_moyen_achat.toLocaleString('fr-FR')}</td><td ${tdr}>${l.dernier_cours ? l.dernier_cours.toLocaleString('fr-FR') : '—'}</td><td ${tdr}>${l.valeur_actuelle !== null && l.valeur_actuelle !== undefined ? l.valeur_actuelle.toLocaleString('fr-FR') : '—'}</td><td ${tdr}>${pct1(l.poids)}</td><td ${tdr} ><span style="color:${couleur(l.gain || 0)}; font-weight:600;">${l.gain === null || l.gain === undefined ? '—' : `${signe(l.gain)}${l.gain.toLocaleString('fr-FR')} FCFA`}${l.pct !== null ? `<br><span style="font-size:11px;">${signe(l.pct)}${pct1(l.pct)}</span>` : ''}</span></td></tr>`;
  }
  html += `<tr><td ${td}><strong>Total</strong></td><td ${tdr}></td><td ${tdr}></td><td ${tdr}></td><td ${tdr}><strong>${valeurTotale.toLocaleString('fr-FR')}</strong></td><td ${tdr}><strong>100 %</strong></td><td ${tdr}><span style="color:${couleur(gainTotal)}; font-weight:700;">${signe(gainTotal)}${Math.round(gainTotal).toLocaleString('fr-FR')} FCFA<br><span style="font-size:11px;">${signe(pctTotal)}${pct1(pctTotal)}</span></span></td></tr>`;
  html += `</tbody></table></div><span style="font-size:11px; color:#777;">Gains et pertes calculés sur le prix moyen d'achat, hors frais, dividendes et fiscalité.</span>`;
  return html;
}

// Répartition par secteur en pourcentages, avec petites barres.
function blocSecteurs(positions, valeurTotale, secteursParTicker) {
  if (valeurTotale <= 0) return null;
  const parSecteur = {};
  for (const p of positions) {
    const sec = secteursParTicker[p.ticker] || 'Secteur non renseigné';
    parSecteur[sec] = (parSecteur[sec] || 0) + (p.valeur_actuelle || 0);
  }
  const lignes = Object.entries(parSecteur).sort((a, b) => b[1] - a[1]);
  let html = `<strong>Répartition par secteur</strong><div style="margin-top:8px;">`;
  for (const [sec, val] of lignes) {
    const part = (val / valeurTotale) * 100;
    const alerte = part > SEUIL_CONCENTRATION_SECTEUR * 100;
    html += `<div style="margin-bottom:8px;"><div style="display:flex; justify-content:space-between; font-size:13px;"><span>${sec}</span><strong>${pct1(part)}</strong></div><div style="background:#E1E5EC; border-radius:4px; height:8px;"><div style="background:${alerte ? '#B8891E' : '#0F2F59'}; width:${Math.min(100, Math.round(part))}%; height:8px; border-radius:4px;"></div></div></div>`;
  }
  html += `</div>`;
  return html;
}

// Test de stress : effet d'une baisse de 10 % des deux plus grosses positions sur le total.
function blocStress(positions, valeurTotale) {
  if (positions.length < 2 || valeurTotale <= 0) return null;
  const tri = [...positions].sort((a, b) => (b.valeur_actuelle || 0) - (a.valeur_actuelle || 0));
  const deux = tri.slice(0, 2);
  const poidsDeux = deux.reduce((s, p) => s + (p.valeur_actuelle || 0), 0) / valeurTotale;
  const perte = deux.reduce((s, p) => s + (p.valeur_actuelle || 0), 0) * 0.10;
  return `<strong>Test de résistance</strong><br>Vos deux plus grosses positions (<strong>${deux[0].ticker}</strong> et <strong>${deux[1].ticker}</strong>) pèsent <strong>${pct1(poidsDeux * 100)}</strong> du portefeuille. Si elles baissaient chacune de 10 %, votre portefeuille perdrait environ <strong>${formatMontant(Math.round(perte))}</strong> (${pct1((perte / valeurTotale) * 100)} du total) — sans qu'aucun autre titre n'ait bougé. Plus ce chiffre est élevé, plus votre résultat dépend de seulement deux entreprises.`;
}

// Lecture de chaque titre, en langage éducatif (jamais une consigne d'achat ou de vente).
function blocLectureParTitre(positions, valeurTotale) {
  if (!positions.length || valeurTotale <= 0) return null;
  const items = [];
  for (const p of [...positions].sort((a, b) => (b.valeur_actuelle || 0) - (a.valeur_actuelle || 0))) {
    const poids = ((p.valeur_actuelle || 0) / valeurTotale) * 100;
    const cout = p.prix_moyen_achat * p.quantite_detenue;
    const pct = (p.plus_value !== null && p.plus_value !== undefined && cout > 0) ? (p.plus_value / cout) * 100 : null;
    const anomal = p.dernier_cours && p.prix_moyen_achat > 0 && Math.abs(p.prix_moyen_achat - p.dernier_cours) / p.dernier_cours > SEUIL_ANOMALIE_PRIX;
    let lecture;
    if (anomal) lecture = `prix d'achat très éloigné du cours : vérifier d'abord la saisie avant toute lecture.`;
    else if (poids > SEUIL_CONCENTRATION_TITRE * 100) lecture = `poids élevé (${pct1(poids)}) : une position à suivre de près, car elle pèse beaucoup dans le résultat global.`;
    else if (pct !== null && pct >= 30) lecture = `plus-value notable (${signe(pct)}${pct1(pct)}) : à comparer à votre objectif et à votre horizon, une forte hausse passée ne garantit pas la suite.`;
    else if (pct !== null && pct <= -15) lecture = `moins-value importante (${pct1(pct)}) : l'occasion de réexaminer pourquoi ce titre a été acheté et si ces raisons tiennent toujours.`;
    else if (poids < 5) lecture = `poids marginal (${pct1(poids)}) : son effet sur le résultat reste limité — à vous de définir son rôle (rendement, croissance, diversification).`;
    else lecture = `position dans une zone d'évolution normale${pct !== null ? ` (${signe(pct)}${pct1(pct)})` : ''}, poids de ${pct1(poids)}.`;
    items.push(`<li><strong>${p.ticker}</strong> — ${lecture}</li>`);
  }
  return `<strong>Lecture titre par titre</strong><ul style="margin:8px 0 0 18px;">${items.join('')}</ul><span style="font-size:11px; color:#777;">Lecture éducative à partir de vos chiffres : ce n'est ni un conseil d'achat ni une instruction de vente.</span>`;
}

function genererAnalysePortefeuille({ prenom, full_name, positions, valeurTotale, montantNetInvesti, strategie, objectifMontant, secteursParTicker, horizonMois, versementMensuel, planCreeLe, montantDisponible, catalogueTitres, profileType, revenuMensuel, transactions }) {
  const nomAffiche = prenom || full_name;
  const paragraphes = [];
  const moisEcoules = planCreeLe ? Math.max(0, Math.round((Date.now() - new Date(planCreeLe).getTime()) / (30.44 * 24 * 60 * 60 * 1000))) : 0;

  paragraphes.push(`Bonjour ${nomAffiche},`);

  // Cohérence du plan (profil vs stratégie, réalisme de l'objectif) — calculée pour tout le
  // monde, dès le premier jour, pas seulement une fois qu'il y a déjà un portefeuille.
  const coherence = calculerCoherencePlan({ profileType, strategie, objectifMontant, horizonMois, versementMensuel, revenuMensuel, valeurActuelle: valeurTotale, moisEcoules });
  paragraphes.push(blocCoherence({ ...coherence, objectifMontant, horizonMois, moisEcoules }));

  if (!positions.length) {
    paragraphes.push(`Vous n'avez pas encore d'achat enregistré dans votre espace — c'est tout à fait normal si vous démarrez tout juste. Voici quelques pistes pour vous aider à faire vos premiers pas.`);

    if (montantDisponible && montantDisponible > 0 && catalogueTitres && catalogueTitres.length) {
      const secteursStrategieDepart = strategie && STRATEGIES[strategie] ? STRATEGIES[strategie].secteurs : null;
      let candidats = catalogueTitres.filter(t => t.cours && t.cours <= montantDisponible);
      if (secteursStrategieDepart) candidats = candidats.filter(t => secteursStrategieDepart.includes(t.secteur));

      candidats = candidats
        .sort((a, b) => Number(b.variation_pct || 0) - Number(a.variation_pct || 0))
        .slice(0, 5);

      if (candidats.length) {
        const introPistes = secteursStrategieDepart
          ? `Avec les <strong>${formatMontant(montantDisponible)}</strong> disponibles, et en cohérence avec votre stratégie <strong>${STRATEGIES[strategie].nom}</strong>, voici quelques titres à étudier (exemples éducatifs, pas une recommandation d'achat) :`
          : `Avec les <strong>${formatMontant(montantDisponible)}</strong> disponibles, voici quelques titres à étudier pour un premier achat (exemples éducatifs, pas une recommandation d'achat) :`;
        let paraPistes = `${introPistes}<ul>`;
        for (const t of candidats) {
          const nbActions = Math.floor(montantDisponible / t.cours);
          const montantUtilise = nbActions * t.cours;
          paraPistes += `<li><strong>${t.ticker}</strong> (${t.nom}${t.secteur ? `, secteur ${t.secteur}` : ''}) — ${nbActions} action${nbActions > 1 ? 's' : ''} de ${formatMontant(t.cours)} = ${formatMontant(montantUtilise)}.</li>`;
        }
        paraPistes += `</ul>Prenez le temps de consulter la fiche de chaque titre sur votre espace avant toute décision — un premier achat gagne à être réfléchi plutôt que précipité.`;
        paragraphes.push(paraPistes);
      }
    } else if (!montantDisponible) {
      paragraphes.push(`Communiquez-nous le montant que vous souhaitez investir pour commencer — on pourra alors vous proposer des pistes chiffrées et concrètes, adaptées à votre budget.`);
    }

    if (!strategie) {
      paragraphes.push(`Nous n'avons pas encore de stratégie définie pour vous — en discuter avec votre conseillère permettra d'orienter ces premières pistes plus précisément vers ce qui vous correspond.`);
    }

    paragraphes.push(`N'hésitez pas à nous écrire si vous avez des questions.<br><br>L'équipe TAPA CONSEIL`);
    return paragraphes;
  }

  // Anomalies de saisie (prix très éloigné du cours) — signalées AVANT la performance.
  const anomalies = detecterAnomaliesPrix(transactions, positions);
  const paraAnomalies = blocAnomalies(anomalies);
  if (paraAnomalies) paragraphes.push(paraAnomalies);
  const nomParTicker = Object.fromEntries((catalogueTitres || []).map(t => [t.ticker, t.nom]));

  // Performance globale
  const performance = montantNetInvesti > 0 ? Math.round(((valeurTotale - montantNetInvesti) / montantNetInvesti) * 10000) / 100 : 0;
  let paraPerf = `Voici la lecture de votre portefeuille ce mois-ci. Vous avez investi <strong>${formatMontant(montantNetInvesti)}</strong> au total, pour une valeur actuelle de <strong>${formatMontant(valeurTotale)}</strong>`;
  paraPerf += performance >= 0
    ? `, soit une performance de <strong>+${performance}%</strong>. C'est encourageant — gardez à l'esprit que la Bourse évolue par cycles, et qu'une performance positive sur quelques mois ne préjuge pas de l'avenir.`
    : `, soit une performance de <strong>${performance}%</strong>. Une baisse temporaire fait partie du jeu en Bourse ; ce qui compte est de rester cohérent avec votre horizon de placement plutôt que de réagir à chaud.`;
  paragraphes.push(paraPerf);

  paragraphes.push(`<div>${blocTableauPositions(positions, valeurTotale, nomParTicker)}</div>`);
  const paraSecteurs = blocSecteurs(positions, valeurTotale, secteursParTicker);
  if (paraSecteurs) paragraphes.push(`<div>${paraSecteurs}</div>`);

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
    const poidsMax = valeurTotale > 0 ? Math.max(...positions.map(p => (p.valeur_actuelle || 0) / valeurTotale)) : 0;
    paraDiv += poidsMax > SEUIL_CONCENTRATION_TITRE
      ? `. Les secteurs sont variés, mais la répartition entre vos titres reste déséquilibrée : voir le point sur la concentration ci-dessous.`
      : `. C'est une diversification saine, qui limite votre dépendance à un seul secteur de l'économie.`;
  }
  paragraphes.push(paraDiv);

  // Concentration
  const poidsParTitre = positions.map(p => ({ ticker: p.ticker, poids: valeurTotale > 0 ? (p.valeur_actuelle || 0) / valeurTotale : 0 }));
  const plusGrosPoids = poidsParTitre.sort((a, b) => b.poids - a.poids)[0];
  const besoinDiversification = nbTitres === 1 || secteursDetenus.size <= 1 || (plusGrosPoids && plusGrosPoids.poids > SEUIL_CONCENTRATION_TITRE && nbTitres > 1);
  if (plusGrosPoids && plusGrosPoids.poids > SEUIL_CONCENTRATION_TITRE && nbTitres > 1) {
    paragraphes.push(`À noter : <strong>${plusGrosPoids.ticker}</strong> représente à lui seul ${plusGrosPoids.poids > 0.5 ? 'plus de la moitié' : 'une part importante'} de la valeur de votre portefeuille (${Math.round(plusGrosPoids.poids * 100)}%, le repère de vigilance étant fixé à ${Math.round(SEUIL_CONCENTRATION_TITRE * 100)}%). C'est un point de vigilance si vous souhaitez limiter votre exposition à une seule entreprise.`);
  }

  const paraStress = blocStress(positions, valeurTotale);
  if (paraStress) paragraphes.push(`<div>${paraStress}</div>`);
  const paraLecture = blocLectureParTitre(positions, valeurTotale);
  if (paraLecture) paragraphes.push(`<div>${paraLecture}</div>`);

  // Meilleure performance du portefeuille actuel
  if (nbTitres > 1) {
    const positionsAvecPct = positions
      .filter(p => p.plus_value !== null && p.plus_value !== undefined && p.prix_moyen_achat > 0)
      .map(p => ({ ...p, pct: Math.round((p.plus_value / (p.prix_moyen_achat * p.quantite_detenue)) * 10000) / 100 }));
    const meilleurePosition = positionsAvecPct.sort((a, b) => b.pct - a.pct)[0];
    if (meilleurePosition && meilleurePosition.pct > 0) {
      paragraphes.push(`Dans votre portefeuille actuel, <strong>${meilleurePosition.ticker}</strong> est votre titre le plus performant, avec <strong>+${meilleurePosition.pct}%</strong> depuis votre achat — un bon exemple de ce qui fonctionne bien dans votre sélection actuelle.`);
    }
  }

  // Pistes chiffrées à partir du montant disponible
  if (montantDisponible && montantDisponible > 0) {
    const positionsRenforcables = positions
      .filter(p => p.dernier_cours && p.dernier_cours <= montantDisponible)
      .sort((a, b) => a.dernier_cours - b.dernier_cours);

    if (positionsRenforcables.length) {
      let paraRenfort = `Avec les <strong>${formatMontant(montantDisponible)}</strong> que vous avez indiqué avoir disponibles, vous pourriez aussi renforcer des titres que vous possédez déjà :<ul>`;
      for (const p of positionsRenforcables.slice(0, 3)) {
        const nbActions = Math.floor(montantDisponible / p.dernier_cours);
        const montantUtilise = nbActions * p.dernier_cours;
        paraRenfort += `<li><strong>${p.ticker}</strong> — ${nbActions} action${nbActions > 1 ? 's' : ''} de ${formatMontant(p.dernier_cours)} = ${formatMontant(montantUtilise)}.</li>`;
      }
      paraRenfort += `</ul>`;
      paragraphes.push(paraRenfort);
    }

    if (catalogueTitres && catalogueTitres.length) {
      let aAfficheDiversification = false;
      if (besoinDiversification) {
        const parSecteur = {};
        for (const t of catalogueTitres) {
          if (secteursDetenus.has(t.secteur) || !t.secteur) continue;
          if (!parSecteur[t.secteur] || t.cours < parSecteur[t.secteur].cours) parSecteur[t.secteur] = t;
        }
        const optionsDiversification = Object.values(parSecteur)
          .filter(t => t.cours <= montantDisponible)
          .sort((a, b) => a.cours - b.cours)
          .slice(0, 3);

        if (optionsDiversification.length) {
          let paraDiv2 = `Pour diversifier vers d'autres secteurs (exemples éducatifs, pas une recommandation d'achat) :<ul>`;
          for (const t of optionsDiversification) {
            const nbActions = Math.floor(montantDisponible / t.cours);
            const montantUtilise = nbActions * t.cours;
            paraDiv2 += `<li><strong>${t.ticker}</strong> (${t.nom}, secteur ${t.secteur}) — ${nbActions} action${nbActions > 1 ? 's' : ''} de ${formatMontant(t.cours)} = ${formatMontant(montantUtilise)}.</li>`;
          }
          paraDiv2 += `</ul>`;
          paragraphes.push(paraDiv2);
          aAfficheDiversification = true;
        }
      }

      if (!besoinDiversification || !aAfficheDiversification) {
        const opportunitesMarche = catalogueTitres
          .filter(t => t.cours <= montantDisponible && t.variation_pct !== null && t.variation_pct !== undefined)
          .sort((a, b) => Number(b.variation_pct) - Number(a.variation_pct))
          .slice(0, 5);

        if (opportunitesMarche.length) {
          let paraMarche = `Les titres qui performent le mieux sur le marché en ce moment (variation du jour), dans ce même budget, à titre indicatif — une bonne performance récente ne garantit jamais la suite :<ul>`;
          for (const t of opportunitesMarche) {
            const nbActions = Math.floor(montantDisponible / t.cours);
            const montantUtilise = nbActions * t.cours;
            const signe = Number(t.variation_pct) >= 0 ? '+' : '';
            paraMarche += `<li><strong>${t.ticker}</strong> (${t.nom}) — <strong>${signe}${t.variation_pct}%</strong> aujourd'hui : ${nbActions} action${nbActions > 1 ? 's' : ''} de ${formatMontant(t.cours)} = ${formatMontant(montantUtilise)}.</li>`;
          }
          paraMarche += `</ul>Comme toujours, prenez le temps de consulter la fiche de chaque titre sur votre espace avant toute décision.`;
          paragraphes.push(paraMarche);
        }
      }
    }
  }

  paragraphes.push(`N'hésitez pas à nous écrire si vous avez des questions sur cette analyse.<br><br>L'équipe TAPA CONSEIL`);

  return paragraphes;
}

module.exports = { genererAnalysePortefeuille, verifierConcentration, detecterAnomaliesPrix };
