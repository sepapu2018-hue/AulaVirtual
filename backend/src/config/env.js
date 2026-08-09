const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'gestortareas_dev_secret_2026';

const ORIGENES_PERMITIDOS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

module.exports = { PORT, JWT_SECRET, ORIGENES_PERMITIDOS };
