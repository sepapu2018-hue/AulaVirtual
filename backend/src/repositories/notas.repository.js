const pool = require('../config/db');

async function buscarPorTareaYUsuario(tareaId, usuarioId) {
  const r = await pool.query(
    'SELECT nota, comentario FROM notas WHERE tarea_id = $1 AND usuario_id = $2',
    [tareaId, usuarioId]
  );
  return r.rows[0] || null;
}

async function guardar(tareaId, usuarioId, nota, comentario) {
  const r = await pool.query(
    `INSERT INTO notas (tarea_id, usuario_id, nota, comentario)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tarea_id, usuario_id) DO UPDATE SET nota = $3, comentario = $4, fecha_creacion = CURRENT_TIMESTAMP
     RETURNING *`,
    [tareaId, usuarioId, nota, comentario]
  );
  return r.rows[0];
}

// Una fila por cada combinacion estudiante+tarea de la materia, con la
// nota (0-10) si ya fue calificada. Sirve de base para calcular la nota
// final de cada estudiante sobre 50 puntos.
async function listarPorMateria(materiaId) {
  const r = await pool.query(`
    SELECT u.id AS usuario_id, u.nombre AS estudiante_nombre, u.correo AS estudiante_correo,
      t.id AS tarea_id, t.titulo AS tarea_titulo,
      n.nota
    FROM (
      SELECT usuario_id FROM materias WHERE id = $1
      UNION
      SELECT usuario_id FROM inscripciones WHERE materia_id = $1
    ) miembros
    JOIN usuarios u ON u.id = miembros.usuario_id AND u.rol = 'estudiante'
    JOIN tareas t ON t.materia_id = $1
    LEFT JOIN notas n ON n.tarea_id = t.id AND n.usuario_id = u.id
    ORDER BY u.nombre, t.id
  `, [materiaId]);
  return r.rows;
}

module.exports = { buscarPorTareaYUsuario, guardar, listarPorMateria };
