async function apiCall(url, options = {}) {
  const res = await fetch(url, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Une erreur est survenue.');
    err.acces_termine = data.acces_termine === true;
    throw err;
  }
  return data;
}

// Affiche un écran de blocage en lecture seule (aucun bouton fonctionnel) quand
// l'accompagnement du client est terminé. Retourne true si la page doit s'arrêter là.
function afficherAccesTermine(container) {
  container.innerHTML = `
    <div class="card" style="text-align:center;">
      <h1>Accès indisponible</h1>
      <p>Votre accompagnement est terminé. Votre accès n'est plus disponible.</p>
      <p style="color:#777; font-size:14px;">Contactez TAPA CONSEIL pour renouveler votre accompagnement et retrouver l'accès à votre espace.</p>
      <a href="https://wa.me/2250504775774?text=Bonjour%2C%20je%20voudrais%20renouveler%20mon%20accompagnement%20TAPA%20INVEST." target="_blank"><button class="btn-gold">💬 Nous contacter sur WhatsApp</button></a>
    </div>
  `;
}

async function requireLogin() {
  try { const { user } = await apiCall('/api/auth/me'); return user; }
  catch { window.location.href = '/connexion.html'; return null; }
}

// Utilisée uniquement par les pages du back-office : vérifie la session admin (cookie admin_token),
// séparée de la session client — se connecter en client dans le même navigateur ne la déconnecte plus.
async function requireAdminLogin() {
  try { const { user } = await apiCall('/api/auth/me-admin'); return user; }
  catch { window.location.href = '/connexion.html'; return null; }
}

function renderTickerBanner(containerEl, titres) {
  const avecCours = titres.filter(t => t.cours !== null && t.cours !== undefined);
  if (!avecCours.length) { containerEl.innerHTML = ''; containerEl.style.display = 'none'; return; }
  const items = avecCours.map(t => {
    const variation = Number(t.variation_pct);
    const classe = variation > 0 ? 'up' : (variation < 0 ? 'down' : 'flat');
    const signe = variation > 0 ? '+' : '';
    return `<span class="ticker-item">${t.ticker} <strong>${Number(t.cours).toLocaleString('fr-FR')}</strong> <span class="${classe}">${signe}${variation}%</span></span>`;
  }).join('');
  // Vitesse adaptée au nombre de titres : environ 4 secondes de lecture par titre.
  const duree = Math.max(60, avecCours.length * 4);
  containerEl.innerHTML = `<div class="ticker-track" style="animation-duration: ${duree}s;">${items}${items}</div>`;
  containerEl.style.display = 'block';
}
