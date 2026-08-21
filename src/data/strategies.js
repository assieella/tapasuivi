const STRATEGIES = {
  croissance: {
    nom: 'Croissance',
    description: "Viser des sociétés à fort potentiel de progression du cours, quitte à accepter plus de volatilité. Objectif : faire croître le capital sur la durée, plus que percevoir des revenus réguliers.",
    secteurs: ['Banque', 'Télécoms', 'BTP', 'Distribution']
  },
  rendement: {
    nom: 'Rendement (dividendes)',
    description: "Privilégier des sociétés solides qui versent des dividendes réguliers et significatifs. Objectif : percevoir un revenu régulier de son portefeuille, avec une prise de risque plus mesurée.",
    secteurs: ['Énergie', 'Eau', 'Agro-industrie', 'Agroalimentaire', 'Boissons']
  },
  prudente: {
    nom: 'Prudente (capital préservé)',
    description: "Se concentrer sur les plus grandes valeurs, les plus stables et les moins volatiles de la cote, pour limiter le risque de perte en capital. Objectif : progresser doucement mais sûrement.",
    secteurs: ['Eau', 'Énergie', 'Banque']
  },
  equilibree: {
    nom: 'Équilibrée',
    description: "Répartir le portefeuille entre valeurs de croissance et valeurs de rendement, sur plusieurs secteurs. Objectif : un compromis entre performance et stabilité.",
    secteurs: ['Banque', 'Énergie', 'Agroalimentaire', 'Télécoms', 'Eau']
  }
};

module.exports = { STRATEGIES };
