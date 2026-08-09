const fs = require('fs');
const path = require('path');
const tareasRepository = require('../repositories/tareas.repository');
const archivosRepository = require('../repositories/archivos.repository');
const tareasService = require('./tareas.service');
const usuariosService = require('./usuarios.service');
const HttpError = require('../utils/httpError');
const { UPLOADS_DIR } = require('../config/uploads');

async function listar(tareaId, usuario, comoId) {
  const usuarioId = await usuariosService.usuarioEfectivo(usuario, comoId);
  if (!(await tareasRepository.esVisiblePara(tareaId, usuarioId))) {
    throw new HttpError(404, 'Tarea no encontrada');
  }
  return archivosRepository.listarPorTarea(tareaId);
}

async function subir(tareaId, usuario, comoId, archivo) {
  const limpiarArchivoSubido = () => fs.unlink(path.join(UPLOADS_DIR, archivo.filename), () => {});

  const usuarioId = await usuariosService.usuarioEfectivo(usuario, comoId);
  if (!(await tareasRepository.esVisiblePara(tareaId, usuarioId))) {
    limpiarArchivoSubido();
    throw new HttpError(404, 'Tarea no encontrada');
  }

  const motivoBloqueo = await tareasService.motivoEntregaBloqueada(tareaId, usuario);
  if (motivoBloqueo) {
    limpiarArchivoSubido();
    throw new HttpError(403, motivoBloqueo);
  }

  await archivosRepository.crear({
    tareaId,
    usuarioId,
    nombreOriginal: archivo.originalname,
    ruta: archivo.filename
  });
  await tareasRepository.marcarCompletada(tareaId, true);

  return tareasService.conArchivos(tareaId);
}

async function eliminar(tareaId, archivoId, usuario, comoId) {
  const usuarioId = await usuariosService.usuarioEfectivo(usuario, comoId);
  if (!(await tareasRepository.esVisiblePara(tareaId, usuarioId))) {
    throw new HttpError(404, 'Tarea no encontrada');
  }

  const motivoBloqueo = await tareasService.motivoEntregaBloqueada(tareaId, usuario);
  if (motivoBloqueo) throw new HttpError(403, motivoBloqueo);

  const archivo = await archivosRepository.eliminar(archivoId, tareaId);
  if (!archivo) throw new HttpError(404, 'Archivo no encontrado');
  fs.unlink(path.join(UPLOADS_DIR, archivo.ruta), () => {});

  const restantes = await archivosRepository.contarPorTarea(tareaId);
  if (restantes === 0) {
    await tareasRepository.marcarCompletada(tareaId, false);
  }

  return tareasService.conArchivos(tareaId);
}

module.exports = { listar, subir, eliminar };
