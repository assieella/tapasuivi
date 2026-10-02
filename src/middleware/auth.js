const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Non authentifié.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session invalide, reconnectez-vous.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé à l\'administrateur.' });
  }
  next();
}

// Vérifie la session admin via son propre cookie (admin_token), séparé de celui du client (token) —
// pour qu'une connexion client dans le même navigateur ne déconnecte plus la session admin, et inversement.
// Se rabat sur le cookie "token" classique si "admin_token" n'existe pas encore (compatibilité avant migration).
function requireAdminAuth(req, res, next) {
  const token = req.cookies?.admin_token || req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Non authentifié.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Accès réservé à l\'administrateur.' });
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session invalide, reconnectez-vous.' });
  }
}

module.exports = { requireAuth, requireAdmin, requireAdminAuth };
