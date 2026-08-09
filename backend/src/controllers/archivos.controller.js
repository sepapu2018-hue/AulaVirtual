const archivosService = require('../services/archivos.service');
const controlador = require('../utils/controlador');
const HttpError = require('../utils/httpError');

const listarPorTarea = controlador('Error al obtener los archivos', async (req, res) => {
  const archivos = await archivosService.listar(req.params.id, req.usuario, req.query.como);
  res.json(archivos);
});

const subir = controlador('Error al adjuntar el archivo', async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No se recibió ningún archivo');
  const tarea = await archivosService.subir(req.params.id, req.usuario, req.query.como, req.file);
  res.json(tarea);
});

const eliminar = controlador('Error al quitar el archivo', async (req, res) => {
  const tarea = await archivosService.eliminar(req.params.id, req.params.archivoId, req.usuario, req.query.como);
  res.json(tarea);
});

module.exports = { listarPorTarea, subir, eliminar };
