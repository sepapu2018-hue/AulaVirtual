const pool = require('../config/db');

async function listarPorMateria(materiaId) {
  const r = await pool.query('SELECT * FROM anuncios WHERE materia_id = $1 ORDER BY id DESC', [materiaId]);
  return r.rows;
}

async function crear(materiaId, contenido) {
  const r = await pool.query(
    'INSERT INTO anuncios (materia_id, contenido) VALUES ($1, $2) RETURNING *',
    [materiaId, contenido]
  );
  return r.rows[0];
}

async function buscarPorId(id) {
  const r = await pool.query('SELECT materia_id FROM anuncios WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function eliminar(id) {
  await pool.query('DELETE FROM anuncios WHERE id = $1', [id]);
}

module.exports = { listarPorMateria, crear, buscarPorId, eliminar };
