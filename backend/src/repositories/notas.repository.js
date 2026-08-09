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

module.exports = { buscarPorTareaYUsuario, guardar };
