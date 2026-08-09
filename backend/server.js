const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const ORIGENES_PERMITIDOS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

const app = express();
app.use(helmet());
app.use(cors({
  origin: ORIGENES_PERMITIDOS.length > 0 ? ORIGENES_PERMITIDOS : true
}));
app.use(express.json());

const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.' }
});

const PORT = process.env.PORT || 3000;
const PRIORIDADES_VALIDAS = ['alta', 'media', 'baja'];
const JWT_SECRET = process.env.JWT_SECRET || 'gestortareas_dev_secret_2026';

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const sufijo = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${sufijo}${path.extname(file.originalname)}`);
  }
});

const TIPOS_ARCHIVO_PERMITIDOS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp'
];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_ARCHIVO_PERMITIDOS.includes(file.mimetype)) {
      const error = new Error('Tipo de archivo no permitido. Solo se aceptan PDF, Word e imágenes.');
      error.esTipoArchivoInvalido = true;
      return cb(error);
    }
    cb(null, true);
  }
});

app.use('/api/archivos', express.static(UPLOADS_DIR));

function generarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' });
  try {
    req.usuario = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

function requireAdmin(req, res, next) {
  if (req.usuario.rol !== 'admin') return res.status(403).json({ error: 'Solo el administrador puede realizar esta acción' });
  next();
}

function requireAdminOProfesor(req, res, next) {
  if (req.usuario.rol !== 'admin' && req.usuario.rol !== 'profesor') {
    return res.status(403).json({ error: 'Solo el profesor o el administrador pueden realizar esta acción' });
  }
  next();
}

// El admin siempre puede gestionar una materia. Un profesor solo puede
// gestionar las materias que tiene asignadas (materias.profesor_id).
async function materiaDocente(materiaId, usuario) {
  if (usuario.rol === 'admin') return true;
  if (usuario.rol !== 'profesor') return false;
  const r = await pool.query('SELECT 1 FROM materias WHERE id = $1 AND profesor_id = $2', [materiaId, usuario.id]);
  return r.rows.length > 0;
}

// El admin puede actuar "como" un estudiante pasando ?como=<id_estudiante>.
// Cualquier otro usuario siempre actúa sobre sus propios datos.
async function usuarioEfectivo(req) {
  if (req.usuario.rol === 'admin' && req.query.como) {
    const r = await pool.query("SELECT id FROM usuarios WHERE id = $1 AND rol = 'estudiante'", [req.query.como]);
    if (r.rows.length > 0) return r.rows[0].id;
  }
  return req.usuario.id;
}

// Una materia es "visible" para un usuario si es su dueño (admin), si es
// el profesor asignado, o si esta inscrito en ella (estudiante).
const VISIBLE_MATERIA = `(m.usuario_id = $USR OR m.profesor_id = $USR OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.materia_id = m.id AND i.usuario_id = $USR))`;

async function materiaVisible(materiaId, usuarioId) {
  const r = await pool.query(
    `SELECT 1 FROM materias m WHERE m.id = $1 AND ${VISIBLE_MATERIA.replace(/\$USR/g, '$2')}`,
    [materiaId, usuarioId]
  );
  return r.rows.length > 0;
}

// La entrega de un estudiante se bloquea si ya fue calificada o si vencio el plazo.
// El admin siempre puede seguir gestionando la tarea, incluso viendola "como" el estudiante.
async function entregaBloqueada(req, tareaId) {
  if (req.usuario.rol === 'admin') return null;
  const r = await pool.query(
    `SELECT (n.nota IS NOT NULL) AS calificada,
            (t.fecha_limite IS NOT NULL AND t.fecha_limite < CURRENT_DATE) AS vencida
     FROM tareas t LEFT JOIN notas n ON n.tarea_id = t.id AND n.usuario_id = $2
     WHERE t.id = $1`,
    [tareaId, req.usuario.id]
  );
  if (r.rows.length === 0) return null;
  if (r.rows[0].calificada) return 'Esta tarea ya fue calificada y no se puede modificar';
  if (r.rows[0].vencida) return 'El plazo de entrega ya venció y no se puede modificar';
  return null;
}

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/login', limitadorLogin, async (req, res) => {
  const { correo, password } = req.body;
  if (!correo || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo.trim().toLowerCase()]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });
    const usuario = result.rows[0];
    const coincide = bcrypt.compareSync(password, usuario.password_hash);
    if (!coincide) return res.status(401).json({ error: 'Credenciales inválidas' });
    const token = generarToken(usuario);
    res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

app.use('/api/materias', requireAuth);
app.use('/api/tareas', requireAuth);
app.use('/api/anuncios', requireAuth);
app.use('/api/usuarios', requireAuth);
app.use('/api/comentarios', requireAuth);
app.use('/api/admin', requireAuth);

const ROLES_GESTIONABLES = ['estudiante', 'profesor', 'admin'];

app.get('/api/admin/estadisticas', requireAdmin, async (req, res) => {
  try {
    const usuariosPorRol = await pool.query(
      'SELECT rol, COUNT(*)::int AS total FROM usuarios GROUP BY rol'
    );

    const conteoRoles = { admin: 0, profesor: 0, estudiante: 0 };
    usuariosPorRol.rows.forEach((fila) => {
      conteoRoles[fila.rol] = fila.total;
    });

    const materiasTotal = await pool.query(
      'SELECT COUNT(*)::int AS total FROM materias'
    );

    const tareas = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE completada)::int AS completadas,
        COUNT(*) FILTER (WHERE NOT completada)::int AS pendientes
      FROM tareas
    `);

    const porMateria = await pool.query(`
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

    res.json({
      usuarios: conteoRoles,
      materias: materiasTotal.rows[0].total,
      tareas: tareas.rows[0],
      por_materia: porMateria.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las estadísticas' });
  }
});

app.get('/api/usuarios', requireAdmin, async (req, res) => {
  const rol = ROLES_GESTIONABLES.includes(req.query.rol) ? req.query.rol : 'estudiante';
  try {
    const result = await pool.query(
      'SELECT id, nombre, correo, rol, fecha_creacion FROM usuarios WHERE rol = $1 ORDER BY id DESC',
      [rol]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los usuarios' });
  }
});

app.post('/api/usuarios', requireAdmin, async (req, res) => {
  const { nombre, correo, password } = req.body;
  const rol = ROLES_GESTIONABLES.includes(req.body.rol) ? req.body.rol : 'estudiante';
  if (!nombre || !correo || !password) return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
  if (password.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  try {
    const existe = await pool.query('SELECT id FROM usuarios WHERE correo = $1', [correo.trim().toLowerCase()]);
    if (existe.rows.length > 0) return res.status(400).json({ error: 'Ya existe una cuenta con ese correo' });
    const hash = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      'INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id, nombre, correo, rol, fecha_creacion',
      [nombre.trim(), correo.trim().toLowerCase(), hash, rol]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la cuenta' });
  }
});

app.delete('/api/usuarios/:id', requireAdmin, async (req, res) => {
  const idObjetivo = Number(req.params.id);

  if (idObjetivo === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }

  try {
    const objetivo = await pool.query('SELECT rol FROM usuarios WHERE id = $1', [idObjetivo]);

    if (objetivo.rows.length > 0 && objetivo.rows[0].rol === 'admin') {
      const totalAdmins = await pool.query("SELECT COUNT(*)::int AS total FROM usuarios WHERE rol = 'admin'");
      if (totalAdmins.rows[0].total <= 1) {
        return res.status(400).json({ error: 'No puedes eliminar al último administrador del sistema' });
      }
    }

    const result = await pool.query(
      'DELETE FROM usuarios WHERE id = $1 AND rol = ANY($2) RETURNING id',
      [idObjetivo, ROLES_GESTIONABLES]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cuenta no encontrada' });
    res.json({ message: 'Cuenta eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la cuenta' });
  }
});

app.get('/api/materias', async (req, res) => {
  try {
    const usuarioId = await usuarioEfectivo(req);
    const result = await pool.query(`
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
      WHERE ${VISIBLE_MATERIA.replace(/\$USR/g, '$1')}
      GROUP BY m.id, p.nombre
      ORDER BY m.orden NULLS LAST, m.id
    `, [usuarioId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las materias' });
  }
});

app.post('/api/materias', requireAdmin, async (req, res) => {
  const { nombre, profesor_id } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre de la materia es obligatorio' });
  if (!profesor_id) return res.status(400).json({ error: 'Debes asignar un profesor a la materia' });
  try {
    const profesor = await pool.query("SELECT id FROM usuarios WHERE id = $1 AND rol = 'profesor'", [profesor_id]);
    if (profesor.rows.length === 0) return res.status(400).json({ error: 'El profesor seleccionado no es válido' });

    const usuarioId = req.usuario.id;
    const maxOrden = await pool.query('SELECT COALESCE(MAX(orden), 0) AS max FROM materias WHERE usuario_id = $1', [usuarioId]);
    const result = await pool.query(
      'INSERT INTO materias (usuario_id, profesor_id, nombre, orden) VALUES ($1, $2, $3, $4) RETURNING *',
      [usuarioId, profesor_id, nombre, maxOrden.rows[0].max + 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la materia' });
  }
});

app.put('/api/materias/reordenar', requireAdmin, async (req, res) => {
  const { orden } = req.body;
  if (!Array.isArray(orden) || orden.length === 0) return res.status(400).json({ error: 'Se requiere un arreglo de ids' });
  try {
    const usuarioId = await usuarioEfectivo(req);
    await Promise.all(orden.map(async (id, i) => {
      if (await materiaVisible(id, usuarioId)) {
        await pool.query('UPDATE materias SET orden = $1 WHERE id = $2', [i + 1, id]);
      }
    }));
    res.json({ message: 'Orden actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al reordenar las materias' });
  }
});

app.put('/api/materias/:id', requireAdmin, async (req, res) => {
  const { nombre, profesor_id } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre de la materia es obligatorio' });
  if (!profesor_id) return res.status(400).json({ error: 'Debes asignar un profesor a la materia' });
  try {
    const profesor = await pool.query("SELECT id FROM usuarios WHERE id = $1 AND rol = 'profesor'", [profesor_id]);
    if (profesor.rows.length === 0) return res.status(400).json({ error: 'El profesor seleccionado no es válido' });

    const result = await pool.query(
      'UPDATE materias SET nombre = $1, profesor_id = $2 WHERE id = $3 AND usuario_id = $4 RETURNING *',
      [nombre, profesor_id, req.params.id, req.usuario.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Materia no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la materia' });
  }
});

app.delete('/api/materias/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM materias WHERE id = $1 AND usuario_id = $2 RETURNING *',
      [req.params.id, req.usuario.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Materia no encontrada' });
    res.json({ message: 'Materia eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la materia' });
  }
});

app.get('/api/materias/:id/estudiantes', async (req, res) => {
  if (!(await materiaDocente(req.params.id, req.usuario))) {
    return res.status(403).json({ error: 'No tienes permiso para ver los estudiantes de esta materia' });
  }
  try {
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.correo, i.fecha_inscripcion
       FROM inscripciones i JOIN usuarios u ON u.id = i.usuario_id
       WHERE i.materia_id = $1
       ORDER BY u.nombre`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los estudiantes inscritos' });
  }
});

app.post('/api/materias/:id/estudiantes', requireAdmin, async (req, res) => {
  const { usuario_id } = req.body;
  if (!usuario_id) return res.status(400).json({ error: 'Debes indicar un estudiante' });
  try {
    const materia = await pool.query('SELECT id FROM materias WHERE id = $1', [req.params.id]);
    if (materia.rows.length === 0) return res.status(404).json({ error: 'Materia no encontrada' });
    const estudiante = await pool.query("SELECT id, nombre, correo FROM usuarios WHERE id = $1 AND rol = 'estudiante'", [usuario_id]);
    if (estudiante.rows.length === 0) return res.status(404).json({ error: 'Estudiante no encontrado' });
    await pool.query(
      'INSERT INTO inscripciones (materia_id, usuario_id) VALUES ($1, $2) ON CONFLICT (materia_id, usuario_id) DO NOTHING',
      [req.params.id, usuario_id]
    );
    res.status(201).json(estudiante.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al inscribir al estudiante' });
  }
});

app.delete('/api/materias/:id/estudiantes/:usuarioId', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM inscripciones WHERE materia_id = $1 AND usuario_id = $2 RETURNING id',
      [req.params.id, req.params.usuarioId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'El estudiante no estaba inscrito' });
    res.json({ message: 'Estudiante desinscrito' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al desinscribir al estudiante' });
  }
});

app.get('/api/materias/:id/anuncios', async (req, res) => {
  try {
    if (!(await materiaVisible(req.params.id, await usuarioEfectivo(req)))) return res.status(404).json({ error: 'Materia no encontrada' });
    const result = await pool.query('SELECT * FROM anuncios WHERE materia_id = $1 ORDER BY id DESC', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los anuncios' });
  }
});

app.post('/api/materias/:id/anuncios', requireAdminOProfesor, async (req, res) => {
  const { contenido } = req.body;
  if (!contenido || !contenido.trim()) return res.status(400).json({ error: 'El contenido del anuncio es obligatorio' });
  try {
    if (!(await materiaDocente(req.params.id, req.usuario))) {
      return res.status(403).json({ error: 'No tienes permiso para publicar anuncios en esta materia' });
    }
    const result = await pool.query(
      'INSERT INTO anuncios (materia_id, contenido) VALUES ($1, $2) RETURNING *',
      [req.params.id, contenido.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al publicar el anuncio' });
  }
});

app.delete('/api/anuncios/:id', requireAdminOProfesor, async (req, res) => {
  try {
    const anuncio = await pool.query('SELECT materia_id FROM anuncios WHERE id = $1', [req.params.id]);
    if (anuncio.rows.length === 0) return res.status(404).json({ error: 'Anuncio no encontrado' });
    if (!(await materiaDocente(anuncio.rows[0].materia_id, req.usuario))) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este anuncio' });
    }
    await pool.query('DELETE FROM anuncios WHERE id = $1', [req.params.id]);
    res.json({ message: 'Anuncio eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el anuncio' });
  }
});

app.get('/api/tareas', async (req, res) => {
  try {
    const { materia_id } = req.query;
    const params = [await usuarioEfectivo(req)];
    let query = `
      SELECT t.*, m.nombre AS materia_nombre,
        (SELECT COUNT(*) FROM archivos_tarea a WHERE a.tarea_id = t.id)::int AS num_archivos,
        (SELECT nota FROM notas n WHERE n.tarea_id = t.id AND n.usuario_id = $1) AS mi_nota
      FROM tareas t
      JOIN materias m ON m.id = t.materia_id
      WHERE ${VISIBLE_MATERIA.replace(/\$USR/g, '$1')}
    `;
    if (materia_id) {
      params.push(materia_id);
      query += ` AND t.materia_id = $${params.length}`;
    }
    query += ' ORDER BY t.id DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las tareas' });
  }
});

app.get('/api/tareas/estadisticas', async (req, res) => {
  try {
    const { materia_id } = req.query;
    const params = [await usuarioEfectivo(req)];
    let filtro = `WHERE ${VISIBLE_MATERIA.replace(/\$USR/g, '$1')}`;
    if (materia_id) {
      params.push(materia_id);
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
    const distribucion = { alta: 0, media: 0, baja: 0 };
    porPrioridad.rows.forEach(r => { distribucion[r.prioridad] = r.cantidad; });
    res.json({ ...totales.rows[0], por_prioridad: distribucion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

app.get('/api/tareas/:id', async (req, res) => {
  try {
    const usuarioId = await usuarioEfectivo(req);
    const result = await pool.query(
      `SELECT t.* FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE t.id = $1 AND ${VISIBLE_MATERIA.replace(/\$USR/g, '$2')}`,
      [req.params.id, usuarioId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    const miNota = await pool.query('SELECT nota, comentario FROM notas WHERE tarea_id = $1 AND usuario_id = $2', [req.params.id, usuarioId]);
    res.json({
      ...result.rows[0],
      archivos: await archivosDeTarea(req.params.id),
      mi_nota: miNota.rows[0] || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener la tarea' });
  }
});

app.post('/api/tareas', requireAdminOProfesor, async (req, res) => {
  const { titulo, descripcion, prioridad, fecha_limite, materia_id } = req.body;
  if (!titulo) return res.status(400).json({ error: 'El título es obligatorio' });
  if (!materia_id) return res.status(400).json({ error: 'Debes indicar la materia de la tarea' });
  const prioridadFinal = PRIORIDADES_VALIDAS.includes(prioridad) ? prioridad : 'media';
  try {
    if (!(await materiaDocente(materia_id, req.usuario))) {
      return res.status(403).json({ error: 'No tienes permiso para crear tareas en esta materia' });
    }
    const result = await pool.query(
      'INSERT INTO tareas (titulo, descripcion, prioridad, fecha_limite, materia_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [titulo, descripcion || null, prioridadFinal, fecha_limite || null, materia_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la tarea' });
  }
});

app.put('/api/tareas/:id', requireAdminOProfesor, async (req, res) => {
  const { titulo, descripcion, completada, prioridad, fecha_limite, materia_id } = req.body;
  const prioridadFinal = PRIORIDADES_VALIDAS.includes(prioridad) ? prioridad : 'media';
  try {
    const existente = await pool.query('SELECT materia_id FROM tareas WHERE id = $1', [req.params.id]);
    if (existente.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!(await materiaDocente(existente.rows[0].materia_id, req.usuario))) {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta tarea' });
    }
    if (materia_id && !(await materiaDocente(materia_id, req.usuario))) {
      return res.status(403).json({ error: 'Materia no válida' });
    }
    const result = await pool.query(
      'UPDATE tareas SET titulo = $1, descripcion = $2, completada = $3, prioridad = $4, fecha_limite = $5, materia_id = COALESCE($6, materia_id) WHERE id = $7 RETURNING *',
      [titulo, descripcion, completada, prioridadFinal, fecha_limite || null, materia_id || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la tarea' });
  }
});

app.delete('/api/tareas/completadas', requireAdminOProfesor, async (req, res) => {
  try {
    const { materia_id } = req.query;
    const params = [await usuarioEfectivo(req)];
    let filtro = `USING materias m WHERE tareas.materia_id = m.id AND ${VISIBLE_MATERIA.replace(/\$USR/g, '$1')} AND tareas.completada = true`;
    if (materia_id) {
      params.push(materia_id);
      filtro += ` AND tareas.materia_id = $${params.length}`;
    }
    const result = await pool.query(`DELETE FROM tareas ${filtro} RETURNING tareas.id`, params);
    res.json({ eliminadas: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar las tareas completadas' });
  }
});

app.delete('/api/tareas/:id', requireAdminOProfesor, async (req, res) => {
  try {
    const tarea = await pool.query('SELECT materia_id FROM tareas WHERE id = $1', [req.params.id]);
    if (tarea.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!(await materiaDocente(tarea.rows[0].materia_id, req.usuario))) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta tarea' });
    }
    const archivosPrevios = await pool.query(
      'SELECT ruta FROM archivos_tarea WHERE tarea_id = $1',
      [req.params.id]
    );
    await pool.query('DELETE FROM tareas WHERE id = $1', [req.params.id]);
    archivosPrevios.rows.forEach(a => fs.unlink(path.join(UPLOADS_DIR, a.ruta), () => {}));
    res.json({ message: 'Tarea eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la tarea' });
  }
});

app.get('/api/tareas/:id/comentarios', async (req, res) => {
  try {
    const tarea = await pool.query(
      `SELECT t.id FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE t.id = $1 AND (m.usuario_id = $2 OR m.profesor_id = $2 OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.materia_id = m.id AND i.usuario_id = $2))`,
      [req.params.id, await usuarioEfectivo(req)]
    );
    if (tarea.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    const result = await pool.query('SELECT * FROM comentarios WHERE tarea_id = $1 ORDER BY id ASC', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los comentarios' });
  }
});

app.post('/api/tareas/:id/comentarios', async (req, res) => {
  const { contenido } = req.body;
  if (!contenido || !contenido.trim()) return res.status(400).json({ error: 'El comentario no puede estar vacío' });
  try {
    const tarea = await pool.query(
      `SELECT t.id FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE t.id = $1 AND (m.usuario_id = $2 OR m.profesor_id = $2 OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.materia_id = m.id AND i.usuario_id = $2))`,
      [req.params.id, await usuarioEfectivo(req)]
    );
    if (tarea.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    const result = await pool.query(
      'INSERT INTO comentarios (tarea_id, autor_nombre, autor_rol, contenido) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.id, req.usuario.nombre, req.usuario.rol, contenido.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al publicar el comentario' });
  }
});

app.delete('/api/comentarios/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM comentarios c USING tareas t, materias m
       WHERE c.id = $1 AND c.tarea_id = t.id AND t.materia_id = m.id AND ${VISIBLE_MATERIA.replace(/\$USR/g, '$2')}
       RETURNING c.id`,
      [req.params.id, await usuarioEfectivo(req)]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Comentario no encontrado' });
    res.json({ message: 'Comentario eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el comentario' });
  }
});

async function archivosDeTarea(tareaId) {
  const archivos = await pool.query(
    `SELECT a.*, u.nombre AS usuario_nombre
     FROM archivos_tarea a LEFT JOIN usuarios u ON u.id = a.usuario_id
     WHERE a.tarea_id = $1 ORDER BY a.id`,
    [tareaId]
  );
  return archivos.rows;
}

async function tareaConArchivos(tareaId) {
  const tarea = await pool.query('SELECT * FROM tareas WHERE id = $1', [tareaId]);
  return { ...tarea.rows[0], archivos: await archivosDeTarea(tareaId) };
}

app.get('/api/tareas/:id/archivos', async (req, res) => {
  try {
    const tarea = await pool.query(
      `SELECT t.id FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE t.id = $1 AND (m.usuario_id = $2 OR m.profesor_id = $2 OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.materia_id = m.id AND i.usuario_id = $2))`,
      [req.params.id, await usuarioEfectivo(req)]
    );
    if (tarea.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json(await archivosDeTarea(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los archivos' });
  }
});

app.post('/api/tareas/:id/archivo', upload.single('archivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
  try {
    const usuarioId = await usuarioEfectivo(req);
    const tarea = await pool.query(
      `SELECT t.id FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE t.id = $1 AND (m.usuario_id = $2 OR m.profesor_id = $2 OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.materia_id = m.id AND i.usuario_id = $2))`,
      [req.params.id, usuarioId]
    );
    if (tarea.rows.length === 0) {
      fs.unlink(path.join(UPLOADS_DIR, req.file.filename), () => {});
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    const motivoBloqueo = await entregaBloqueada(req, req.params.id);
    if (motivoBloqueo) {
      fs.unlink(path.join(UPLOADS_DIR, req.file.filename), () => {});
      return res.status(403).json({ error: motivoBloqueo });
    }

    await pool.query(
      'INSERT INTO archivos_tarea (tarea_id, usuario_id, nombre_original, ruta) VALUES ($1, $2, $3, $4)',
      [req.params.id, usuarioId, req.file.originalname, req.file.filename]
    );
    await pool.query('UPDATE tareas SET completada = true WHERE id = $1', [req.params.id]);

    res.json(await tareaConArchivos(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al adjuntar el archivo' });
  }
});

app.delete('/api/tareas/:id/archivo/:archivoId', async (req, res) => {
  try {
    const usuarioId = await usuarioEfectivo(req);
    const tarea = await pool.query(
      `SELECT t.id FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE t.id = $1 AND (m.usuario_id = $2 OR m.profesor_id = $2 OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.materia_id = m.id AND i.usuario_id = $2))`,
      [req.params.id, usuarioId]
    );
    if (tarea.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    const motivoBloqueo = await entregaBloqueada(req, req.params.id);
    if (motivoBloqueo) return res.status(403).json({ error: motivoBloqueo });

    const archivo = await pool.query(
      'DELETE FROM archivos_tarea WHERE id = $1 AND tarea_id = $2 RETURNING ruta',
      [req.params.archivoId, req.params.id]
    );
    if (archivo.rows.length === 0) return res.status(404).json({ error: 'Archivo no encontrado' });
    fs.unlink(path.join(UPLOADS_DIR, archivo.rows[0].ruta), () => {});

    const restantes = await pool.query('SELECT COUNT(*)::int AS n FROM archivos_tarea WHERE tarea_id = $1', [req.params.id]);
    if (restantes.rows[0].n === 0) {
      await pool.query('UPDATE tareas SET completada = false WHERE id = $1', [req.params.id]);
    }

    res.json(await tareaConArchivos(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al quitar el archivo' });
  }
});

app.get('/api/tareas/:id/registro', requireAdminOProfesor, async (req, res) => {
  try {
    const tarea = await pool.query('SELECT id, materia_id FROM tareas WHERE id = $1', [req.params.id]);
    if (tarea.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!(await materiaDocente(tarea.rows[0].materia_id, req.usuario))) {
      return res.status(403).json({ error: 'No tienes permiso para ver el registro de esta tarea' });
    }
    const materiaId = tarea.rows[0].materia_id;

    const result = await pool.query(`
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
    `, [materiaId, req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el registro de entregas' });
  }
});

app.put('/api/tareas/:id/notas', requireAdminOProfesor, async (req, res) => {
  const { usuario_id, nota, comentario } = req.body;
  if (!usuario_id) return res.status(400).json({ error: 'Debes indicar un estudiante' });
  const notaFinal = nota === '' || nota === null || nota === undefined ? null : Number(nota);
  if (notaFinal !== null && (isNaN(notaFinal) || notaFinal < 0 || notaFinal > 10)) {
    return res.status(400).json({ error: 'La nota debe estar entre 0 y 10' });
  }
  try {
    const tarea = await pool.query('SELECT id, materia_id FROM tareas WHERE id = $1', [req.params.id]);
    if (tarea.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!(await materiaDocente(tarea.rows[0].materia_id, req.usuario))) {
      return res.status(403).json({ error: 'No tienes permiso para calificar esta tarea' });
    }
    const result = await pool.query(
      `INSERT INTO notas (tarea_id, usuario_id, nota, comentario)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tarea_id, usuario_id) DO UPDATE SET nota = $3, comentario = $4, fecha_creacion = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.params.id, usuario_id, notaFinal, comentario || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar la nota' });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'El archivo supera el tamaño máximo permitido (5MB)' });
  }
  if (err && err.esTipoArchivoInvalido) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => console.log(`Backend escuchando en el puerto ${PORT}`));
