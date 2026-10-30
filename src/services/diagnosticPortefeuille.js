// Diagnostic automatique du portefeuille d'un client : uniquement des chiffres calculés à partir de ses
// transactions et des derniers cours, et des constats NEUTRES (concentration, origine des pertes...).
// Aucune orientation d'achat, de vente ou de conservation : ce n'est pas un conseil en investissement.

const SEUIL_TITRE = 0.40;   // une ligne pèse « beaucoup » au-delà
const SEUIL_SECTEUR = 0.50; // un secteur pèse « beaucoup » au-delà

const arrondi2 = n => Math.round(n * 100) / 100;
const fcfa = n => Math.round(n).toLocaleString('fr-FR') + ' FCFA';
const pct = n => String(arrondi2(n)).replace('.', ',') + ' %';

// transactions : lignes de portefeuille_transactions ; cours : { TICKER: { cours, date_cours } }
// infos : { TICKER: { nom, secteur } }
function calculerDiagnostic(transactions, cours, infos) {
  const parTicker = {};
  const tri = [...transactions].sort((a, b) => new Date(a.date_transaction) - new Date(b.date_transaction) || (a.id || 0) - (b.id || 0));
  for (const t of tri) {
    const p = parTicker[t.ticker] || (parTicker[t.ticker] = { ticker: t.ticker, quantite: 0, coutAchats: 0, qteAchetee: 0 });
    const q = Number(t.quantite), prix = Number(t.prix_unitaire);
    if (t.type === 'achat') { p.quantite += q; p.coutAchats += q * prix; p.qteAchetee += q; }
    else p.quantite -= q;
  }

  const lignes = Object.values(parTicker).filter(p => p.quantite > 1e-9).map(p => {
    const prixMoyen = p.qteAchetee > 0 ? p.coutAchats / p.qteAchetee : 0;
    const cout = p.quantite * prixMoyen;
    const c = cours[p.ticker];
    const coursActuel = c ? Number(c.cours) : null;
    const valeur = coursActuel !== null ? p.quantite * coursActuel : null;
    const gain = valeur !== null ? valeur - cout : null;
    const info = infos[p.ticker] || {};
    return {
      ticker: p.ticker, nom: info.nom || p.ticker, secteur: info.secteur || null,
      quantite: p.quantite, prix_moyen_achat: Math.round(prixMoyen), cours_actuel: coursActuel,
      date_cours: c ? c.date_cours : null,
      cout: Math.round(cout), valeur: valeur !== null ? Math.round(valeur) : null,
      gain: gain !== null ? Math.round(gain) : null,
      rendement_pct: gain !== null && cout > 0 ? arrondi2((gain / cout) * 100) : null
    };
  });

  if (!lignes.length) return { vide: true };

  const evaluees = lignes.filter(l => l.valeur !== null);
  const sansCours = lignes.filter(l => l.valeur === null).map(l => l.ticker);
  const capital = evaluees.reduce((s, l) => s + l.cout, 0);
  const valeur = evaluees.reduce((s, l) => s + l.valeur, 0);
  const gain = valeur - capital;
  const rendement = capital > 0 ? (gain / capital) * 100 : 0;

  for (const l of evaluees) l.poids_pct = valeur > 0 ? arrondi2((l.valeur / valeur) * 100) : 0;
  evaluees.sort((a, b) => b.valeur - a.valeur);

  // Répartition par secteur
  const parSecteur = {};
  for (const l of evaluees) if (l.secteur) parSecteur[l.secteur] = (parSecteur[l.secteur] || 0) + l.valeur;
  const secteurs = Object.entries(parSecteur).map(([secteur, v]) => ({
    secteur, valeur: Math.round(v), poids_pct: valeur > 0 ? arrondi2((v / valeur) * 100) : 0,
    tickers: evaluees.filter(l => l.secteur === secteur).map(l => l.ticker)
  })).sort((a, b) => b.valeur - a.valeur);

  // Origine des pertes (lignes en moins-value) ou des gains (lignes en plus-value)
  const perdantes = evaluees.filter(l => l.gain < 0).sort((a, b) => a.gain - b.gain);
  const totalPertes = perdantes.reduce((s, l) => s + (-l.gain), 0);
  const contributionPertes = perdantes.map(l => ({ ticker: l.ticker, perte: Math.round(-l.gain), part_pct: totalPertes > 0 ? arrondi2((-l.gain / totalPertes) * 100) : 0 }));

  const interpretation = [];
  if (capital > 0) {
    interpretation.push(`Pour 100 000 FCFA investis, vous détenez aujourd'hui l'équivalent d'environ ${fcfa(100000 * valeur / capital)} en valeur boursière.`);
    if (gain < 0 && valeur > 0) interpretation.push(`Pour retrouver votre capital de ${fcfa(capital)}, la valeur de votre portefeuille doit progresser de ${pct((capital / valeur - 1) * 100)} à partir de sa valeur actuelle.`);
  }

  // Constats neutres : on décrit, on ne recommande jamais d'acheter, de vendre ou de conserver.
  const constats = [];
  const premier = evaluees[0];
  if (premier && evaluees.length > 1 && premier.poids_pct / 100 > SEUIL_TITRE) {
    constats.push({ type: 'concentration', texte: `${premier.ticker} représente à lui seul ${pct(premier.poids_pct)} de votre portefeuille. Une forte variation de ce titre aurait un impact important sur votre performance globale.`, question: `Cette part correspond-elle à ce que vous aviez prévu dans votre plan d'investissement ?` });
  }
  const secteurDominant = secteurs[0];
  if (secteurDominant && evaluees.length > 1 && secteurDominant.poids_pct / 100 > SEUIL_SECTEUR && secteurDominant.tickers.length > 0) {
    constats.push({ type: 'secteur', texte: `Le secteur « ${secteurDominant.secteur} » (${secteurDominant.tickers.join(', ')}) représente ${pct(secteurDominant.poids_pct)} de votre portefeuille : la diversification entre secteurs est limitée.`, question: `Vos titres réagissent-ils aux mêmes événements économiques ?` });
  }
  if (evaluees.length === 1) {
    constats.push({ type: 'unique', texte: `Votre portefeuille ne contient qu'un seul titre (${evaluees[0].ticker}) : toute sa performance dépend de cette seule société.`, question: `Souhaitez-vous répartir vos prochains investissements sur plusieurs sociétés ?` });
  }
  if (perdantes.length >= 2 && gain < 0) {
    const deux = perdantes.slice(0, 2);
    const partPertes = deux.reduce((s, l) => s + (-l.gain), 0) / totalPertes * 100;
    const partValeur = deux.reduce((s, l) => s + l.valeur, 0) / valeur * 100;
    if (partPertes > partValeur + 10) {
      constats.push({ type: 'pertes', texte: `${deux[0].ticker} et ${deux[1].ticker} expliquent ${pct(partPertes)} de la moins-value, alors qu'ils représentent ${pct(partValeur)} de la valeur du portefeuille.`, question: `Connaissez-vous les raisons de la baisse de ces deux titres (résultats, dividende, actualité) ? Leurs fiches « L'action à la loupe » peuvent vous aider.` });
    }
  }
  if (perdantes.length && perdantes.length === evaluees.length && evaluees.length > 1) {
    constats.push({ type: 'toutes', texte: `Toutes vos lignes sont en moins-value à ce jour. Cela peut venir d'un mouvement général du marché ou de causes propres à chaque société.`, question: `Comment l'indice BRVM Composite a-t-il évolué sur la même période ?` });
  }
  if (sansCours.length) {
    constats.push({ type: 'sans_cours', texte: `Le dernier cours de ${sansCours.join(', ')} n'est pas disponible : ${sansCours.length > 1 ? 'ces lignes ne sont' : 'cette ligne n\'est'} pas comptée${sansCours.length > 1 ? 's' : ''} dans les totaux.`, question: null });
  }

  const dates = evaluees.map(l => l.date_cours).filter(Boolean).map(d => new Date(d).getTime());
  return {
    vide: false,
    date_cours: dates.length ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : null,
    resume: { capital_investi: Math.round(capital), valeur_actuelle: Math.round(valeur), gain: Math.round(gain), rendement_pct: arrondi2(rendement) },
    interpretation, lignes: evaluees.concat(lignes.filter(l => l.valeur === null)), secteurs,
    contribution_pertes: contributionPertes, constats
  };
}

module.exports = { calculerDiagnostic };
