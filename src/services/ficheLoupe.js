// "L'ACTION À LA LOUPE" — fiche d'étude structurée. Tous les CHIFFRES sont calculés ici, à partir
// des données réellement présentes en base (cours, dividendes, données financières VALIDÉES).
// L'IA ne rédige que le texte autour : elle ne produit ni ne modifie jamais un chiffre.

function fmtFcfaCourt(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  const a = Math.abs(v);
  const f = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
  if (a >= 1e9) return `${f(v / 1e9)} Md FCFA`;
  if (a >= 1e6) return `${f(v / 1e6)} M FCFA`;
  return `${Math.round(v).toLocaleString('fr-FR')} FCFA`;
}
function fmtPct(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${(Math.round(n * 10) / 10).toString().replace('.', ',')} %`;
}
function fmtPctSimple(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${(Math.round(n * 10) / 10).toString().replace('.', ',')} %`;
}
function fmtDate(d) { return new Date(d).toLocaleDateString('fr-FR'); }

// historique : cours triés du plus récent au plus ancien ; historiqueAnnee : cours de l'année en
// cours triés du plus ancien au plus récent. financieres : lignes validées triées par année décroissante.
function calculerChiffresCles({ historique, historiqueAnnee, dividendes, financieres, nombreActions }) {
  const dernier = historique && historique[0] ? historique[0] : null;
  const cours = dernier ? Number(dernier.cours) : null;
  const res = { cours, dateCours: dernier ? dernier.date_cours : null };

  // Variation depuis le premier cours connu de l'année
  if (cours && historiqueAnnee && historiqueAnnee.length) {
    const premier = historiqueAnnee[0];
    const p = Number(premier.cours);
    if (p > 0) { res.variationAnnee = ((cours - p) / p) * 100; res.dateDebutAnnee = premier.date_cours; }
  }

  const f0 = financieres && financieres[0] ? financieres[0] : null;
  const f1 = financieres && financieres[1] ? financieres[1] : null;
  if (f0) {
    res.annee = f0.annee;
    res.ca = f0.chiffre_affaires !== null ? Number(f0.chiffre_affaires) : null;
    res.bn = f0.benefice_net !== null ? Number(f0.benefice_net) : null;
    res.cp = f0.capitaux_propres !== null ? Number(f0.capitaux_propres) : null;
    res.dette = f0.dettes_totales !== null ? Number(f0.dettes_totales) : null;
    if (res.ca > 0 && res.bn !== null) res.marge = (res.bn / res.ca) * 100;
    if (res.cp > 0 && res.bn !== null) res.roe = (res.bn / res.cp) * 100;
    if (res.cp > 0 && res.dette !== null) res.endettement = res.dette / res.cp;
    if (f1 && Number(f1.chiffre_affaires) > 0 && res.ca !== null) { res.croissanceCA = ((res.ca - Number(f1.chiffre_affaires)) / Number(f1.chiffre_affaires)) * 100; res.anneePrec = f1.annee; }
    if (f1 && Number(f1.benefice_net) > 0 && res.bn !== null) { res.croissanceBN = ((res.bn - Number(f1.benefice_net)) / Number(f1.benefice_net)) * 100; }
  }
  // Valorisation : possible seulement si le nombre d'actions est renseigné et le résultat net connu.
  const nb = Number(nombreActions);
  if (nb > 0) {
    res.nombreActions = nb;
    if (cours > 0) res.capitalisation = cours * nb;
    if (res.bn !== undefined && res.bn !== null) {
      res.bpa = res.bn / nb;
      if (res.bpa > 0 && cours > 0) res.per = cours / res.bpa;
      else if (res.bpa <= 0) res.perNonSignificatif = true;
    }
    if (res.capitalisation && res.cp > 0) res.pb = res.capitalisation / res.cp;
  }
  const d0 = dividendes && dividendes[0] ? dividendes[0] : null;
  if (d0) {
    res.dividende = Number(d0.montant_par_action); res.anneeDividende = d0.annee;
    if (cours > 0) res.rendement = (res.dividende / cours) * 100;
    if (res.bpa > 0) res.payout = (res.dividende / res.bpa) * 100;
  }
  return res;
}

// Tableau (format markdown, lisible et modifiable dans l'éditeur, rendu en tableau sur le site)
function tableauChiffresCles(c, titre) {
  const banque = /banque/i.test(titre.secteur || '');
  const labelCA = banque ? 'Produit net bancaire (PNB)' : "Chiffre d'affaires";
  const per = (c.annee ? `exercice ${c.annee}` : '');
  const lignes = [
    ['Cours actuel', c.cours ? `${c.cours.toLocaleString('fr-FR')} FCFA` : '—', c.dateCours ? `au ${fmtDate(c.dateCours)}` : ''],
    // Si notre historique de cours ne remonte pas au début de l'année, on le dit dans le libellé
    // au lieu d'afficher « depuis le début de l'année » avec un point de départ plus tardif.
    (c.dateDebutAnnee && new Date(c.dateDebutAnnee).getMonth() === 0 && new Date(c.dateDebutAnnee).getDate() <= 15)
      ? ["Variation depuis le début de l'année", fmtPct(c.variationAnnee), `depuis le ${fmtDate(c.dateDebutAnnee)}`]
      : [c.dateDebutAnnee ? `Variation depuis le ${fmtDate(c.dateDebutAnnee)}` : "Variation depuis le début de l'année", fmtPct(c.variationAnnee), c.dateDebutAnnee ? "début de notre historique de cours cette année" : 'historique insuffisant'],
    [labelCA, fmtFcfaCourt(c.ca), per],
    ['Croissance du ' + (banque ? 'PNB' : "chiffre d'affaires"), fmtPct(c.croissanceCA), c.anneePrec ? `${c.annee} vs ${c.anneePrec}` : ''],
    ['Résultat net', fmtFcfaCourt(c.bn), per],
    [banque ? 'Marge nette (résultat net / PNB)' : 'Marge nette', fmtPctSimple(c.marge), per],
    ['Rentabilité des capitaux propres (ROE)', fmtPctSimple(c.roe), per],
    ['Dettes financières / capitaux propres', c.endettement !== undefined ? `${(Math.round(c.endettement * 100) / 100).toString().replace('.', ',')} fois` : '—', per],
    ['Dividende par action', c.dividende !== undefined ? `${c.dividende.toLocaleString('fr-FR')} FCFA` : '—', c.anneeDividende ? `exercice ${c.anneeDividende}` : ''],
    ['Rendement du dividende', fmtPctSimple(c.rendement), c.dividende !== undefined ? 'dividende / cours actuel' : ''],
    ...(c.nombreActions ? [
      ['Bénéfice par action (BPA)', c.bpa !== undefined ? `${Math.round(c.bpa).toLocaleString('fr-FR')} FCFA` : '—', c.bpa !== undefined ? `${per} · résultat net / ${c.nombreActions.toLocaleString('fr-FR')} actions` : ''],
      ['PER (cours / BPA)', c.per !== undefined ? `${(Math.round(c.per * 10) / 10).toString().replace('.', ',')} fois` : (c.perNonSignificatif ? 'non significatif (résultat négatif)' : '—'), c.per !== undefined ? 'cours actuel / BPA' : ''],
      ['Capitalisation boursière', fmtFcfaCourt(c.capitalisation), 'cours actuel × nombre d\'actions'],
      ['Cours / valeur comptable (P/B)', c.pb !== undefined ? `${(Math.round(c.pb * 100) / 100).toString().replace('.', ',')} fois` : '—', c.pb !== undefined ? 'capitalisation / capitaux propres' : '']
    ] : [
      ['PER', 'non calculé', "nombre d'actions non renseigné"]
    ])
  ];
  return ['| Indicateur | Valeur | Période / base |', '|---|---|---|', ...lignes.map(l => `| ${l.join(' | ')} |`)].join('\n');
}

// Le même jeu de chiffres, en texte, fourni à l'IA comme SEULE source de chiffres autorisée.
function chiffresPourIA(c) {
  const out = {};
  const add = (k, v) => { if (v !== null && v !== undefined && !(typeof v === 'number' && !Number.isFinite(v))) out[k] = v; };
  add('cours_actuel_FCFA', c.cours);
  add('variation_depuis_debut_annee_pct', c.variationAnnee !== undefined ? Math.round(c.variationAnnee * 10) / 10 : undefined);
  add('exercice_financier', c.annee);
  add('chiffre_affaires_ou_PNB', c.ca !== undefined ? fmtFcfaCourt(c.ca) : undefined);
  add('croissance_CA_pct', c.croissanceCA !== undefined ? Math.round(c.croissanceCA * 10) / 10 : undefined);
  add('resultat_net', c.bn !== undefined ? fmtFcfaCourt(c.bn) : undefined);
  add('marge_nette_pct', c.marge !== undefined ? Math.round(c.marge * 10) / 10 : undefined);
  add('ROE_pct', c.roe !== undefined ? Math.round(c.roe * 10) / 10 : undefined);
  add('dettes_financieres_sur_capitaux_propres', c.endettement !== undefined ? Math.round(c.endettement * 100) / 100 : undefined);
  add('dividende_par_action_FCFA', c.dividende);
  add('nombre_actions', c.nombreActions);
  add('benefice_par_action_FCFA', c.bpa !== undefined ? Math.round(c.bpa) : undefined);
  add('PER', c.per !== undefined ? Math.round(c.per * 10) / 10 : undefined);
  add('capitalisation_boursiere', c.capitalisation !== undefined ? fmtFcfaCourt(c.capitalisation) : undefined);
  add('P_B_cours_sur_valeur_comptable', c.pb !== undefined ? Math.round(c.pb * 100) / 100 : undefined);
  add('taux_de_distribution_pct_du_BPA', c.payout !== undefined ? Math.round(c.payout) : undefined);
  add('rendement_dividende_pct', c.rendement !== undefined ? Math.round(c.rendement * 10) / 10 : undefined);
  return out;
}

const AVERTISSEMENT = "Cette étude présente une analyse générale à vocation informative et pédagogique. Elle ne constitue pas une recommandation personnalisée d'achat ou de vente. Les performances passées ne garantissent pas les performances futures.";

// Assemble la fiche finale (markdown) : en-tête, chiffres clés calculés, texte de l'IA, sources.
// Nettoie les artefacts fréquents du texte généré après recherche web : puces vides,
// phrase en gras coupée en deux paragraphes, lignes vides en trop.
function nettoyerNarratif(t) {
  let x = String(t || '').replace(/\r/g, '');
  // L'IA laisse parfois des phrases de travail avant le premier titre (« Je vais chercher… ») : on les supprime.
  const debut = x.search(/^##[ \t]*1\./m);
  if (debut > 0) x = x.slice(debut);
  x = x.replace(/^(?!##|[-*]|\d+\.|\*\*|\||---|\(source)(?:I'll|I will|Let me|Je vais|J'ai maintenant|Voici)[^\n]*\n?/gim, '');
  x = x.replace(/[ \t]+$/gm, '');
  x = x.replace(/^[ \t]+(?=\*\*)/gm, '');                              // espace avant un intitulé en gras                                   // espaces en fin de ligne
  x = x.replace(/^([-*]|\d+\.)[ \t]*\n+(?=\S)/gm, '$1 ');            // puce ou numéro seul : on le recolle à son texte
  // Texte coupé par un saut de paragraphe après une virgule, un deux-points, ou un intitulé en gras
  // (ex. « **Activité :** » ou « …en 2025, » suivis du reste dans un autre paragraphe) : on recolle.
  x = x.replace(/(:\*\*|[,;:]\*\*|[,;:])[ \t]*\n(?:[ \t]*\n)+[ \t]*(?![-*][ \t]|\d+\.[ \t])/g, '$1 ');
  x = x.replace(/\*\*[ \t]*\n+[ \t]*(?=[a-zàâçéèêëîïôûùüœ])/g, '** '); // « **texte** » + suite en minuscule
  // Phrase coupée par une ligne vide : la suite commence par une minuscule, un tiret long ou une parenthèse (« (source : … ») : on recolle.
  x = x.replace(/[ \t]*\n(?:[ \t]*\n)+[ \t]*(?=[a-zàâçéèêëîïôûùüœ(—–])/g, ' ');
  // Point numéroté dont seul le titre en gras est sur la première ligne : on recolle le paragraphe qui suit.
  x = x.replace(/^(\d+\.[ \t]+\*\*[^\n]*\*\*)[ \t]*\n(?:[ \t]*\n)+[ \t]*(?=[A-ZÀ-Ý])/gm, '$1 ');
  // Intitulés en gras de la section 3 collés dans un même paragraphe : un paragraphe par intitulé.
  x = x.replace(/([.!?»)])[ \t]+(\*\*(?:Croissance|Rentabilité|Solidité financière|Valorisation)[ \t]*:\*\*)/g, '$1\n\n$2');
  x = x.replace(/^[ \t]*[-*][ \t]*$/gm, '');                          // puces vides restantes
  x = x.replace(/\n{3,}/g, '\n\n');
  return x.trim();
}

function assemblerFiche({ numero, titre, chiffres, narratif, dateDonnees, annee }) {
  narratif = nettoyerNarratif(narratif);
  const n = String(numero).padStart(3, '0');
  const entete = [
    `{{LOUPE N°${n}}}`,
    `**Entreprise :** ${titre.nom}  `,
    `**Code BRVM :** ${titre.ticker}  `,
    `**Secteur :** ${titre.secteur || 'non renseigné'}  `,
    `**Date de l'analyse :** ${fmtDate(new Date())}  `,
    `**Données de marché arrêtées au :** ${dateDonnees ? fmtDate(dateDonnees) : 'non disponible'}`
  ].join('\n');
  const sources = [
    '## 6. Sources et méthodologie',
    `- Cours : base de suivi TAPA INVEST, issue du bulletin officiel de la cote BRVM${dateDonnees ? ` (dernier cours : ${fmtDate(dateDonnees)})` : ''}`,
    `- États financiers de la société${annee ? ` — exercice ${annee}` : ' — non renseignés pour ce titre'}, saisis et vérifiés par TAPA CONSEIL`,
    '- Ratios calculés par TAPA INVEST : marge nette = résultat net / chiffre d\'affaires ; ROE = résultat net / capitaux propres ; endettement = dettes financières / capitaux propres ; rendement = dividende par action / cours actuel ; BPA = résultat net / nombre d\'actions ; PER = cours / BPA ; P/B = capitalisation boursière / capitaux propres',
    '- Un indicateur affiché « — » n\'est pas disponible : nous préférons ne rien afficher plutôt qu\'estimer.',
    '',
    '---',
    `*${AVERTISSEMENT}*`
  ].join('\n');
  const bloc2 = `## 2. Les chiffres clés\n\n${chiffres}\n`;
  // Le tableau (section 2) s'insère entre la section 1 et la section 3 rédigées par l'IA.
  const m = narratif.match(/^## 3\./m);
  const corps = m ? `${narratif.slice(0, m.index).trimEnd()}\n\n${bloc2}\n${narratif.slice(m.index)}` : `${narratif.trimEnd()}\n\n${bloc2}`;
  return `${entete}\n\n${corps.trim()}\n\n${sources}`;
}

module.exports = { nettoyerNarratif, calculerChiffresCles, tableauChiffresCles, chiffresPourIA, assemblerFiche, AVERTISSEMENT };
