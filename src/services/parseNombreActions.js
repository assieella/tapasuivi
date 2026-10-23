// Lit une liste « CODE  nombre d'actions » collée par l'administratrice, une société par ligne.
// Accepte les séparateurs courants (espace, tabulation, « ; », « : », « = », « , ») et les nombres
// écrits avec des espaces (y compris insécables) ou des points : « BOAB 40 561 048 », « BOAC;40.000.000 ».
function parseNombreActions(texte) {
  const resultats = [];
  const erreurs = [];
  const vus = new Set();
  for (const brute of String(texte || '').split(/\r?\n/)) {
    const ligne = brute.replace(/[  ]/g, ' ').trim();
    if (!ligne) continue;
    const m = ligne.match(/^([A-Za-z]{2,8})\s*[\s;:=,\t-]+\s*([\d][\d\s.,]*)$/);
    if (!m) { erreurs.push(brute.trim()); continue; }
    const ticker = m[1].toUpperCase();
    const chiffres = m[2].replace(/[^\d]/g, '');
    const nombre = Number(chiffres);
    if (!chiffres || !Number.isSafeInteger(nombre) || nombre <= 0) { erreurs.push(brute.trim()); continue; }
    if (vus.has(ticker)) { erreurs.push(`${brute.trim()} (code déjà présent plus haut)`); continue; }
    vus.add(ticker);
    resultats.push({ ticker, nombre });
  }
  return { resultats, erreurs };
}
module.exports = { parseNombreActions };
