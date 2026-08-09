const rateLimit = require('express-rate-limit');
const { ORIGENES_PERMITIDOS } = require('../config/env');

const corsOptions = {
  origin: ORIGENES_PERMITIDOS.length > 0 ? ORIGENES_PERMITIDOS : true
};

const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.' }
});

module.exports = { corsOptions, limitadorLogin };
