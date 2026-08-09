// Una materia es "visible" para un usuario si es su dueño (admin), si es
// el profesor asignado, o si esta inscrito en ella (estudiante). Se usa en
// consultas de materias, tareas, comentarios, archivos y anuncios.
const VISIBLE_MATERIA = `(m.usuario_id = $USR OR m.profesor_id = $USR OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.materia_id = m.id AND i.usuario_id = $USR))`;

function visibleMateriaParaParametro(indice) {
  return VISIBLE_MATERIA.replace(/\$USR/g, `$${indice}`);
}

module.exports = { VISIBLE_MATERIA, visibleMateriaParaParametro };
