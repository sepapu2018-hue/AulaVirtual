const pool = require('../config/db');
const { visibleMateriaParaParametro } = require('./sql/visibleMateria');

async function listarVisiblesPorUsuario(usuarioId) {
  const r = await pool.query(`
    SELECT
      m.id, m.nombre, m.orden, m.fecha_creacion, m.profesor_id,
      COALESCE(p.nombre, m.profesor) AS profesor,
      (m.usuario_id = $1 OR m.profesor_id = $1) AS es_dueno,
      COUNT(t.id)::int AS total,
      COUNT(t.id) FILTER (WHERE t.completada)::int AS completadas,
      COUNT(t.id) FILTER (WHERE NOT t.completada)::int AS pendientes
    FROM materias m
    LEFT JOIN usuarios p ON p.id = m.profesor_id
    LEFT JOIN tareas t ON t.materia_id = m.id
    WHERE ${visibleMateriaParaParametro(1)}
    GROUP BY m.id, p.nombre
    ORDER BY m.orden NULLS LAST, m.id
  `, [usuarioId]);
  return r.rows;
}

async function esVisiblePara(materiaId, usuarioId) {
  const r = await pool.query(
    `SELECT 1 FROM materias m WHERE m.id = $1 AND ${visibleMateriaParaParametro(2)}`,
    [materiaId, usuarioId]
  );
  return r.rows.length > 0;
}

async function esProfesorAsignado(materiaId, profesorId) {
  const r = await pool.query(
    'SELECT 1 FROM materias WHERE id = $1 AND profesor_id = $2',
    [materiaId, profesorId]
  );
  return r.rows.length > 0;
}

async function buscarPorId(id) {
  const r = await pool.query('SELECT * FROM materias WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function siguienteOrden(usuarioId) {
  const r = await pool.query('SELECT COALESCE(MAX(orden), 0) AS max FROM materias WHERE usuario_id = $1', [usuarioId]);
  return r.rows[0].max + 1;
}

async function crear({ usuarioId, profesorId, nombre, orden }) {
  const r = await pool.query(
    'INSERT INTO materias (usuario_id, profesor_id, nombre, orden) VALUES ($1, $2, $3, $4) RETURNING *',
    [usuarioId, profesorId, nombre, orden]
  );
  return r.rows[0];
}

async function actualizarOrden(id, orden) {
  await pool.query('UPDATE materias SET orden = $1 WHERE id = $2', [orden, id]);
}

async function actualizar(id, usuarioId, { nombre, profesorId }) {
  const r = await pool.query(
    'UPDATE materias SET nombre = $1, profesor_id = $2 WHERE id = $3 AND usuario_id = $4 RETURNING *',
    [nombre, profesorId, id, usuarioId]
  );
  return r.rows[0] || null;
}

async function eliminar(id, usuarioId) {
  const r = await pool.query(
    'DELETE FROM materias WHERE id = $1 AND usuario_id = $2 RETURNING *',
    [id, usuarioId]
  );
  return r.rows[0] || null;
}

module.exports = {
  listarVisiblesPorUsuario,
  esVisiblePara,
  esProfesorAsignado,
  buscarPorId,
  siguienteOrden,
  crear,
  actualizarOrden,
  actualizar,
  eliminar
};
