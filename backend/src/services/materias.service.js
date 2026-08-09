const materiasRepository = require('../repositories/materias.repository');
const inscripcionesRepository = require('../repositories/inscripciones.repository');
const usuariosService = require('./usuarios.service');
const HttpError = require('../utils/httpError');

// El admin siempre puede gestionar una materia. Un profesor solo puede
// gestionar las materias que tiene asignadas.
async function esDocenteDeMateria(materiaId, usuario) {
  if (usuario.rol === 'admin') return true;
  if (usuario.rol !== 'profesor') return false;
  return materiasRepository.esProfesorAsignado(materiaId, usuario.id);
}

async function esVisiblePara(materiaId, usuarioId) {
  return materiasRepository.esVisiblePara(materiaId, usuarioId);
}

async function listar(usuario, comoId) {
  const usuarioId = await usuariosService.usuarioEfectivo(usuario, comoId);
  return materiasRepository.listarVisiblesPorUsuario(usuarioId);
}

async function crear({ nombre, profesorId }, usuario) {
  if (!nombre) throw new HttpError(400, 'El nombre de la materia es obligatorio');
  if (!profesorId) throw new HttpError(400, 'Debes asignar un profesor a la materia');
  if (!(await usuariosService.esProfesorValido(profesorId))) {
    throw new HttpError(400, 'El profesor seleccionado no es válido');
  }

  const orden = await materiasRepository.siguienteOrden(usuario.id);
  return materiasRepository.crear({ usuarioId: usuario.id, profesorId, nombre, orden });
}

async function reordenar(orden, usuario, comoId) {
  if (!Array.isArray(orden) || orden.length === 0) {
    throw new HttpError(400, 'Se requiere un arreglo de ids');
  }
  const usuarioId = await usuariosService.usuarioEfectivo(usuario, comoId);
  await Promise.all(orden.map(async (id, indice) => {
    if (await materiasRepository.esVisiblePara(id, usuarioId)) {
      await materiasRepository.actualizarOrden(id, indice + 1);
    }
  }));
}

async function actualizar(id, { nombre, profesorId }, usuario) {
  if (!nombre) throw new HttpError(400, 'El nombre de la materia es obligatorio');
  if (!profesorId) throw new HttpError(400, 'Debes asignar un profesor a la materia');
  if (!(await usuariosService.esProfesorValido(profesorId))) {
    throw new HttpError(400, 'El profesor seleccionado no es válido');
  }

  const materia = await materiasRepository.actualizar(id, usuario.id, { nombre, profesorId });
  if (!materia) throw new HttpError(404, 'Materia no encontrada');
  return materia;
}

async function eliminar(id, usuario) {
  const materia = await materiasRepository.eliminar(id, usuario.id);
  if (!materia) throw new HttpError(404, 'Materia no encontrada');
}

async function listarEstudiantes(materiaId, usuario) {
  if (!(await esDocenteDeMateria(materiaId, usuario))) {
    throw new HttpError(403, 'No tienes permiso para ver los estudiantes de esta materia');
  }
  return inscripcionesRepository.listarEstudiantesDeMateria(materiaId);
}

async function inscribirEstudiante(materiaId, usuarioIdEstudiante) {
  if (!usuarioIdEstudiante) throw new HttpError(400, 'Debes indicar un estudiante');

  const materia = await materiasRepository.buscarPorId(materiaId);
  if (!materia) throw new HttpError(404, 'Materia no encontrada');

  const estudiante = await usuariosService.buscarEstudianteValido(usuarioIdEstudiante);
  if (!estudiante) throw new HttpError(404, 'Estudiante no encontrado');

  await inscripcionesRepository.inscribir(materiaId, usuarioIdEstudiante);
  return estudiante;
}

async function desinscribirEstudiante(materiaId, usuarioId) {
  const inscripcion = await inscripcionesRepository.desinscribir(materiaId, usuarioId);
  if (!inscripcion) throw new HttpError(404, 'El estudiante no estaba inscrito');
}

module.exports = {
  esDocenteDeMateria,
  esVisiblePara,
  listar,
  crear,
  reordenar,
  actualizar,
  eliminar,
  listarEstudiantes,
  inscribirEstudiante,
  desinscribirEstudiante
};
