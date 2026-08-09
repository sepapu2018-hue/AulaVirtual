const pool = require('../config/db');

async function buscarPorCorreo(correo) {
  const r = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
  return r.rows[0] || null;
}

async function buscarPorId(id) {
  const r = await pool.query('SELECT id, nombre, correo, rol, fecha_creacion FROM usuarios WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function listarPorRol(rol) {
  const r = await pool.query(
    'SELECT id, nombre, correo, rol, fecha_creacion FROM usuarios WHERE rol = $1 ORDER BY id DESC',
    [rol]
  );
  return r.rows;
}

async function existeCorreo(correo) {
  const r = await pool.query('SELECT id FROM usuarios WHERE correo = $1', [correo]);
  return r.rows.length > 0;
}

async function crear({ nombre, correo, passwordHash, rol }) {
  const r = await pool.query(
    'INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id, nombre, correo, rol, fecha_creacion',
    [nombre, correo, passwordHash, rol]
  );
  return r.rows[0];
}

async function eliminar(id, rolesGestionables) {
  const r = await pool.query(
    'DELETE FROM usuarios WHERE id = $1 AND rol = ANY($2) RETURNING id',
    [id, rolesGestionables]
  );
  return r.rows[0] || null;
}

async function contarPorRol(rol) {
  const r = await pool.query("SELECT COUNT(*)::int AS total FROM usuarios WHERE rol = $1", [rol]);
  return r.rows[0].total;
}

async function esProfesorValido(id) {
  const r = await pool.query("SELECT id FROM usuarios WHERE id = $1 AND rol = 'profesor'", [id]);
  return r.rows.length > 0;
}

async function buscarEstudiante(id) {
  const r = await pool.query("SELECT id, nombre, correo FROM usuarios WHERE id = $1 AND rol = 'estudiante'", [id]);
  return r.rows[0] || null;
}

async function conteoPorRol() {
  const r = await pool.query('SELECT rol, COUNT(*)::int AS total FROM usuarios GROUP BY rol');
  return r.rows;
}

module.exports = {
  buscarPorCorreo,
  buscarPorId,
  listarPorRol,
  existeCorreo,
  crear,
  eliminar,
  contarPorRol,
  esProfesorValido,
  buscarEstudiante,
  conteoPorRol
};
