// Reconnaît, dans un tableau collé (ex: depuis richbourse.com), les fonds déjà créés dans le
// système. Cherche le nom de chaque fonds n'importe où dans tout le texte collé (pas seulement
// ligne par ligne, car un copier-coller de tableau place parfois le nom du fonds sur sa propre
// ligne, séparé de ses données), puis extrait la VL, la date et les performances dans la
// fenêtre de texte qui suit immédiatement ce nom.
// Ne crée jamais un fonds tout seul — évite de deviner un nom mal découpé, on se base sur
// les fonds que l'admin a déjà volontairement créés au préalable.

const NUM = "-?\\d+(?:[ \\u00A0]\\d{3})*(?:[.,]\\d+)?";
const NUM_REGEX = new RegExp(NUM, 'g');
const DATE_REGEX = /(\d{2})\/(\d{2})\/(\d{4})/;
const PCT_REGEX = new RegExp(`(${NUM})\\s*%`, 'g');

// Largeur de la fenêtre de texte examinée après le nom du fonds — assez large pour couvrir
// la société de gestion, la catégorie, la VL, la date et 4 pourcentages, même sur plusieurs
// lignes séparées.
const LARGEUR_FENETRE = 300;

function nettoyerNombre(brut) {
  return Number(brut.replace(/[\s\u00A0]/g, '').replace(',', '.'));
}

function parseCollageOPCVM(texteColle, fondsExistants) {
  const texteNormalise = texteColle.toLowerCase();
  const resultats = [];
  const nonTrouves = [];

  // Les noms les plus longs d'abord, pour qu'un nom court ne "vole" pas accidentellement
  // le texte d'un fonds au nom plus long qui le contient (rare, mais on préfère être prudent).
  const fondsParNomDecroissant = [...fondsExistants].sort((a, b) => b.nom.length - a.nom.length);

  for (const fonds of fondsParNomDecroissant) {
    const nomNormalise = fonds.nom.toLowerCase();
    const position = texteNormalise.indexOf(nomNormalise);

    if (position === -1) { nonTrouves.push(fonds.nom); continue; }

    const debutFenetre = position + fonds.nom.length;
    const fenetre = texteColle.slice(debutFenetre, debutFenetre + LARGEUR_FENETRE);

    const matchDate = fenetre.match(DATE_REGEX);
    const pourcentages = [...fenetre.matchAll(PCT_REGEX)].map(m => nettoyerNombre(m[1]));

    // La VL est le premier nombre trouvé, une fois la date et les pourcentages retirés du texte.
    const fenetreSansDateNiPct = fenetre.replace(DATE_REGEX, ' ').replace(PCT_REGEX, ' ');
    const nombresRestants = [...fenetreSansDateNiPct.matchAll(NUM_REGEX)].map(m => nettoyerNombre(m[0]));
    const valeurLiquidative = nombresRestants.length ? nombresRestants[0] : null;

    if (!matchDate && valeurLiquidative === null && !pourcentages.length) {
      nonTrouves.push(fonds.nom); // le nom est là mais aucune donnée exploitable trouvée juste après
      continue;
    }

    resultats.push({
      fonds_id: fonds.id,
      nom: fonds.nom,
      date_vl: matchDate ? `${matchDate[3]}-${matchDate[2]}-${matchDate[1]}` : null,
      valeur_liquidative: valeurLiquidative,
      perf_ytd: pourcentages[0] !== undefined ? pourcentages[0] : null,
      perf_1an: pourcentages[1] !== undefined ? pourcentages[1] : null,
      perf_3ans: pourcentages[2] !== undefined ? pourcentages[2] : null
    });
  }

  return { resultats, nonTrouves };
}

module.exports = { parseCollageOPCVM };
