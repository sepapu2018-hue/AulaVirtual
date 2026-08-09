const fs = require('fs');
const path = require('path');
const tareasRepository = require('../repositories/tareas.repository');
const notasRepository = require('../repositories/notas.repository');
const archivosRepository = require('../repositories/archivos.repository');
const materiasService = require('./materias.service');
const usuariosService = require('./usuarios.service');
const HttpError = require('../utils/httpError');
const { UPLOADS_DIR } = require('../config/uploads');

const PRIORIDADES_VALIDAS = ['alta', 'media', 'baja'];

async function listar(usuario, materiaId, comoId) {
  const usuarioId = await usuariosService.usuarioEfectivo(usuario, comoId);
  return tareasRepository.listarVisibles(usuarioId, materiaId);
}

async function estadisticas(usuario, materiaId, comoId) {
  const usuarioId = await usuariosService.usuarioEfectivo(usuario, comoId);
  const { totales, porPrioridad } = await tareasRepository.estadisticas(usuarioId, materiaId);
  const distribucion = { alta: 0, media: 0, baja: 0 };
  porPrioridad.forEach((fila) => { distribucion[fila.prioridad] = fila.cantidad; });
  return { ...totales, por_prioridad: distribucion };
}

async function obtenerDetalle(id, usuario, comoId) {
  const usuarioId = await usuariosService.usuarioEfectivo(usuario, comoId);
  const tarea = await tareasRepository.buscarVisiblePorId(id, usuarioId);
  if (!tarea) throw new HttpError(404, 'Tarea no encontrada');

  const miNota = await notasRepository.buscarPorTareaYUsuario(id, usuarioId);
  const archivos = await archivosRepository.listarPorTarea(id);
  return { ...tarea, archivos, mi_nota: miNota || null };
}

async function crear({ titulo, descripcion, prioridad, fechaLimite, materiaId }, usuario) {
  if (!titulo) throw new HttpError(400, 'El título es obligatorio');
  if (!materiaId) throw new HttpError(400, 'Debes indicar la materia de la tarea');
  const prioridadFinal = PRIORIDADES_VALIDAS.includes(prioridad) ? prioridad : 'media';

  if (!(await materiasService.esDocenteDeMateria(materiaId, usuario))) {
    throw new HttpError(403, 'No tienes permiso para crear tareas en esta materia');
  }

  return tareasRepository.crear({ titulo, descripcion: descripcion || null, prioridad: prioridadFinal, fechaLimite: fechaLimite || null, materiaId });
}

async function actualizar(id, { titulo, descripcion, completada, prioridad, fechaLimite, materiaId }, usuario) {
  const prioridadFinal = PRIORIDADES_VALIDAS.includes(prioridad) ? prioridad : 'media';

  const existente = await tareasRepository.buscarPorId(id);
  if (!existente) throw new HttpError(404, 'Tarea no encontrada');
  if (!(await materiasService.esDocenteDeMateria(existente.materia_id, usuario))) {
    throw new HttpError(403, 'No tienes permiso para modificar esta tarea');
  }
  if (materiaId && !(await materiasService.esDocenteDeMateria(materiaId, usuario))) {
    throw new HttpError(403, 'Materia no válida');
  }

  return tareasRepository.actualizar(id, {
    titulo,
    descripcion,
    completada,
    prioridad: prioridadFinal,
    fechaLimite: fechaLimite || null,
    materiaId: materiaId || null
  });
}

async function eliminar(id, usuario) {
  const tarea = await tareasRepository.buscarPorId(id);
  if (!tarea) throw new HttpError(404, 'Tarea no encontrada');
  if (!(await materiasService.esDocenteDeMateria(tarea.materia_id, usuario))) {
    throw new HttpError(403, 'No tienes permiso para eliminar esta tarea');
  }

  const rutas = await archivosRepository.listarRutasPorTarea(id);
  await tareasRepository.eliminar(id);
  rutas.forEach((ruta) => fs.unlink(path.join(UPLOADS_DIR, ruta), () => {}));
}

async function eliminarCompletadas(usuario, materiaId, comoId) {
  const usuarioId = await usuariosService.usuarioEfectivo(usuario, comoId);
  return tareasRepository.eliminarCompletadas(usuarioId, materiaId);
}

async function registro(id, usuario) {
  const tarea = await tareasRepository.buscarPorId(id);
  if (!tarea) throw new HttpError(404, 'Tarea no encontrada');
  if (!(await materiasService.esDocenteDeMateria(tarea.materia_id, usuario))) {
    throw new HttpError(403, 'No tienes permiso para ver el registro de esta tarea');
  }
  return tareasRepository.registroEntregas(tarea.materia_id, id);
}

async function guardarNota(id, { usuarioId, nota, comentario }, usuario) {
  if (!usuarioId) throw new HttpError(400, 'Debes indicar un estudiante');
  const notaFinal = nota === '' || nota === null || nota === undefined ? null : Number(nota);
  if (notaFinal !== null && (isNaN(notaFinal) || notaFinal < 0 || notaFinal > 10)) {
    throw new HttpError(400, 'La nota debe estar entre 0 y 10');
  }

  const tarea = await tareasRepository.buscarPorId(id);
  if (!tarea) throw new HttpError(404, 'Tarea no encontrada');
  if (!(await materiasService.esDocenteDeMateria(tarea.materia_id, usuario))) {
    throw new HttpError(403, 'No tienes permiso para calificar esta tarea');
  }

  return notasRepository.guardar(id, usuarioId, notaFinal, comentario || null);
}

// Forma de tarea usada tras subir/eliminar un archivo: la tarea con su
// lista de archivos, sin el campo mi_nota (a diferencia de obtenerDetalle).
async function conArchivos(tareaId) {
  const tarea = await tareasRepository.buscarPorId(tareaId);
  const archivos = await archivosRepository.listarPorTarea(tareaId);
  return { ...tarea, archivos };
}

// La entrega de un estudiante se bloquea si ya fue calificada o si vencio
// el plazo. El admin siempre puede seguir gestionando la tarea, incluso
// viendola "como" el estudiante.
async function motivoEntregaBloqueada(tareaId, usuario) {
  if (usuario.rol === 'admin') return null;
  const estado = await tareasRepository.estadoEntrega(tareaId, usuario.id);
  if (!estado) return null;
  if (estado.calificada) return 'Esta tarea ya fue calificada y no se puede modificar';
  if (estado.vencida) return 'El plazo de entrega ya venció y no se puede modificar';
  return null;
}

module.exports = {
  listar,
  estadisticas,
  obtenerDetalle,
  crear,
  actualizar,
  eliminar,
  eliminarCompletadas,
  registro,
  guardarNota,
  conArchivos,
  motivoEntregaBloqueada
};
