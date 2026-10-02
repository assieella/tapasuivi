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
function genererAnalysePortefeuille({ prenom, full_name, positions, valeurTotale, montantNetInvesti, strategie, objectifMontant, secteursParTicker, horizonMois, versementMensuel, planCreeLe, montantDisponible, catalogueTitres, profileType, revenuMensuel }) {
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
  const besoinDiversification = nbTitres === 1 || secteursDetenus.size <= 1 || (plusGrosPoids && plusGrosPoids.poids > 0.5 && nbTitres > 1);
  if (plusGrosPoids && plusGrosPoids.poids > 0.5 && nbTitres > 1) {
    paragraphes.push(`À noter : <strong>${plusGrosPoids.ticker}</strong> représente à lui seul plus de la moitié de la valeur de votre portefeuille (${Math.round(plusGrosPoids.poids * 100)}%). C'est un point de vigilance si vous souhaitez limiter votre exposition à une seule entreprise.`);
  }

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

module.exports = { genererAnalysePortefeuille, verifierConcentration };
