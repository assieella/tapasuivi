// Contenu de départ du parcours de formation TAPA INVEST.
// Le quiz (questions) de chaque module est ajouté séparément une fois reçu de Ella,
// via /admin-formation.html (édition du module) ou un futur ajout à ce fichier.

const MODULES_SEED = [
  {
    ordre: 1,
    titre: 'MODULE I : LE MARCHÉ BOURSIER',
    description: null,
    seuil_reussite: 60,
    questions: [
      { question: "Qu'est-ce qu'un marché boursier ?", options: ["Un marché où l'on vend uniquement des marchandises", "Un marché organisé où s'échangent des titres financiers", "Une banque spécialisée dans les crédits", "Une administration chargée de collecter les impôts"], bonne_reponse: 1 },
      { question: "Quel est le rôle principal de la BRVM ?", options: ["Accorder directement des crédits aux entreprises", "Fixer les taux d'intérêt des banques", "Organiser les transactions sur les titres financiers dans l'UEMOA", "Gérer les comptes bancaires des investisseurs"], bonne_reponse: 2 },
      { question: "Que signifie BRVM ?", options: ["Banque Régionale des Valeurs Monétaires", "Bourse Régionale des Valeurs Mobilières", "Bureau Régional de Vérification des Marchés", "Banque des Ressources et Valeurs Mobilières"], bonne_reponse: 1 },
      { question: "Quel acteur permet généralement à un investisseur d'acheter ou de vendre des titres à la BRVM ?", options: ["Une compagnie d'assurance", "Une mairie", "Une Société de Gestion et d'Intermédiation, SGI", "Une institution de microfinance"], bonne_reponse: 2 },
      { question: "Quel est le rôle d'une SGI ?", options: ["Produire les billets de banque", "Exécuter les ordres d'achat et de vente des investisseurs", "Fixer le prix des actions", "Garantir un bénéfice aux investisseurs"], bonne_reponse: 1 },
      { question: "Qu'est-ce qu'une action ?", options: ["Une dette contractée par l'investisseur", "Une part du capital d'une entreprise", "Un compte d'épargne bancaire", "Une assurance contre les pertes"], bonne_reponse: 1 },
      { question: "Qu'est-ce qu'une obligation ?", options: ["Une part du capital d'une société", "Un prêt accordé à un État ou à une entreprise", "Une monnaie électronique", "Une garantie automatique de rendement"], bonne_reponse: 1 },
      { question: "À quoi sert le Bulletin officiel de la cote ?", options: ["À présenter les cours et les informations sur les titres cotés", "À publier les salaires des dirigeants d'entreprise", "À accorder des crédits aux investisseurs", "À annoncer uniquement les nouvelles introductions en Bourse"], bonne_reponse: 0 },
      { question: "Dans un bulletin de cote, que représente le cours de clôture ?", options: ["Le premier prix enregistré pendant la séance", "Le prix moyen fixé par la banque centrale", "Le dernier cours retenu à la fin de la séance boursière", "Le prix auquel l'entreprise a été créée"], bonne_reponse: 2 },
      { question: "Qu'est-ce qu'un indice boursier ?", options: ["Un indicateur qui mesure l'évolution d'un ensemble de titres", "Le taux d'intérêt d'un crédit bancaire", "La commission payée à une SGI", "Le nombre d'actionnaires d'une entreprise"], bonne_reponse: 0 },
      { question: "Quel indice représente l'ensemble des actions cotées à la BRVM ?", options: ["BRVM Composite", "Nasdaq Composite", "Dow Jones", "CAC 40"], bonne_reponse: 0 },
      { question: "Parmi les produits suivants, lequel est un organisme de placement collectif ?", options: ["Un compte courant", "Un FCP", "Un crédit à la consommation", "Une carte bancaire"], bonne_reponse: 1 }
    ],
    lecons: [
      { ordre: 1, titre: 'Leçon 1 : Les acteurs', youtube_id: 'dF0stIfmF3M' },
      { ordre: 2, titre: 'Leçon 2 : La BRVM', youtube_id: 'P2fELNPE4pI' },
      { ordre: 3, titre: 'Leçon 3 : Les indices boursiers', youtube_id: 'c1ElyNQOTpM' },
      { ordre: 4, titre: 'Leçon 4 : Le bulletin de cote I', youtube_id: 'hxVXDpKqQA0' },
      { ordre: 5, titre: 'Leçon 4A : Le bulletin de cote II', youtube_id: 'zOn1VK12AD0' },
      { ordre: 6, titre: 'Leçon 5 : Les produits financiers', youtube_id: 'b2Fd7dreGJE' }
    ]
  },
  {
    ordre: 2,
    titre: 'MODULE II : DÉBUTER À LA BRVM',
    description: null,
    seuil_reussite: 60,
    questions: [
      { question: "Quelle est généralement la première démarche pour investir directement à la BRVM ?", options: ["Se rendre au siège d'une société cotée", "Contacter une SGI", "Créer une entreprise", "Demander un crédit bancaire"], bonne_reponse: 1 },
      { question: "Que signifie le sigle SGI ?", options: ["Société de Gestion des Investissements", "Service Général des Investisseurs", "Société de Gestion et d'Intermédiation", "Système Général d'Investissement"], bonne_reponse: 2 },
      { question: "Quel compte faut-il généralement ouvrir pour acheter des actions à la BRVM ?", options: ["Un compte d'épargne", "Un compte mobile money", "Un compte-titres", "Un compte de crédit"], bonne_reponse: 2 },
      { question: "Après l'ouverture du compte-titres, que doit faire l'investisseur avant de passer son ordre d'achat ?", options: ["Alimenter son compte en argent", "Fermer son compte bancaire", "Obtenir l'autorisation de l'entreprise cotée", "Acheter obligatoirement une formation"], bonne_reponse: 0 },
      { question: "Qu'est-ce qu'un ordre d'achat ?", options: ["Une demande adressée à la SGI pour acheter un titre", "Un prêt accordé à l'investisseur", "Une promesse de dividende", "Une demande adressée directement au dirigeant de l'entreprise"], bonne_reponse: 0 },
      { question: "Quel élément doit être précisé dans un ordre d'achat ?", options: ["Le salaire du dirigeant de la société", "Le nom ou le symbole du titre à acheter", "Le nombre d'employés de la SGI", "Le montant des impôts de l'investisseur"], bonne_reponse: 1 },
      { question: "UBA Côte d'Ivoire est-elle actuellement une société cotée à la BRVM ?", options: ["Oui", "Non", "Seulement le vendredi", "Seulement sur le marché obligataire"], bonne_reponse: 1 },
      { question: "Parmi ces entreprises, laquelle est cotée à la BRVM ?", options: ["Orange Côte d'Ivoire", "UBA Côte d'Ivoire", "Wave Côte d'Ivoire", "Moov Money Côte d'Ivoire"], bonne_reponse: 0 },
      { question: "Parmi ces banques, laquelle est cotée à la BRVM ?", options: ["Ecobank Côte d'Ivoire", "UBA Côte d'Ivoire", "Banque Atlantique Côte d'Ivoire", "Standard Chartered Côte d'Ivoire"], bonne_reponse: 0 },
      { question: "Sonatel Sénégal est-elle cotée à la BRVM ?", options: ["Oui", "Non", "Uniquement sur une Bourse européenne", "Uniquement sur le marché des obligations"], bonne_reponse: 0 },
      { question: "Pour choisir une première action, quelle pratique est la plus appropriée ?", options: ["Acheter uniquement parce que l'entreprise est populaire", "Acheter parce qu'un proche a promis un gain rapide", "Étudier l'entreprise, son activité, ses résultats et le prix de son action", "Investir la totalité de son épargne de sécurité"], bonne_reponse: 2 },
      { question: "Une action coûte 5 000 FCFA et l'investisseur souhaite en acheter 10. Quel est le montant de l'achat, hors frais ?", options: ["5 000 FCFA", "15 000 FCFA", "50 000 FCFA", "500 000 FCFA"], bonne_reponse: 2 }
    ],
    lecons: [
      { ordre: 1, titre: 'Leçon 1 : Le processus', youtube_id: 'jjDvJtpcwNY' },
      { ordre: 2, titre: 'Leçon 2 : Choisir ses premières actions', youtube_id: 'cHPTDiknq5E' }
    ]
  },
  {
    ordre: 3,
    titre: 'MODULE III : MODE D\'INVESTISSEMENT',
    description: null,
    seuil_reussite: 60,
    questions: [
      { question: "Qu'est-ce qu'une stratégie de croissance en Bourse ?", options: ["Acheter des actions uniquement pour recevoir des dividendes", "Acheter des actions dont la valeur pourrait augmenter avec le temps", "Placer son argent sur un compte bancaire", "Acheter uniquement des obligations d'État"], bonne_reponse: 1 },
      { question: "Quel est l'objectif principal d'un investisseur qui adopte une stratégie de croissance ?", options: ["Obtenir principalement une augmentation de la valeur de son capital", "Recevoir un salaire mensuel garanti", "Éviter toute variation du marché", "Récupérer immédiatement son investissement"], bonne_reponse: 0 },
      { question: "Qu'est-ce qu'une plus-value ?", options: ["La somme versée par une entreprise à ses salariés", "La différence positive entre le prix de vente et le prix d'achat d'un titre", "Les frais facturés par la SGI", "Le montant total des dividendes reçus"], bonne_reponse: 1 },
      { question: "Un investisseur achète une action à 5 000 FCFA et la revend à 7 000 FCFA. Quelle est sa plus-value, hors frais ?", options: ["2 000 FCFA", "5 000 FCFA", "7 000 FCFA", "12 000 FCFA"], bonne_reponse: 0 },
      { question: "Qu'est-ce qu'une stratégie de rente ?", options: ["Une stratégie qui vise à recevoir régulièrement des revenus issus de ses placements", "Une stratégie qui consiste à vendre toutes ses actions rapidement", "Une méthode permettant d'éviter totalement les pertes", "Une stratégie réservée uniquement aux banques"], bonne_reponse: 0 },
      { question: "Quel revenu est principalement recherché dans une stratégie de rente basée sur les actions ?", options: ["Le salaire", "Le crédit", "Le dividende", "La commission bancaire"], bonne_reponse: 2 },
      { question: "Qu'est-ce qu'un dividende ?", options: ["Une partie du bénéfice qu'une entreprise peut distribuer à ses actionnaires", "Le prix d'achat obligatoire d'une action", "Un remboursement effectué par la SGI", "Une garantie de bénéfice accordée à l'investisseur"], bonne_reponse: 0 },
      { question: "Une entreprise est-elle obligée de verser un dividende chaque année ?", options: ["Oui, dans tous les cas", "Oui, dès qu'elle est cotée en Bourse", "Non, le versement dépend notamment des résultats et de la décision des organes compétents", "Non, car aucune entreprise cotée ne verse de dividende"], bonne_reponse: 2 },
      { question: "Quelle entreprise convient généralement le mieux à une stratégie de rente ?", options: ["Une entreprise qui ne réalise jamais de chiffre d'affaires", "Une entreprise stable qui distribue régulièrement des dividendes", "Une entreprise choisie uniquement parce que son action est moins chère", "Une entreprise dont les informations financières sont inconnues"], bonne_reponse: 1 },
      { question: "Quelle différence principale existe entre la stratégie de croissance et la stratégie de rente ?", options: ["La croissance recherche surtout l'augmentation de la valeur du capital, tandis que la rente recherche surtout des revenus réguliers", "La croissance est réservée aux banques et la rente aux particuliers", "La rente ne comporte aucun risque", "La croissance garantit toujours un rendement supérieur"], bonne_reponse: 0 },
      { question: "Un investisseur peut-il combiner une stratégie de croissance et une stratégie de rente ?", options: ["Non, il doit obligatoirement choisir une seule stratégie", "Oui, il peut détenir des actions de croissance et des actions à dividendes", "Non, cette combinaison est interdite à la BRVM", "Oui, mais seulement s'il possède une banque"], bonne_reponse: 1 },
      { question: "Avant de choisir son mode d'investissement, quel élément est le plus important ?", options: ["Copier systématiquement les décisions des autres investisseurs", "Choisir uniquement les actions les moins chères", "Définir ses objectifs, son horizon de placement et sa tolérance au risque", "Investir tout son argent sur une seule action"], bonne_reponse: 2 }
    ],
    lecons: [
      { ordre: 1, titre: 'Leçon 1 : Stratégie d\'investissement', youtube_id: 'gU_T9Paweos' }
    ]
  },
  {
    ordre: 4,
    titre: 'MODULE IV : LA GESTION DES RISQUES',
    description: null,
    seuil_reussite: 60,
    questions: [
      { question: "Avant de commencer à investir en Bourse, quelle est l'une des premières précautions à prendre ?", options: ["Emprunter immédiatement de l'argent", "Constituer un fonds de sécurité", "Acheter les actions les moins chères", "Investir tout son salaire"], bonne_reponse: 1 },
      { question: "Qu'est-ce qu'un fonds de sécurité ?", options: ["Une somme destinée uniquement à acheter des actions", "Une réserve d'argent disponible pour faire face aux imprévus", "Une prime versée par la SGI", "Un bénéfice garanti par une entreprise cotée"], bonne_reponse: 1 },
      { question: "Pourquoi faut-il constituer un fonds de sécurité avant d'investir ?", options: ["Pour pouvoir faire face aux urgences sans vendre ses placements précipitamment", "Pour obtenir automatiquement des dividendes", "Pour éviter de payer les frais de Bourse", "Pour garantir l'augmentation du cours des actions"], bonne_reponse: 0 },
      { question: "Quelle dépense peut être financée par un fonds de sécurité ?", options: ["L'achat régulier d'actions", "Une urgence médicale ou une perte temporaire de revenus", "L'achat d'un produit de luxe", "Une dépense de divertissement prévue"], bonne_reponse: 1 },
      { question: "Quelle affirmation est la plus juste concernant les dettes avant d'investir ?", options: ["Toutes les dettes doivent toujours être ignorées", "Il faut analyser et mieux gérer ses dettes, particulièrement celles qui coûtent cher", "Il faut contracter de nouvelles dettes pour investir davantage", "Les dettes n'ont aucun effet sur la capacité d'investissement"], bonne_reponse: 1 },
      { question: "Quel argent est-il préférable d'utiliser pour investir ?", options: ["L'argent prévu pour le loyer", "L'argent destiné aux dépenses alimentaires", "Une épargne disponible dont on n'a pas besoin immédiatement", "L'argent emprunté pour régler une urgence"], bonne_reponse: 2 },
      { question: "Pourquoi faut-il définir un objectif avant d'investir ?", options: ["Pour savoir pourquoi l'on investit, combien investir et pendant combien de temps", "Pour garantir un rendement élevé", "Pour éviter de suivre son portefeuille", "Pour acheter automatiquement les mêmes actions que ses proches"], bonne_reponse: 0 },
      { question: "Qu'est-ce que le risque en matière d'investissement ?", options: ["La certitude de gagner de l'argent", "La possibilité que le rendement soit différent de ce qui était prévu, avec un risque de perte", "Le montant obligatoirement versé par l'entreprise", "La commission payée chaque mois à l'investisseur"], bonne_reponse: 1 },
      { question: "Qu'est-ce que la diversification ?", options: ["Investir tout son argent dans une seule entreprise", "Répartir ses investissements entre plusieurs titres, entreprises ou secteurs", "Changer de SGI chaque semaine", "Acheter uniquement les actions qui ont récemment augmenté"], bonne_reponse: 1 },
      { question: "Quel est le principal avantage de la diversification ?", options: ["Elle supprime totalement le risque de perte", "Elle permet de répartir le risque au lieu de dépendre d'un seul investissement", "Elle garantit des dividendes chaque année", "Elle permet d'investir sans aucune analyse"], bonne_reponse: 1 },
      { question: "Un investisseur place tout son argent dans une seule action. Quel risque prend-il ?", options: ["Son portefeuille dépend fortement des résultats d'une seule entreprise", "Il ne peut subir aucune perte", "Il recevra obligatoirement un dividende élevé", "Son investissement devient automatiquement sécurisé"], bonne_reponse: 0 },
      { question: "Quelle attitude est la plus appropriée lorsque le cours d'une action baisse momentanément ?", options: ["Vendre immédiatement sans analyser la situation", "Emprunter pour acheter davantage sans réfléchir", "Revoir les raisons de son investissement et analyser l'entreprise avant de décider", "Ne plus jamais consulter son portefeuille"], bonne_reponse: 2 }
    ],
    lecons: [
      { ordre: 1, titre: 'Leçon 1 : La gestion des risques', youtube_id: 'JdRp4EKuvTE' }
    ]
  },
  {
    ordre: 5,
    titre: 'BONUS — DÉCOUVRIR LES FONDS COMMUNS DE PLACEMENT',
    description: 'Module bonus, facultatif.',
    seuil_reussite: 60,
    questions: [
      { question: 'Que signifie FCP ?', options: ['Fonds de crédit personnel', 'Fonds commun de placement', 'Financement collectif permanent', 'Fonds de croissance privée'], bonne_reponse: 1 },
      { question: "Dans un FCP, l'argent des investisseurs est :", options: ['conservé uniquement en espèces', 'prêté automatiquement à une seule entreprise', 'mis en commun et investi dans différents produits financiers', 'garanti par la Bourse'], bonne_reponse: 2 },
      { question: "Lorsqu'un investisseur place son argent dans un FCP, il achète généralement :", options: ['des parts du fonds', 'un compte bancaire', 'un crédit', 'une assurance automobile'], bonne_reponse: 0 },
      { question: "Quel est l'un des avantages possibles d'un FCP ?", options: ['Il garantit toujours un bénéfice.', 'Il permet de diversifier son investissement plus facilement.', 'Il supprime tous les risques.', 'Il permet d\'éviter tous les frais.'], bonne_reponse: 1 },
      { question: "Avant d'investir dans un FCP, que faut-il vérifier ?", options: ['Uniquement le nom du fonds', 'Seulement le montant du premier versement', 'Le risque, les frais, la stratégie et la durée recommandée', 'La popularité du gestionnaire sur les réseaux sociaux'], bonne_reponse: 2 }
    ],
    lecons: [
      {
        ordre: 1,
        titre: 'Découvrir les FCP',
        type: 'texte',
        contenu_texte: `
<h3 style="margin-top:0;">Qu'est-ce qu'un FCP ?</h3>
<p>Un Fonds Commun de Placement, appelé FCP, est un produit d'investissement qui permet à plusieurs personnes de mettre leur argent en commun.</p>
<p>L'argent collecté est ensuite investi dans différents produits financiers, comme :</p>
<ul>
  <li>des actions ;</li>
  <li>des obligations ;</li>
  <li>des titres d'État ;</li>
  <li>des placements monétaires.</li>
</ul>
<p>Le fonds est géré par des professionnels qui sélectionnent les investissements selon la stratégie du FCP.</p>

<h3>Comment fonctionne un FCP ?</h3>
<p>Lorsqu'une personne investit dans un FCP, elle n'achète pas directement les actions d'une seule entreprise. Elle achète des parts du fonds.</p>
<p>La valeur d'une part peut augmenter ou diminuer selon l'évolution des placements détenus par le fonds.</p>

<h3>Pourquoi investir dans un FCP ?</h3>
<p>Le FCP peut permettre à un débutant :</p>
<ul>
  <li>d'investir sans choisir lui-même chaque action ;</li>
  <li>de bénéficier d'une gestion professionnelle ;</li>
  <li>de diversifier plus facilement son investissement ;</li>
  <li>de commencer avec un montant adapté aux conditions du fonds.</li>
</ul>

<h3>Quels sont les risques ?</h3>
<p>Un FCP n'est pas un placement sans risque. La valeur des parts peut évoluer à la hausse comme à la baisse. Le niveau de risque dépend des produits dans lesquels le fonds investit.</p>
<p>Par exemple, un FCP principalement composé d'actions peut être plus risqué qu'un fonds composé majoritairement de placements monétaires ou d'obligations.</p>
<p>Avant d'investir, il est important de vérifier :</p>
<ul>
  <li>l'objectif du fonds ;</li>
  <li>le niveau de risque ;</li>
  <li>la durée de placement recommandée ;</li>
  <li>les frais ;</li>
  <li>les conditions de retrait ;</li>
  <li>les performances passées, sans les considérer comme une garantie des performances futures.</li>
</ul>

<h3>À retenir</h3>
<p>Le FCP est une solution intéressante pour une personne qui souhaite investir progressivement tout en bénéficiant d'une gestion professionnelle et d'une meilleure diversification.</p>
<p>Cependant, comme tout investissement, il comporte des risques. Il faut donc choisir un fonds adapté à son objectif, à son horizon de placement et à sa tolérance au risque.</p>
        `.trim()
      }
    ]
  }
];

module.exports = { MODULES_SEED };
