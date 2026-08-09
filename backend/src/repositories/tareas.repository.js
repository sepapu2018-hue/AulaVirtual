const pool = require('../config/db');
const { visibleMateriaParaParametro } = require('./sql/visibleMateria');

async function listarVisibles(usuarioId, materiaId) {
  const params = [usuarioId];
  let query = `
    SELECT t.*, m.nombre AS materia_nombre,
      (SELECT COUNT(*) FROM archivos_tarea a WHERE a.tarea_id = t.id)::int AS num_archivos,
      (SELECT nota FROM notas n WHERE n.tarea_id = t.id AND n.usuario_id = $1) AS mi_nota
    FROM tareas t
    JOIN materias m ON m.id = t.materia_id
    WHERE ${visibleMateriaParaParametro(1)}
  `;
  if (materiaId) {
    params.push(materiaId);
    query += ` AND t.materia_id = $${params.length}`;
  }
  query += ' ORDER BY t.id DESC';
  const r = await pool.query(query, params);
  return r.rows;
}

async function estadisticas(usuarioId, materiaId) {
  const params = [usuarioId];
  let filtro = `WHERE ${visibleMateriaParaParametro(1)}`;
  if (materiaId) {
    params.push(materiaId);
    filtro += ` AND t.materia_id = $${params.length}`;
  }
  const totales = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE t.completada)::int AS completadas,
      COUNT(*) FILTER (WHERE NOT t.completada)::int AS pendientes,
      COUNT(*) FILTER (WHERE NOT t.completada AND t.fecha_limite < CURRENT_DATE)::int AS vencidas
    FROM tareas t JOIN materias m ON m.id = t.materia_id ${filtro}
  `, params);
  const porPrioridad = await pool.query(
    `SELECT t.prioridad, COUNT(*)::int AS cantidad FROM tareas t JOIN materias m ON m.id = t.materia_id ${filtro} GROUP BY t.prioridad`,
    params
  );
  return { totales: totales.rows[0], porPrioridad: porPrioridad.rows };
}

async function buscarVisiblePorId(id, usuarioId) {
  const r = await pool.query(
    `SELECT t.* FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE t.id = $1 AND ${visibleMateriaParaParametro(2)}`,
    [id, usuarioId]
  );
  return r.rows[0] || null;
}

async function buscarPorId(id) {
  const r = await pool.query('SELECT * FROM tareas WHERE id = $1', [id]);
  return r.rows[0] || null;
}

// Comprueba que la tarea pertenezca a una materia visible para el usuario
// (dueño, profesor asignado o inscrito). Se usa en comentarios y archivos.
async function esVisiblePara(tareaId, usuarioId) {
  const r = await pool.query(
    `SELECT t.id FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE t.id = $1 AND (m.usuario_id = $2 OR m.profesor_id = $2 OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.materia_id = m.id AND i.usuario_id = $2))`,
    [tareaId, usuarioId]
  );
  return r.rows.length > 0;
}

async function crear({ titulo, descripcion, prioridad, fechaLimite, materiaId }) {
  const r = await pool.query(
    'INSERT INTO tareas (titulo, descripcion, prioridad, fecha_limite, materia_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [titulo, descripcion, prioridad, fechaLimite, materiaId]
  );
  return r.rows[0];
}

async function actualizar(id, { titulo, descripcion, completada, prioridad, fechaLimite, materiaId }) {
  const r = await pool.query(
    'UPDATE tareas SET titulo = $1, descripcion = $2, completada = $3, prioridad = $4, fecha_limite = $5, materia_id = COALESCE($6, materia_id) WHERE id = $7 RETURNING *',
    [titulo, descripcion, completada, prioridad, fechaLimite, materiaId, id]
  );
  return r.rows[0];
}

async function marcarCompletada(id, completada) {
  await pool.query('UPDATE tareas SET completada = $1 WHERE id = $2', [completada, id]);
}

async function eliminar(id) {
  await pool.query('DELETE FROM tareas WHERE id = $1', [id]);
}

async function eliminarCompletadas(usuarioId, materiaId) {
  const params = [usuarioId];
  let filtro = `USING materias m WHERE tareas.materia_id = m.id AND ${visibleMateriaParaParametro(1)} AND tareas.completada = true`;
  if (materiaId) {
    params.push(materiaId);
    filtro += ` AND tareas.materia_id = $${params.length}`;
  }
  const r = await pool.query(`DELETE FROM tareas ${filtro} RETURNING tareas.id`, params);
  return r.rowCount;
}

// Devuelve si la entrega del usuario para una tarea ya fue calificada o
// si el plazo de la tarea ya venció.
async function estadoEntrega(tareaId, usuarioId) {
  const r = await pool.query(
    `SELECT (n.nota IS NOT NULL) AS calificada,
            (t.fecha_limite IS NOT NULL AND t.fecha_limite < CURRENT_DATE) AS vencida
     FROM tareas t LEFT JOIN notas n ON n.tarea_id = t.id AND n.usuario_id = $2
     WHERE t.id = $1`,
    [tareaId, usuarioId]
  );
  return r.rows[0] || null;
}

async function registroEntregas(materiaId, tareaId) {
  const r = await pool.query(`
    SELECT u.id AS usuario_id, u.nombre, u.correo,
      COUNT(DISTINCT a.id)::int AS num_archivos,
      MAX(a.fecha_subida) AS ultima_entrega,
      n.nota, n.comentario
    FROM (
      SELECT usuario_id FROM materias WHERE id = $1
      UNION
      SELECT usuario_id FROM inscripciones WHERE materia_id = $1
    ) miembros
    JOIN usuarios u ON u.id = miembros.usuario_id AND u.rol = 'estudiante'
    LEFT JOIN archivos_tarea a ON a.tarea_id = $2 AND a.usuario_id = u.id
    LEFT JOIN notas n ON n.tarea_id = $2 AND n.usuario_id = u.id
    GROUP BY u.id, u.nombre, u.correo, n.nota, n.comentario
    ORDER BY u.nombre
  `, [materiaId, tareaId]);
  return r.rows;
}

module.exports = {
  listarVisibles,
  estadisticas,
  buscarVisiblePorId,
  buscarPorId,
  esVisiblePara,
  crear,
  actualizar,
  marcarCompletada,
  eliminar,
  eliminarCompletadas,
  estadoEntrega,
  registroEntregas
};
