const anunciosService = require('../services/anuncios.service');
const controlador = require('../utils/controlador');

const listarPorMateria = controlador('Error al obtener los anuncios', async (req, res) => {
  const anuncios = await anunciosService.listar(req.params.id, req.usuario, req.query.como);
  res.json(anuncios);
});

const crear = controlador('Error al publicar el anuncio', async (req, res) => {
  const anuncio = await anunciosService.crear(req.params.id, req.body.contenido, req.usuario);
  res.status(201).json(anuncio);
});

const eliminar = controlador('Error al eliminar el anuncio', async (req, res) => {
  await anunciosService.eliminar(req.params.id, req.usuario);
  res.json({ message: 'Anuncio eliminado' });
});

module.exports = { listarPorMateria, crear, eliminar };
