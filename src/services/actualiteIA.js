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

Structure ta réponse en sections par thème, en utilisant EXACTEMENT ces titres (avec "##" devant), dans cet ordre — n'inclus une section QUE si tu as vraiment trouvé une information réelle pour elle, ignore complètement les sections sans contenu fiable :

## 📊 Mouvements du marché
## 💰 Dividendes annoncés
## 📈 Résultats financiers publiés
## 📅 Assemblées Générales à venir
## 📌 Autres actualités importantes (introductions en bourse, nouvelles cotations, changements réglementaires...)

Sous chaque titre, liste les informations trouvées avec des puces "-", chacune avec sa date quand tu l'as trouvée, dans un style clair et accessible à un débutant. Termine par : "Ces informations sont partagées à titre éducatif — elles ne constituent pas une recommandation d'achat ou de vente."

Écris en français.`;

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

// Génère un brouillon d'actualité financière macro-économique (UEMOA/BCEAO) — distincte des
// actualités boursières, qui restent centrées sur le marché BRVM et les titres cotés.
async function genererActualiteFinanciere() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("La clé ANTHROPIC_API_KEY n'est pas configurée.");
  }

  const prompt = `Tu es un assistant de veille pour TAPA CONSEIL, qui accompagne des investisseurs particuliers débutants dans la zone UEMOA (Afrique de l'Ouest francophone, FCFA).

Utilise l'outil de recherche web pour trouver les actualités RÉELLES et RÉCENTES (des derniers jours) concernant l'économie et la finance de la zone UEMOA — PAS le marché boursier BRVM lui-même (ça, c'est une autre veille séparée), mais le contexte macro-économique qui influence les investisseurs. Cherche précisément :

1. Les décisions de la BCEAO (taux directeur, politique monétaire, réserves de change)
2. Les chiffres d'inflation dans la zone UEMOA
3. Les grandes annonces économiques régionales (croissance, budget des États membres, accords financiers)
4. L'actualité du secteur bancaire et de la microfinance dans la région
5. Toute autre actualité financière significative pour la zone UEMOA

RÈGLE ABSOLUE : chaque information doit être RÉELLE et RÉCENTE, trouvée par ta recherche — jamais inventée. Si tu ne trouves rien de fiable sur un point, ignore-le simplement plutôt que d'inventer. Cite la date de chaque événement quand tu la trouves. Ne fais JAMAIS de prévision, et ne donne JAMAIS de conseil financier personnel — décris seulement les faits que tu as trouvés.

Structure ta réponse en sections par thème, en utilisant EXACTEMENT ces titres (avec "##" devant) — n'inclus une section QUE si tu as vraiment trouvé une information réelle pour elle :

## 🏦 Politique monétaire (BCEAO)
## 📉 Inflation et indicateurs économiques
## 🌍 Actualité économique régionale
## 💳 Secteur bancaire et microfinance

Sous chaque titre, liste les informations trouvées avec des puces "-", chacune avec sa date quand tu l'as trouvée, dans un style clair et accessible à un débutant. Termine par : "Ces informations sont partagées à titre éducatif — elles ne constituent pas un conseil financier personnalisé."

Écris en français.`;

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

module.exports = { genererActualiteMarche, genererActualiteFinanciere };
