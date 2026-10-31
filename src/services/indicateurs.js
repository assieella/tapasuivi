// Indicateurs techniques calculés à partir des cours de clôture enregistrés : moyennes mobiles simples
// (20 et 50 séances) et RSI à 14 séances (méthode de Wilder). Calcul sur les cours disponibles, un point par
// cours enregistré. Tant qu'il n'y a pas assez de cours, la valeur reste null (jamais de courbe approximative).

const arrondi = (n, d) => Math.round(n * Math.pow(10, d)) / Math.pow(10, d);

function moyenneMobile(valeurs, periode) {
  const res = new Array(valeurs.length).fill(null);
  let somme = 0;
  for (let i = 0; i < valeurs.length; i++) {
    somme += valeurs[i];
    if (i >= periode) somme -= valeurs[i - periode];
    if (i >= periode - 1) res[i] = arrondi(somme / periode, 1);
  }
  return res;
}

function rsi(valeurs, periode = 14) {
  const res = new Array(valeurs.length).fill(null);
  if (valeurs.length <= periode) return res;
  let gains = 0, pertes = 0;
  for (let i = 1; i <= periode; i++) {
    const d = valeurs[i] - valeurs[i - 1];
    if (d >= 0) gains += d; else pertes -= d;
  }
  let moyGain = gains / periode, moyPerte = pertes / periode;
  const valeurRsi = () => moyPerte === 0 ? (moyGain === 0 ? 50 : 100) : 100 - 100 / (1 + moyGain / moyPerte);
  res[periode] = arrondi(valeurRsi(), 1);
  for (let i = periode + 1; i < valeurs.length; i++) {
    const d = valeurs[i] - valeurs[i - 1];
    moyGain = (moyGain * (periode - 1) + (d > 0 ? d : 0)) / periode;
    moyPerte = (moyPerte * (periode - 1) + (d < 0 ? -d : 0)) / periode;
    res[i] = arrondi(valeurRsi(), 1);
  }
  return res;
}

// lignes : [{ date_cours, cours }] triées par date croissante. Retourne les `max` derniers points.
function calculerIndicateurs(lignes, max = 120) {
  const cours = lignes.map(l => Number(l.cours));
  const mm20 = moyenneMobile(cours, 20), mm50 = moyenneMobile(cours, 50), r = rsi(cours, 14);
  const points = lignes.map((l, i) => ({
    date: new Date(l.date_cours).toISOString().slice(0, 10), cours: cours[i], mm20: mm20[i], mm50: mm50[i], rsi: r[i]
  }));
  return { nb_cours: lignes.length, points: points.slice(-max) };
}

module.exports = { calculerIndicateurs, moyenneMobile, rsi };
