const pool = require('../config/db');
const { visibleMateriaParaParametro } = require('./sql/visibleMateria');

async function listarPorTarea(tareaId) {
  const r = await pool.query('SELECT * FROM comentarios WHERE tarea_id = $1 ORDER BY id ASC', [tareaId]);
  return r.rows;
}

async function crear({ tareaId, autorNombre, autorRol, contenido }) {
  const r = await pool.query(
    'INSERT INTO comentarios (tarea_id, autor_nombre, autor_rol, contenido) VALUES ($1, $2, $3, $4) RETURNING *',
    [tareaId, autorNombre, autorRol, contenido]
  );
  return r.rows[0];
}

// Solo se puede borrar un comentario de una tarea que pertenezca a una
// materia visible para el usuario (dueño, profesor asignado o inscrito).
async function eliminarSiVisible(comentarioId, usuarioId) {
  const r = await pool.query(
    `DELETE FROM comentarios c USING tareas t, materias m
     WHERE c.id = $1 AND c.tarea_id = t.id AND t.materia_id = m.id AND ${visibleMateriaParaParametro(2)}
     RETURNING c.id`,
    [comentarioId, usuarioId]
  );
  return r.rows[0] || null;
}

module.exports = { listarPorTarea, crear, eliminarSiVisible };
