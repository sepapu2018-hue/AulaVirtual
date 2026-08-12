const notasRepository = require('../repositories/notas.repository');
const materiasService = require('./materias.service');
const usuariosService = require('./usuarios.service');
const HttpError = require('../utils/httpError');

// Nota final de una materia: se reparte automaticamente entre el numero
// de tareas que tenga, para que la suma de todas de siempre 50.
const NOTA_MAXIMA_MATERIA = 50;

function calcularResumen(filas) {
  const tareasIds = new Set(filas.map((fila) => fila.tarea_id));
  const totalTareas = tareasIds.size;
  const valorTarea = totalTareas > 0 ? NOTA_MAXIMA_MATERIA / totalTareas : 0;

  const porEstudiante = new Map();

  filas.forEach((fila) => {
    if (!porEstudiante.has(fila.usuario_id)) {
      porEstudiante.set(fila.usuario_id, {
        usuario_id: fila.usuario_id,
        nombre: fila.estudiante_nombre,
        correo: fila.estudiante_correo,
        detalle: [],
        tareas_calificadas: 0,
        nota_final: 0,
        total_tareas: totalTareas,
        valor_tarea: Math.round(valorTarea * 100) / 100,
        nota_maxima: NOTA_MAXIMA_MATERIA
      });
    }

    const estudiante = porEstudiante.get(fila.usuario_id);
    const tieneNota = fila.nota !== null && fila.nota !== undefined;
    const notaSobre50 = tieneNota
      ? Math.round((Number(fila.nota) / 10) * valorTarea * 100) / 100
      : null;

    estudiante.detalle.push({
      tarea_id: fila.tarea_id,
      tarea_titulo: fila.tarea_titulo,
      nota: tieneNota ? Number(fila.nota) : null,
      valor_tarea: Math.round(valorTarea * 100) / 100,
      nota_sobre_50: notaSobre50
    });

    if (tieneNota) {
      estudiante.tareas_calificadas += 1;
      estudiante.nota_final += notaSobre50;
    }
  });

  const estudiantes = Array.from(porEstudiante.values()).map((estudiante) => ({
    ...estudiante,
    nota_final: Math.round(estudiante.nota_final * 100) / 100
  }));

  return {
    total_tareas: totalTareas,
    valor_tarea: Math.round(valorTarea * 100) / 100,
    nota_maxima: NOTA_MAXIMA_MATERIA,
    estudiantes
  };
}

async function listarPorMateria(materiaId, usuario) {
  if (!(await materiasService.esDocenteDeMateria(materiaId, usuario))) {
    throw new HttpError(403, 'No tienes permiso para ver las notas de esta materia');
  }
  const filas = await notasRepository.listarPorMateria(materiaId);
  return calcularResumen(filas);
}

async function misNotas(materiaId, usuario, comoId) {
  const usuarioId = await usuariosService.usuarioEfectivo(usuario, comoId);
  if (!(await materiasService.esVisiblePara(materiaId, usuarioId))) {
    throw new HttpError(403, 'No tienes permiso para ver las notas de esta materia');
  }

  const filas = await notasRepository.listarPorMateria(materiaId);
  const resumen = calcularResumen(filas);
  const propio = resumen.estudiantes.find((estudiante) => estudiante.usuario_id === usuarioId);

  return propio || {
    usuario_id: usuarioId,
    detalle: [],
    tareas_calificadas: 0,
    nota_final: 0,
    total_tareas: resumen.total_tareas,
    valor_tarea: resumen.valor_tarea,
    nota_maxima: NOTA_MAXIMA_MATERIA
  };
}

module.exports = { listarPorMateria, misNotas, NOTA_MAXIMA_MATERIA };
