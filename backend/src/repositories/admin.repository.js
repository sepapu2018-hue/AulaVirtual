const pool = require('../config/db');

async function totalMaterias() {
  const r = await pool.query('SELECT COUNT(*)::int AS total FROM materias');
  return r.rows[0].total;
}

async function totalesTareas() {
  const r = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE completada)::int AS completadas,
      COUNT(*) FILTER (WHERE NOT completada)::int AS pendientes
    FROM tareas
  `);
  return r.rows[0];
}

async function tareasPorMateria() {
  const r = await pool.query(`
    SELECT
      m.id, m.nombre,
      COUNT(t.id) FILTER (WHERE t.completada)::int AS completadas,
      COUNT(t.id) FILTER (WHERE NOT t.completada)::int AS pendientes
    FROM materias m
    LEFT JOIN tareas t ON t.materia_id = m.id
    GROUP BY m.id, m.nombre
    ORDER BY m.nombre
    LIMIT 10
  `);
  return r.rows;
}

module.exports = { totalMaterias, totalesTareas, tareasPorMateria };
