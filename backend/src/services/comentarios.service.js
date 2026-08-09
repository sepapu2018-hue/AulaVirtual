const tareasRepository = require('../repositories/tareas.repository');
const comentariosRepository = require('../repositories/comentarios.repository');
const usuariosService = require('./usuarios.service');
const HttpError = require('../utils/httpError');

async function listar(tareaId, usuario, comoId) {
  const usuarioId = await usuariosService.usuarioEfectivo(usuario, comoId);
  if (!(await tareasRepository.esVisiblePara(tareaId, usuarioId))) {
    throw new HttpError(404, 'Tarea no encontrada');
  }
  return comentariosRepository.listarPorTarea(tareaId);
}

async function crear(tareaId, contenido, usuario, comoId) {
  if (!contenido || !contenido.trim()) {
    throw new HttpError(400, 'El comentario no puede estar vacío');
  }

  const usuarioId = await usuariosService.usuarioEfectivo(usuario, comoId);
  if (!(await tareasRepository.esVisiblePara(tareaId, usuarioId))) {
    throw new HttpError(404, 'Tarea no encontrada');
  }

  return comentariosRepository.crear({
    tareaId,
    autorNombre: usuario.nombre,
    autorRol: usuario.rol,
    contenido: contenido.trim()
  });
}

async function eliminar(comentarioId, usuario, comoId) {
  const usuarioId = await usuariosService.usuarioEfectivo(usuario, comoId);
  const eliminado = await comentariosRepository.eliminarSiVisible(comentarioId, usuarioId);
  if (!eliminado) throw new HttpError(404, 'Comentario no encontrado');
}

module.exports = { listar, crear, eliminar };
