const pool = require('../config/db');

async function listarPorTarea(tareaId) {
  const r = await pool.query(
    `SELECT a.*, u.nombre AS usuario_nombre
     FROM archivos_tarea a LEFT JOIN usuarios u ON u.id = a.usuario_id
     WHERE a.tarea_id = $1 ORDER BY a.id`,
    [tareaId]
  );
  return r.rows;
}

async function listarRutasPorTarea(tareaId) {
  const r = await pool.query('SELECT ruta FROM archivos_tarea WHERE tarea_id = $1', [tareaId]);
  return r.rows.map((fila) => fila.ruta);
}

async function crear({ tareaId, usuarioId, nombreOriginal, ruta }) {
  await pool.query(
    'INSERT INTO archivos_tarea (tarea_id, usuario_id, nombre_original, ruta) VALUES ($1, $2, $3, $4)',
    [tareaId, usuarioId, nombreOriginal, ruta]
  );
}

async function eliminar(archivoId, tareaId) {
  const r = await pool.query(
    'DELETE FROM archivos_tarea WHERE id = $1 AND tarea_id = $2 RETURNING ruta',
    [archivoId, tareaId]
  );
  return r.rows[0] || null;
}

async function contarPorTarea(tareaId) {
  const r = await pool.query('SELECT COUNT(*)::int AS n FROM archivos_tarea WHERE tarea_id = $1', [tareaId]);
  return r.rows[0].n;
}

module.exports = { listarPorTarea, listarRutasPorTarea, crear, eliminar, contarPorTarea };
