const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' });
  try {
    req.usuario = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

function requireAdmin(req, res, next) {
  if (req.usuario.rol !== 'admin') return res.status(403).json({ error: 'Solo el administrador puede realizar esta acción' });
  next();
}

function requireAdminOProfesor(req, res, next) {
  if (req.usuario.rol !== 'admin' && req.usuario.rol !== 'profesor') {
    return res.status(403).json({ error: 'Solo el profesor o el administrador pueden realizar esta acción' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireAdminOProfesor };
