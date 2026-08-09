const comentariosService = require('../services/comentarios.service');
const controlador = require('../utils/controlador');

const listarPorTarea = controlador('Error al obtener los comentarios', async (req, res) => {
  const comentarios = await comentariosService.listar(req.params.id, req.usuario, req.query.como);
  res.json(comentarios);
});

const crear = controlador('Error al publicar el comentario', async (req, res) => {
  const comentario = await comentariosService.crear(req.params.id, req.body.contenido, req.usuario, req.query.como);
  res.status(201).json(comentario);
});

const eliminar = controlador('Error al eliminar el comentario', async (req, res) => {
  await comentariosService.eliminar(req.params.id, req.usuario, req.query.como);
  res.json({ message: 'Comentario eliminado' });
});

module.exports = { listarPorTarea, crear, eliminar };
