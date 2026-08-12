const notasService = require('../services/notas.service');
const controlador = require('../utils/controlador');

const listarPorMateria = controlador('Error al obtener las notas', async (req, res) => {
  const resumen = await notasService.listarPorMateria(req.params.id, req.usuario);
  res.json(resumen);
});

const misNotas = controlador('Error al obtener tus notas', async (req, res) => {
  const notas = await notasService.misNotas(req.params.id, req.usuario, req.query.como);
  res.json(notas);
});

module.exports = { listarPorMateria, misNotas };
