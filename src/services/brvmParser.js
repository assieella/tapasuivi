// Nombre avec espaces comme séparateur de milliers, et virgule ou point pour les décimales.
// Ex: "23 475" ou "1 364" ou "0,00" ou "-1,14"
const NUM = "-?\\d+(?:[ \\u00A0]\\d{3})*(?:[.,]\\d+)?";

// Format détaillé (page "Toutes" de brvm.org) :
// TICKER  NOM DE LA SOCIÉTÉ (PAYS)  VOLUME  COURS_VEILLE  COURS_OUVERTURE  COURS_CLOTURE  VARIATION%
const regexDetaille = new RegExp(
  `^([A-Z0-9]{3,6})\\s+(.+?)\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s*%?$`
);

// Format simple (résumés Top5/Flop5 ou anciennes listes) :
// TICKER  COURS  VARIATION%
const regexSimple = new RegExp(`^([A-Z0-9]{3,6})\\s+(${NUM})\\s+(${NUM})\\s*%?$`);

function nettoyerNombre(brut) {
  return Number(brut.replace(/[\s\u00A0]/g, '').replace(',', '.'));
}

// Pays reconnus dans le nom, pour déduire automatiquement la colonne "pays"
const PAYS_CONNUS = [
  "COTE D'IVOIRE", "CÔTE D'IVOIRE", 'SENEGAL', 'SÉNÉGAL', 'TOGO', 'BENIN', 'BÉNIN',
  'BURKINA FASO', 'MALI', 'NIGER', 'GUINEE BISSAU', 'GUINÉE BISSAU'
];

function deduirePays(nomBrut) {
  const majuscule = nomBrut.toUpperCase();
  for (const pays of PAYS_CONNUS) {
    if (majuscule.includes(pays)) {
      return pays.replace('CÔTE', 'COTE').replace('SÉNÉGAL', 'SENEGAL').replace('BÉNIN', 'BENIN').replace('GUINÉE', 'GUINEE');
    }
  }
  return null;
}

// Ligne d'indice, ex: "BRVM-C  497,65  0,29%" ou "BRVM-30  237,61  0,44%"
const regexIndice = new RegExp(`^(BRVM-C|BRVM-30|BRVM-COMPOSITE)\\s+(${NUM})\\s+(${NUM})\\s*%?$`, 'i');

function parseColleBRVM(texteColle) {
  const lignes = texteColle.split('\n').map(l => l.trim()).filter(Boolean);
  const resultats = [];
  const indices = [];
  const erreurs = [];

  for (const ligne of lignes) {
    if (/^(Symbole|Toutes|Top\s*5|Flop\s*5|Dernière mise à jour)/i.test(ligne)) continue;

    const mIndice = ligne.match(regexIndice);
    if (mIndice) {
      const nomIndice = mIndice[1].toUpperCase() === 'BRVM-COMPOSITE' ? 'BRVM-C' : mIndice[1].toUpperCase();
      indices.push({ indice: nomIndice, valeur: nettoyerNombre(mIndice[2]) });
      continue;
    }

    const mDetaille = ligne.match(regexDetaille);
    if (mDetaille) {
      const nomBrut = mDetaille[2].trim();
      resultats.push({
        ticker: mDetaille[1].toUpperCase(),
        cours: nettoyerNombre(mDetaille[6]), // cours de clôture (4e nombre)
        variation_pct: nettoyerNombre(mDetaille[7]),
        volume: nettoyerNombre(mDetaille[3]), // 1er nombre après le nom
        nom: nomBrut,
        pays: deduirePays(nomBrut)
      });
      continue;
    }

    const mSimple = ligne.match(regexSimple);
    if (mSimple) {
      resultats.push({
        ticker: mSimple[1].toUpperCase(),
        cours: nettoyerNombre(mSimple[2]),
        variation_pct: nettoyerNombre(mSimple[3]),
        volume: null,
        nom: null,
        pays: null
      });
      continue;
    }

    erreurs.push(ligne);
  }

  if (resultats.length === 0) {
    const regexBlocDetaille = new RegExp(
      `([A-Z0-9]{3,6})\\s+.+?\\s+${NUM}\\s+${NUM}\\s+(${NUM})\\s+(${NUM})\\s*%?`, 'g'
    );
    let m;
    while ((m = regexBlocDetaille.exec(texteColle)) !== null) {
      resultats.push({ ticker: m[1].toUpperCase(), cours: nettoyerNombre(m[2]), variation_pct: nettoyerNombre(m[3]) });
    }
    const regexBlocSimple = new RegExp(`([A-Z0-9]{3,6})\\s+(${NUM})\\s+(${NUM})\\s*%`, 'g');
    while ((m = regexBlocSimple.exec(texteColle)) !== null) {
      resultats.push({ ticker: m[1].toUpperCase(), cours: nettoyerNombre(m[2]), variation_pct: nettoyerNombre(m[3]) });
    }
    if (resultats.length > 0) erreurs.length = 0;
  }

  return { resultats, indices, erreurs };
}

module.exports = { parseColleBRVM };
