require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const planRoutes = require('./routes/plan');
const adminRoutes = require('./routes/admin');
const programmeRoutes = require('./routes/programme');
const titresRoutes = require('./routes/titres');
const messagesRoutes = require('./routes/messages');
const formationRoutes = require('./routes/formation');
const videosGratuitesRoutes = require('./routes/videos-gratuites');
const leadsDecouverteRoutes = require('./routes/leads-decouverte');
const portefeuilleRoutes = require('./routes/portefeuille');
const blogRoutes = require('./routes/blog');
const ressourcesRoutes = require('./routes/ressources');
const comparateurRoutes = require('./routes/comparateur');
const { demarrerPlanificateur } = require('./services/scheduler');
const pool = require('./db');

// En production, il est obligatoire d'avoir une vraie clé secrète — jamais la valeur de secours
// utilisée en développement, qui est visible dans le code et permettrait de forger de faux comptes admin.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET manquant en production — arrêt du serveur par sécurité.');
  process.exit(1);
}

const app = express();

// Seuls les domaines officiels du site peuvent faire des requêtes authentifiées (avec cookies) —
// empêche un site tiers malveillant d'utiliser la session d'un client connecté.
const originsAutorisees = [
  'https://www.tapa-invest.com',
  'https://tapa-invest.com',
  'https://www.tapaconseilagence.com',
  'https://tapaconseilagence.com'
];
app.use(cors({
  origin: (origin, callback) => {
    // Autorise aussi les requêtes sans origine (Console Railway, tests locaux, apps mobiles) et le domaine Railway lui-même
    if (!origin || originsAutorisees.includes(origin) || origin.endsWith('.up.railway.app')) return callback(null, true);
    callback(new Error('Origine non autorisée par CORS'));
  },
  credentials: true
}));
app.use(helmet({ contentSecurityPolicy: false })); // CSP désactivée pour ne pas casser les scripts inline existants du site
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Protection contre les tentatives de connexion en boucle (force brute) :
// max 10 essais par adresse IP toutes les 15 minutes sur la page de connexion.
const limiteurConnexion = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de connexion. Réessaie dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/login', limiteurConnexion);

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/programme', programmeRoutes);
app.use('/api/titres', titresRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/formation', formationRoutes);
app.use('/api/videos-gratuites', videosGratuitesRoutes);
app.use('/api/leads-decouverte', leadsDecouverteRoutes);
app.use('/api/portefeuille', portefeuilleRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/ressources', ressourcesRoutes);
app.use('/api/comparateur', comparateurRoutes);

// Page article rendue côté serveur, avec les balises Open Graph nécessaires
// pour un bel aperçu quand le lien est partagé sur LinkedIn ou Facebook.
app.get('/blog/:slug', async (req, res) => {
  const echapper = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  try {
    const result = await pool.query('SELECT * FROM articles_blog WHERE slug = $1 AND publie = true', [req.params.slug]);
    if (!result.rows.length) return res.status(404).send('Article introuvable.');
    const a = result.rows[0];
    const url = `${req.protocol}://${req.get('host')}/blog/${a.slug}`;
    const image = a.image_url || `${req.protocol}://${req.get('host')}/images/logo.png`;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${echapper(a.titre)} — Blog TAPA CONSEIL</title>
<meta property="og:title" content="${echapper(a.titre)}">
<meta property="og:description" content="${echapper(a.extrait || '')}">
<meta property="og:image" content="${echapper(image)}">
<meta property="og:url" content="${echapper(url)}">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/css/style.css">
<style>
  .article { font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 0 auto; background: white; }
  .article img.cover { width: 100%; max-height: 380px; object-fit: cover; display: block; }
  .article-corps { padding: 30px; color: #1C2733; line-height: 1.8; font-size: 17px; }
  .article-corps h1 { font-size: 30px; color: #0F2F59; margin-bottom: 8px; }
  .article-corps .date { color: #888; font-size: 13px; margin-bottom: 24px; }
  .article-corps p { margin: 0 0 18px 0; white-space: pre-wrap; }
</style>
</head>
<body>
  <div class="topbar"><div class="brand"><img src="/images/logo.png" alt="TAPA CONSEIL"></div><a href="/blog.html">← Tous les articles</a></div>
  <div class="article">
    ${a.image_url ? `<img class="cover" src="${echapper(a.image_url)}" alt="${echapper(a.titre)}">` : ''}
    <div class="article-corps">
      <h1>${echapper(a.titre)}</h1>
      <p class="date">${new Date(a.date_publication).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <p>${echapper(a.contenu)}</p>
    </div>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur serveur.');
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ TAPA SUIVI démarré sur le port ${PORT}`);
  demarrerPlanificateur();
});
