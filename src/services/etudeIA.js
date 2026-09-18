// Génère un brouillon d'étude de titre avec Claude, à partir des VRAIES données déjà
// en base (nom, secteur, cours, dividendes). Claude ne reçoit jamais l'ordre d'inventer
// un chiffre de marché — les valeurs basse/haute sont calculées côté serveur, à partir
// de l'historique de cours réellement saisi. Le brouillon est toujours relu par Ella
// avant publication (voir /api/admin/titres/:ticker/etudes).

async function genererEtudeIA({ titre, historiqueCours, dividendes }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("La clé ANTHROPIC_API_KEY n'est pas configurée.");
  }

  const cours = historiqueCours.map(c => Number(c.cours)).filter(n => !Number.isNaN(n));
  const plusBas = cours.length ? Math.min(...cours) : null;
  const plusHaut = cours.length ? Math.max(...cours) : null;
  const dernierCours = historiqueCours[0] || null;

  const volumes = historiqueCours.map(c => Number(c.volume)).filter(n => !Number.isNaN(n) && n > 0);
  let tendanceVolume = 'non disponible (volume non renseigné dans le système sur cette période)';
  if (volumes.length >= 5) {
    const volumesRecents = volumes.slice(0, Math.min(5, volumes.length));
    const volumesAnciens = volumes.slice(-Math.min(10, volumes.length));
    const moyRecente = volumesRecents.reduce((a, b) => a + b, 0) / volumesRecents.length;
    const moyAncienne = volumesAnciens.reduce((a, b) => a + b, 0) / volumesAnciens.length;
    const variation = moyAncienne > 0 ? Math.round(((moyRecente - moyAncienne) / moyAncienne) * 100) : 0;
    tendanceVolume = `volume moyen récent ${Math.round(moyRecente)} titres/jour, ${variation >= 0 ? 'en hausse' : 'en baisse'} d'environ ${Math.abs(variation)}% par rapport à la période précédente (calculé sur les cours réellement saisis)`;
  }

  const donnees = {
    ticker: titre.ticker,
    nom: titre.nom,
    secteur: titre.secteur || 'non renseigné',
    pays: titre.pays || 'non renseigné',
    description: titre.description || 'non renseignée',
    date_introduction_brvm: titre.date_introduction || 'non renseignée dans le système — à rechercher si possible',
    dernier_cours: dernierCours ? `${dernierCours.cours} FCFA au ${dernierCours.date_cours}` : 'non disponible',
    plus_bas_observe: plusBas !== null ? `${plusBas} FCFA (sur la période suivie dans le système)` : 'non disponible',
    plus_haut_observe: plusHaut !== null ? `${plusHaut} FCFA (sur la période suivie dans le système)` : 'non disponible',
    tendance_volume: tendanceVolume,
    dividendes_enregistres: dividendes.length
      ? dividendes.map(d => `${d.annee}: ${d.montant_par_action} FCFA/action`).join(', ')
      : 'aucun dividende enregistré dans le système — à rechercher si possible'
  };

  const prompt = `Tu rédiges une étude éducative sur une société cotée à la BRVM (Bourse Régionale des Valeurs Mobilières), pour des clients de TAPA CONSEIL en cours de formation à l'investissement.

Voici les données déjà connues dans notre système :
${JSON.stringify(donnees, null, 2)}

Règle absolue sur les COURS et PRIX : n'utilise JAMAIS la recherche web pour un cours, un prix, un plus bas ou un plus haut — utilise uniquement les valeurs "dernier_cours", "plus_bas_observe" et "plus_haut_observe" fournies ci-dessus, qui sont les seules exactes et à jour dans notre système. Le "tendance_volume" fourni est également déjà calculé, ne le recalcule pas et ne le remplace pas par une recherche.

En revanche, tu PEUX et DOIS utiliser l'outil de recherche web pour deux choses, si les informations manquent ci-dessus :
1. La date d'introduction en bourse et l'historique des dividendes, si "non renseignée"/"non enregistré" (cherche sur brvm.org, sikafinance.com, africanmarkets.com, dabafinance.com, richbourse.com)
2. Une ou deux actualités RÉCENTES et concrètes sur cette entreprise précise pour la section "Ce qu'il faut surveiller" : résultats financiers publiés récemment, annonce de dividende, assemblée générale, changement de direction, ou tout événement corporate — avec, si tu le trouves, la date de l'annonce. Cite l'information trouvée de façon concrète (ex: "Un dividende de X FCFA a été annoncé le [date]", "Les résultats de l'exercice [année] ont été publiés le [date]") plutôt que d'écrire un conseil générique du type "surveillez les résultats financiers".

Si la recherche ne donne rien de fiable pour un point précis, dis simplement qu'aucune actualité récente n'est disponible sur ce point — n'invente jamais une date, un montant ou un événement.

Structure attendue (utilise ces intitulés) :
- Présentation de l'entreprise et de son activité (reste général si la description manque, ne fabrique pas de détails)
- Chiffres clés (dernier cours, plus bas et plus haut observés, tendance du volume — et la date d'introduction en bourse si tu l'as trouvée)
- Historique des dividendes (ceux déjà enregistrés, complétés si tu en as trouvé d'autres par la recherche ; sinon écris qu'aucun historique n'est disponible)
- Forces
- Points de vigilance / risques
- Ce qu'il faut surveiller (concret et spécifique à cette entreprise, basé sur ta recherche — pas un conseil générique)

Termine impérativement par cette phrase exacte : "Cette étude est une analyse éducative, pas une recommandation d'achat ni une promesse de gain."

Écris en français, dans un style pédagogique et accessible à un débutant, environ 280 à 380 mots. Ne mets pas de titre général, commence directement par la présentation.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Erreur API Claude (${response.status}) : ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  // La réponse peut contenir plusieurs blocs (texte, recherches effectuées) : on ne garde que le texte.
  const texte = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n\n');
  return { contenu: texte, plus_bas: plusBas, plus_haut: plusHaut };
}

module.exports = { genererEtudeIA };
