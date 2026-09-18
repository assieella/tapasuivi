const { STRATEGIES } = require('../data/strategies');

function formatMontant(n) {
  return Number(n).toLocaleString('fr-FR') + ' FCFA';
}

// Génère un brouillon d'analyse pédagogique, que Ella relit et ajuste avant envoi.
// Ne se contente jamais d'un chiffre brut : explique ce qu'il signifie pour le client.
function genererAnalysePortefeuille({ prenom, full_name, positions, valeurTotale, montantNetInvesti, strategie, objectifMontant, secteursParTicker, horizonMois, versementMensuel, planCreeLe, montantDisponible, catalogueTitres }) {
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
  const besoinDiversification = nbTitres === 1 || secteursDetenus.size <= 1 || (plusGrosPoids && plusGrosPoids.poids > 0.5 && nbTitres > 1);
  if (plusGrosPoids && plusGrosPoids.poids > 0.5 && nbTitres > 1) {
    paragraphes.push(`À noter : <strong>${plusGrosPoids.ticker}</strong> représente à lui seul plus de la moitié de la valeur de votre portefeuille (${Math.round(plusGrosPoids.poids * 100)}%). C'est un point de vigilance si vous souhaitez limiter votre exposition à une seule entreprise.`);
  }

  // Meilleure performance du portefeuille actuel — toujours affiché s'il y a plus d'un titre,
  // indépendamment du montant disponible.
  if (nbTitres > 1) {
    const positionsAvecPct = positions
      .filter(p => p.plus_value !== null && p.plus_value !== undefined && p.prix_moyen_achat > 0)
      .map(p => ({ ...p, pct: Math.round((p.plus_value / (p.prix_moyen_achat * p.quantite_detenue)) * 10000) / 100 }));
    const meilleurePosition = positionsAvecPct.sort((a, b) => b.pct - a.pct)[0];
    if (meilleurePosition && meilleurePosition.pct > 0) {
      paragraphes.push(`Dans votre portefeuille actuel, <strong>${meilleurePosition.ticker}</strong> est votre titre le plus performant, avec <strong>+${meilleurePosition.pct}%</strong> depuis votre achat — un bon exemple de ce qui fonctionne bien dans votre sélection actuelle.`);
    }
  }

  // Pistes chiffrées à partir du montant disponible — dès qu'un montant est communiqué.
  // Toujours à partir de titres et cours réels de la base — jamais inventé, jamais présenté comme
  // une recommandation d'achat, seulement des exemples éducatifs. Le calcul complet (nombre
  // d'actions × prix = montant dépensé) est toujours affiché, pas juste le nombre d'actions.
  if (montantDisponible && montantDisponible > 0) {
    // 1. Renforcer une position déjà détenue — toujours proposé en premier, indépendamment
    // de tout souci détecté, parmi les titres que le client possède déjà et dont le cours
    // actuel rentre dans le budget.
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
      // 2. Si un vrai souci de diversification est détecté (concentration, un seul secteur) :
      // pistes vers d'autres secteurs, en priorité.
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

      // 3. Si aucun souci de diversification n'a été détecté : jusqu'à 5 titres qui performent
      // le mieux sur le marché en ce moment (variation du jour), dans le budget donné.
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

  // Trajectoire vers l'objectif — pas juste un pourcentage brut, mais une vraie lecture de l'avancement
  // par rapport au temps déjà écoulé et au temps restant sur l'horizon fixé au départ.
  if (objectifMontant) {
    const pctObjectif = Math.round((valeurTotale / objectifMontant) * 100);

    if (pctObjectif >= 100) {
      paragraphes.push(`Félicitations, vous avez atteint votre objectif initial de <strong>${formatMontant(objectifMontant)}</strong> — c'est le bon moment pour en définir un nouveau avec votre conseillère.`);
    } else if (horizonMois && planCreeLe) {
      const moisEcoules = Math.max(1, Math.round((Date.now() - new Date(planCreeLe).getTime()) / (30.44 * 24 * 60 * 60 * 1000)));
      const moisRestants = Math.max(0, horizonMois - moisEcoules);
      const pctTempsEcoule = Math.min(100, Math.round((moisEcoules / horizonMois) * 100));

      let paraObjectif = `Vous êtes actuellement à <strong>${pctObjectif}%</strong> de votre objectif de ${formatMontant(objectifMontant)}, alors que <strong>${pctTempsEcoule}%</strong> du temps prévu (${horizonMois} mois) s'est déjà écoulé. `;

      if (pctObjectif >= pctTempsEcoule) {
        paraObjectif += `Vous êtes actuellement <strong>en avance</strong> sur votre trajectoire — continuez sur cette lancée en gardant la régularité de vos versements.`;
      } else if (moisRestants > 0) {
        const montantRestant = objectifMontant - valeurTotale;
        const versementNecessaire = Math.round(montantRestant / moisRestants);
        paraObjectif += `Vous êtes actuellement <strong>en retard</strong> par rapport à votre trajectoire initiale. Pour atteindre votre objectif dans les ${moisRestants} mois restants, il faudrait investir environ <strong>${formatMontant(versementNecessaire)}/mois</strong>`;
        if (versementMensuel) {
          const ecartVersement = versementNecessaire - versementMensuel;
          paraObjectif += ecartVersement > 0
            ? ` — soit ${formatMontant(Math.round(ecartVersement))} de plus que votre versement mensuel actuel (${formatMontant(versementMensuel)}).`
            : `, ce qui reste cohérent avec votre versement mensuel actuel.`;
        } else { paraObjectif += `.`; }
        paraObjectif += ` Ce n'est pas alarmant en soi — la performance de vos titres peut aussi combler une partie de cet écart — mais c'est un point à évoquer ensemble pour ajuster le rythme si besoin.`;
      } else {
        paraObjectif += `L'horizon initialement prévu est désormais dépassé sans que l'objectif soit atteint — ce serait le bon moment de revoir ensemble l'objectif ou le délai avec votre conseillère.`;
      }
      paragraphes.push(paraObjectif);
    } else {
      paragraphes.push(`Vous êtes actuellement à <strong>${pctObjectif}%</strong> de votre objectif de ${formatMontant(objectifMontant)}. Continuez vos versements réguliers : c'est la régularité, plus que les montants ponctuels, qui fait la différence sur la durée.`);
    }
  } else {
    paragraphes.push(`Nous n'avons pas encore enregistré d'objectif chiffré pour votre plan d'investissement — c'est justement ce qui permettrait de mesurer précisément votre progression d'un mois sur l'autre. N'hésitez pas à en discuter avec votre conseillère pour le définir ensemble.`);
  }

  paragraphes.push(`N'hésitez pas à nous écrire si vous avez des questions sur cette analyse.<br><br>L'équipe TAPA CONSEIL`);

  return paragraphes;
}

module.exports = { genererAnalysePortefeuille };
