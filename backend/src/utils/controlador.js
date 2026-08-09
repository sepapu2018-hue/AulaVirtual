const HttpError = require('./httpError');

// Envuelve un handler de ruta: si el service lanza un HttpError responde
// con su status y mensaje; cualquier otro error se registra y responde
// con el mensaje genérico de esa ruta (igual que el manejo original).
function controlador(mensajeErrorGenerico, manejador) {
  return async (req, res) => {
    try {
      await manejador(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error(err);
      res.status(500).json({ error: mensajeErrorGenerico });
    }
  };
}

module.exports = controlador;
