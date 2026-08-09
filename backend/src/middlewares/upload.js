const multer = require('multer');
const path = require('path');
const { UPLOADS_DIR } = require('../config/uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const sufijo = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${sufijo}${path.extname(file.originalname)}`);
  }
});

const TIPOS_ARCHIVO_PERMITIDOS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp'
];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_ARCHIVO_PERMITIDOS.includes(file.mimetype)) {
      const error = new Error('Tipo de archivo no permitido. Solo se aceptan PDF, Word e imágenes.');
      error.esTipoArchivoInvalido = true;
      return cb(error);
    }
    cb(null, true);
  }
});

module.exports = upload;
