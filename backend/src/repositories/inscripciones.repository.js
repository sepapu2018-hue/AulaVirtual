const pool = require('../config/db');

async function listarEstudiantesDeMateria(materiaId) {
  const r = await pool.query(
    `SELECT u.id, u.nombre, u.correo, i.fecha_inscripcion
     FROM inscripciones i JOIN usuarios u ON u.id = i.usuario_id
     WHERE i.materia_id = $1
     ORDER BY u.nombre`,
    [materiaId]
  );
  return r.rows;
}

async function inscribir(materiaId, usuarioId) {
  await pool.query(
    'INSERT INTO inscripciones (materia_id, usuario_id) VALUES ($1, $2) ON CONFLICT (materia_id, usuario_id) DO NOTHING',
    [materiaId, usuarioId]
  );
}

async function desinscribir(materiaId, usuarioId) {
  const r = await pool.query(
    'DELETE FROM inscripciones WHERE materia_id = $1 AND usuario_id = $2 RETURNING id',
    [materiaId, usuarioId]
  );
  return r.rows[0] || null;
}

module.exports = { listarEstudiantesDeMateria, inscribir, desinscribir };
