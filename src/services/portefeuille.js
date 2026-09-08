// Calcule les positions actuelles d'un portefeuille à partir de ses transactions
// (achats et ventes), et son évolution mensuelle pour le diagramme de suivi.

// Regroupe les transactions par titre et calcule quantité détenue, prix moyen d'achat,
// et montant net investi (achats - ventes), au prorata pour la méthode du coût moyen.
function calculerPositions(transactions, dernierCoursParTicker) {
  const parTicker = {};

  for (const t of transactions) {
    if (!parTicker[t.ticker]) {
      parTicker[t.ticker] = { ticker: t.ticker, quantite_detenue: 0, cout_total_achats: 0, quantite_achetee_total: 0 };
    }
    const pos = parTicker[t.ticker];
    const qte = Number(t.quantite);
    const prix = Number(t.prix_unitaire);

    if (t.type === 'achat') {
      pos.quantite_detenue += qte;
      pos.cout_total_achats += qte * prix;
      pos.quantite_achetee_total += qte;
    } else {
      pos.quantite_detenue -= qte;
    }
  }

  const positions = Object.values(parTicker)
    .filter(p => p.quantite_detenue > 0)
    .map(p => {
      const prix_moyen_achat = p.quantite_achetee_total > 0 ? p.cout_total_achats / p.quantite_achetee_total : 0;
      const dernierCours = dernierCoursParTicker[p.ticker] || null;
      const valeur_actuelle = dernierCours ? p.quantite_detenue * dernierCours.cours : null;
      const cout_position = p.quantite_detenue * prix_moyen_achat;
      const plus_value = valeur_actuelle !== null ? valeur_actuelle - cout_position : null;
      return {
        ticker: p.ticker,
        quantite_detenue: p.quantite_detenue,
        prix_moyen_achat: Math.round(prix_moyen_achat),
        dernier_cours: dernierCours ? dernierCours.cours : null,
        valeur_actuelle: valeur_actuelle !== null ? Math.round(valeur_actuelle) : null,
        plus_value: plus_value !== null ? Math.round(plus_value) : null
      };
    });

  return positions;
}

// Montant net investi = total des achats - total des ventes (capital actuellement engagé)
function calculerMontantNetInvesti(transactions) {
  let net = 0;
  for (const t of transactions) {
    const montant = Number(t.quantite) * Number(t.prix_unitaire);
    net += t.type === 'achat' ? montant : -montant;
  }
  return Math.round(net);
}

module.exports = { calculerPositions, calculerMontantNetInvesti };
