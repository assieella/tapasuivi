const INFO_FIELDS = [
  { id: 'profession', label: "Profession / activité", type: 'text', required: true },
  { id: 'revenu_mensuel', label: "Revenus mensuels estimés (FCFA)", type: 'number', required: true },
  { id: 'capital_disponible', label: "Capital disponible pour investir (FCFA)", type: 'number', required: true },
  { id: 'situation_familiale', label: "Situation familiale", type: 'select', required: true, options: ['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf(ve)'] },
  { id: 'nombre_enfants', label: "Nombre d'enfants à charge", type: 'number', required: true }
];

const QUESTIONS = [
  { id: 'objectif', categorie: 'Objectifs', label: "Quel est votre objectif principal ?",
    options: [{ value: 1, label: "Protéger mon capital avant tout" }, { value: 2, label: "Un équilibre entre sécurité et performance" }, { value: 3, label: "Faire croître mon capital significativement" }, { value: 4, label: "Maximiser la performance, quitte à prendre des risques" }] },
  { id: 'horizon', categorie: 'Objectifs', label: "Sur combien de temps comptez-vous laisser cet argent investi sans y toucher ?",
    options: [{ value: 1, label: "Moins d'1 an" }, { value: 2, label: "1 à 3 ans" }, { value: 3, label: "3 à 5 ans" }, { value: 4, label: "Plus de 5 ans" }] },
  { id: 'age', categorie: 'Objectifs', label: "Dans quelle tranche d'âge vous situez-vous ?",
    options: [{ value: 1, label: "Plus de 55 ans" }, { value: 2, label: "41 à 55 ans" }, { value: 3, label: "30 à 40 ans" }, { value: 4, label: "Moins de 30 ans" }] },
  { id: 'experience', categorie: 'Connaissances', label: "Quelle est votre expérience en investissement / bourse ?",
    options: [{ value: 1, label: "Aucune, je débute complètement" }, { value: 2, label: "Débutant(e), quelques notions" }, { value: 3, label: "Intermédiaire, j'ai déjà investi" }, { value: 4, label: "Expérimenté(e)" }] },
  { id: 'connaissance_produits', categorie: 'Connaissances', label: "Comment évaluez-vous votre connaissance des produits financiers (actions, obligations, OPCVM) ?",
    options: [{ value: 1, label: "Je ne connais pas ces termes" }, { value: 2, label: "J'en ai entendu parler, sans plus" }, { value: 3, label: "Je comprends les grandes différences" }, { value: 4, label: "Je maîtrise bien ces notions" }] },
  { id: 'suivi_actualite', categorie: 'Connaissances', label: "Suivez-vous l'actualité économique et boursière (BRVM, taux, entreprises cotées) ?",
    options: [{ value: 1, label: "Jamais" }, { value: 2, label: "Occasionnellement" }, { value: 3, label: "Régulièrement" }, { value: 4, label: "De façon assidue" }] },
  { id: 'reaction_baisse', categorie: 'Tolérance au risque', label: "Si votre portefeuille perdait 15% de sa valeur en quelques mois, que feriez-vous ?",
    options: [{ value: 1, label: "Je retire tout immédiatement" }, { value: 2, label: "Je suis inquiet(ète) mais j'attends" }, { value: 3, label: "Je ne change rien, c'est normal en bourse" }, { value: 4, label: "J'investis davantage, c'est une opportunité" }] },
  { id: 'comportement_passe', categorie: 'Tolérance au risque', label: "Par le passé, avez-vous déjà revendu un placement par peur, suite à une baisse ?",
    options: [{ value: 1, label: "Oui, souvent" }, { value: 2, label: "Oui, une ou deux fois" }, { value: 3, label: "Non, jamais" }, { value: 4, label: "Je n'ai jamais eu ce genre de doute" }] },
  { id: 'attentes_rendement', categorie: 'Tolérance au risque', label: "Quel niveau de rendement annuel espérez-vous, en toute connaissance des risques ?",
    options: [{ value: 1, label: "Faible, mais avec un capital garanti" }, { value: 2, label: "Modéré, avec un risque limité" }, { value: 3, label: "Élevé, en acceptant des fluctuations" }, { value: 4, label: "Le plus élevé possible, quitte à risquer davantage" }] },
  { id: 'part_patrimoine', categorie: 'Capacité financière', label: "Quelle part de votre épargne totale représente ce montant à investir ?",
    options: [{ value: 1, label: "La quasi-totalité de mon épargne" }, { value: 2, label: "Une part importante" }, { value: 3, label: "Une part raisonnable, j'ai d'autres réserves" }, { value: 4, label: "Une petite part, j'ai beaucoup d'autres réserves" }] },
  { id: 'revenu_stabilite', categorie: 'Capacité financière', label: "Comment décririez-vous la stabilité de vos revenus actuels ?",
    options: [{ value: 1, label: "Instable / incertaine" }, { value: 2, label: "Plutôt stable" }, { value: 3, label: "Stable" }, { value: 4, label: "Très stable avec capacité d'épargne régulière" }] },
  { id: 'capacite_epargne', categorie: 'Capacité financière', label: "Après vos charges mensuelles, quelle est votre capacité d'épargne actuelle ?",
    options: [{ value: 1, label: "Très faible ou nulle" }, { value: 2, label: "Faible mais régulière" }, { value: 3, label: "Correcte" }, { value: 4, label: "Confortable" }] },
  { id: 'endettement', categorie: 'Capacité financière', label: "Avez-vous des dettes ou crédits en cours importants ?",
    options: [{ value: 1, label: "Oui, un endettement important" }, { value: 2, label: "Oui, un endettement modéré" }, { value: 3, label: "Un endettement faible" }, { value: 4, label: "Aucune dette" }] },
  { id: 'besoin_liquidite', categorie: 'Contraintes', label: "Dans les 12 prochains mois, pensez-vous avoir besoin de retirer une partie importante de cet argent ?",
    options: [{ value: 1, label: "Oui, probablement" }, { value: 2, label: "Peut-être, je ne suis pas sûr(e)" }, { value: 3, label: "Non, sauf imprévu majeur" }, { value: 4, label: "Non, pas du tout" }] }
];

const MAX_SCORE = QUESTIONS.length * 4;
const MIN_SCORE = QUESTIONS.length * 1;

function computeProfile(answers) {
  let score = 0;
  for (const q of QUESTIONS) {
    const v = Number(answers[q.id]);
    if (!v || v < 1 || v > 4) throw new Error(`Réponse manquante ou invalide pour la question : ${q.id}`);
    score += v;
  }
  let profile_type;
  if (score <= 24) profile_type = 'Prudent';
  else if (score <= 36) profile_type = 'Équilibré';
  else if (score <= 48) profile_type = 'Dynamique';
  else profile_type = 'Offensif';
  return { score, profile_type, max_score: MAX_SCORE };
}

const PROFILE_RECOMMENDATIONS = {
  Prudent: { taux_rendement_estime: 0.04, allocation: "70% obligations / titres de rendement stables, 20% actions défensives BRVM (ex : secteur agro-industriel, distribution), 10% liquidités.", conseil: "Privilégiez les valeurs BRVM à dividendes réguliers et une entrée progressive sur le marché plutôt qu'un investissement en une seule fois." },
  'Équilibré': { taux_rendement_estime: 0.07, allocation: "50% actions BRVM diversifiées (banques, agro-industrie, télécoms), 35% obligations/titres de rendement, 15% liquidités.", conseil: "Diversifiez sur 6 à 8 titres BRVM de secteurs différents et réinvestissez les dividendes." },
  Dynamique: { taux_rendement_estime: 0.10, allocation: "70% actions BRVM (croissance et rendement), 20% obligations, 10% liquidités.", conseil: "Vous pouvez viser des titres à fort potentiel de croissance en plus des valeurs sûres, en gardant une part de liquidités pour saisir les opportunités." },
  Offensif: { taux_rendement_estime: 0.13, allocation: "85% actions BRVM (forte croissance), 15% liquidités pour opportunités.", conseil: "Concentrez-vous sur un nombre restreint de titres à fort potentiel, tout en gardant à l'esprit que la volatilité sera plus forte." }
};

function validerInfos(infos) {
  const out = {};
  for (const f of INFO_FIELDS) {
    const v = infos ? infos[f.id] : undefined;
    if (f.required && (v === undefined || v === null || v === '')) throw new Error(`Le champ "${f.label}" est requis.`);
    if (f.type === 'number') {
      const n = Number(v);
      if (Number.isNaN(n) || n < 0) throw new Error(`Le champ "${f.label}" doit être un nombre valide.`);
      out[f.id] = n;
    } else if (f.type === 'select') {
      if (!f.options.includes(v)) throw new Error(`Valeur invalide pour "${f.label}".`);
      out[f.id] = v;
    } else {
      out[f.id] = String(v).trim();
    }
  }
  return out;
}

function getReponseLabel(questionId, value) {
  const q = QUESTIONS.find(q => q.id === questionId);
  if (!q) return null;
  const opt = q.options.find(o => o.value === Number(value));
  return opt ? opt.label : null;
}

module.exports = { QUESTIONS, INFO_FIELDS, computeProfile, validerInfos, getReponseLabel, PROFILE_RECOMMENDATIONS, MAX_SCORE, MIN_SCORE };
