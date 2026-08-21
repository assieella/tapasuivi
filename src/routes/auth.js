const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

function setTokenCookie(res, user) {
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, full_name: user.full_name, prenom: user.prenom }, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000 });
  // Si le compte est admin, on pose AUSSI un cookie séparé "admin_token" — ainsi, se connecter ensuite
  // avec un compte client dans le même navigateur ne remplace que "token" et ne coupe pas la session admin.
  if (user.role === 'admin') {
    res.cookie('admin_token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000 });
  }
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, nom, prenom, phone, type_inscription } = req.body;
    if (!email || !password || !nom || !prenom) return res.status(400).json({ error: 'Nom, prénom, email et mot de passe sont requis.' });

    // Seule l'inscription gratuite (vidéos gratuites) reste ouverte au public.
    // Les comptes clients payants sont créés uniquement par TAPA CONSEIL, après règlement.
    if (type_inscription !== 'gratuit') {
      return res.status(403).json({ error: "Les comptes clients sont créés par notre équipe après règlement du programme. Contactez-nous pour démarrer votre accompagnement." });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
    const password_hash = await bcrypt.hash(password, 10);
    const full_name = `${prenom} ${nom}`.trim();
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, nom, prenom, full_name, phone, role) VALUES ($1,$2,$3,$4,$5,$6,'prospect') RETURNING id, email, nom, prenom, full_name, role`,
      [email.toLowerCase(), password_hash, nom, prenom, full_name, phone || null]
    );
    const user = result.rows[0];
    setTokenCookie(res, user);
    res.json({ user });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur serveur lors de la création du compte.' }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [(email || '').toLowerCase()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    setTokenCookie(res, user);
    res.json({ user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur serveur lors de la connexion.' }); }
});

router.post('/logout', (req, res) => {
  // ?scope=admin (utilisé par le bouton "Déconnexion" du back-office) ne coupe que la session admin ;
  // sinon (pages client), on ne coupe que la session client — l'autre reste active dans le même navigateur.
  if (req.query.scope === 'admin') { res.clearCookie('admin_token'); }
  else { res.clearCookie('token'); }
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Non authentifié.' });
  try { res.json({ user: jwt.verify(token, JWT_SECRET) }); }
  catch { res.status(401).json({ error: 'Session invalide.' }); }
});

// Utilisée par les pages du back-office : vérifie la session admin séparément de la session client.
router.get('/me-admin', async (req, res) => {
  const token = req.cookies?.admin_token || req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Non authentifié.' });
  try {
    const user = jwt.verify(token, JWT_SECRET);
    if (user.role !== 'admin') return res.status(403).json({ error: 'Accès réservé à l\'administrateur.' });
    res.json({ user });
  }
  catch { res.status(401).json({ error: 'Session invalide.' }); }
});

module.exports = router;
