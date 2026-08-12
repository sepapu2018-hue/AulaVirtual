const { ORIGENES_PERMITIDOS } = require('../config/env');

const corsOptions = {
  origin: ORIGENES_PERMITIDOS.length > 0 ? ORIGENES_PERMITIDOS : true
};

module.exports = { corsOptions };
