// Génère un brouillon d'actualité du marché BRVM via recherche web réelle — jamais publié
// automatiquement, toujours relu et validé par TAPA CONSEIL avant que les clients ne le voient
// (voir /api/admin/actualites). L'agent cherche des faits datés et sourcés, jamais des prévisions
// ou des recommandations d'achat.

async function genererActualiteMarche() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("La clé ANTHROPIC_API_KEY n'est pas configurée.");
  }

  const prompt = `Tu es un assistant de veille pour TAPA CONSEIL, qui accompagne des investisseurs particuliers débutants sur la BRVM (Bourse Régionale des Valeurs Mobilières, zone UEMOA).

Utilise l'outil de recherche web pour trouver les actualités RÉELLES et RÉCENTES (des derniers jours) concernant le marché BRVM, en consultant notamment brvm.org, sikafinance.com, africanmarkets.com, dabafinance.com et richbourse.com. Cherche précisément :

1. Des mouvements notables du marché (l'indice BRVM Composite, des titres qui ont beaucoup bougé)
2. Des annonces de résultats financiers récentes (sociétés cotées ayant publié un rapport)
3. Des annonces de dividendes récentes
4. Des dates d'Assemblées Générales annoncées ou à venir
5. Toute autre actualité significative du marché (introduction en bourse, changement réglementaire, etc.)

RÈGLE ABSOLUE : chaque information doit être RÉELLE et RÉCENTE, trouvée par ta recherche — jamais inventée. Si tu ne trouves rien de fiable sur un point, ignore-le simplement plutôt que d'inventer. Cite la date de chaque événement quand tu la trouves. Ne fais JAMAIS de prévision sur l'évolution future d'un titre, et ne recommande JAMAIS d'acheter ou de vendre quoi que ce soit — décris seulement les faits que tu as trouvés.

Structure ta réponse en 3-5 points courts (avec puces "-"), chacun avec la date de l'événement si tu l'as trouvée, dans un style clair et accessible à un débutant. Termine par : "Ces informations sont partagées à titre éducatif — elles ne constituent pas une recommandation d'achat ou de vente."

Écris en français. Ne mets pas de titre général, commence directement par le premier point.`;

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
  const texte = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n\n');
  return { contenu: texte };
}

module.exports = { genererActualiteMarche };
