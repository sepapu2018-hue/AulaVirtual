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

const app = express();
app.use(helmet());

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:8081')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);
app.use(cors({ origin: ALLOWED_ORIGINS }));

app.use(express.json());

const PORT = process.env.PORT || 3000;
const PRIORIDADES_VALIDAS = ['alta', 'media', 'baja'];
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está definido. Configúralo como variable de entorno.');
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.' },
});

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const TIPOS_ARCHIVO_PERMITIDOS = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const sufijo = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${sufijo}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_ARCHIVO_PERMITIDOS.includes(file.mimetype)) {
      return cb(new Error('TIPO_ARCHIVO_NO_PERMITIDO'));
    }
    cb(null, true);
  },
});

// Solo puede descargar el archivo quien pertenece a la materia de esa tarea
// (el profesor dueño o un estudiante inscrito). Antes esta ruta era estática
// y pública: cualquiera con el link directo podía descargar sin iniciar sesión.
app.get('/api/archivos/:archivo', requireAuth, async (req, res) => {
  try {
    const usuarioId = await usuarioEfectivo(req);
    const archivo = await pool.query(
      `SELECT a.ruta, a.nombre_original FROM archivos_tarea a
       JOIN tareas t ON t.id = a.tarea_id
       JOIN materias m ON m.id = t.materia_id
       WHERE a.ruta = $1 AND (m.usuario_id = $2 OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.materia_id = m.id AND i.usuario_id = $2))`,
      [req.params.archivo, usuarioId]
    );
    if (archivo.rows.length === 0) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.sendFile(path.join(UPLOADS_DIR, archivo.rows[0].ruta));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el archivo' });
  }
});

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

// El admin puede actuar "como" un estudiante pasando ?como=<id_estudiante>.
// Cualquier otro usuario siempre actúa sobre sus propios datos.
async function usuarioEfectivo(req) {
  if (req.usuario.rol === 'admin' && req.query.como) {
    const r = await pool.query("SELECT id FROM usuarios WHERE id = $1 AND rol = 'estudiante'", [req.query.como]);
    if (r.rows.length > 0) return r.rows[0].id;
  }
  return req.usuario.id;
}

// Una materia es "visible" para un usuario si es su dueño o si esta inscrito en ella.
const VISIBLE_MATERIA = `(m.usuario_id = $USR OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.materia_id = m.id AND i.usuario_id = $USR))`;

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

app.post('/api/auth/login', loginLimiter, async (req, res) => {
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

app.get('/api/usuarios', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre, correo, rol, fecha_creacion FROM usuarios WHERE rol = 'estudiante' ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los estudiantes' });
  }
});

app.post('/api/usuarios', requireAdmin, async (req, res) => {
  const { nombre, correo, password } = req.body;
  if (!nombre || !correo || !password) return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
  if (password.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  try {
    const existe = await pool.query('SELECT id FROM usuarios WHERE correo = $1', [correo.trim().toLowerCase()]);
    if (existe.rows.length > 0) return res.status(400).json({ error: 'Ya existe una cuenta con ese correo' });
    const hash = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      "INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES ($1, $2, $3, 'estudiante') RETURNING id, nombre, correo, rol, fecha_creacion",
      [nombre.trim(), correo.trim().toLowerCase(), hash]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el estudiante' });
  }
});

app.delete('/api/usuarios/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM usuarios WHERE id = $1 AND rol = 'estudiante' RETURNING id",
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Estudiante no encontrado' });
    res.json({ message: 'Estudiante eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el estudiante' });
  }
});

app.get('/api/materias', async (req, res) => {
  try {
    const usuarioId = await usuarioEfectivo(req);
    const result = await pool.query(`
      SELECT
        m.id, m.nombre, m.profesor, m.orden, m.fecha_creacion,
        (m.usuario_id = $1) AS es_dueno,
        COUNT(t.id)::int AS total,
        COUNT(t.id) FILTER (WHERE t.completada)::int AS completadas,
        COUNT(t.id) FILTER (WHERE NOT t.completada)::int AS pendientes,
        (
          SELECT COUNT(*)::int FROM (
            SELECT c.fecha_creacion AS f FROM comentarios c
              JOIN tareas tc ON tc.id = c.tarea_id
              WHERE tc.materia_id = m.id AND c.autor_rol = 'estudiante' AND c.fecha_creacion > NOW() - INTERVAL '3 days'
            UNION ALL
            SELECT a.fecha_subida AS f FROM archivos_tarea a
              JOIN tareas ta ON ta.id = a.tarea_id
              WHERE ta.materia_id = m.id AND a.fecha_subida > NOW() - INTERVAL '3 days'
          ) reciente
        ) AS actividad_reciente,
        (
          SELECT ROUND(AVG(n.nota)::numeric, 2) FROM notas n
          JOIN tareas tn ON tn.id = n.tarea_id
          WHERE tn.materia_id = m.id AND n.usuario_id = $1 AND n.nota IS NOT NULL
        ) AS promedio_notas
      FROM materias m
      LEFT JOIN tareas t ON t.materia_id = m.id
      WHERE ${VISIBLE_MATERIA.replace(/\$USR/g, '$1')}
      GROUP BY m.id
      ORDER BY m.orden NULLS LAST, m.id
    `, [usuarioId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las materias' });
  }
});

app.post('/api/materias', requireAdmin, async (req, res) => {
  const { nombre, profesor } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre de la materia es obligatorio' });
  try {
    const usuarioId = await usuarioEfectivo(req);
    const maxOrden = await pool.query('SELECT COALESCE(MAX(orden), 0) AS max FROM materias WHERE usuario_id = $1', [usuarioId]);
    const result = await pool.query(
      'INSERT INTO materias (usuario_id, nombre, profesor, orden) VALUES ($1, $2, $3, $4) RETURNING *',
      [usuarioId, nombre, profesor || null, maxOrden.rows[0].max + 1]
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
  const { nombre, profesor } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre de la materia es obligatorio' });
  try {
    const result = await pool.query(
      'UPDATE materias SET nombre = $1, profesor = $2 WHERE id = $3 AND usuario_id = $4 RETURNING *',
      [nombre, profesor || null, req.params.id, await usuarioEfectivo(req)]
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
      [req.params.id, await usuarioEfectivo(req)]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Materia no encontrada' });
    res.json({ message: 'Materia eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la materia' });
  }
});

app.get('/api/materias/:id/estudiantes', requireAdmin, async (req, res) => {
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

// Agrega varios estudiantes de una vez a una materia: crea la cuenta si el correo
// no existe todavía (con una contraseña temporal compartida) y los inscribe.
app.post('/api/materias/:id/estudiantes/lote', requireAdmin, async (req, res) => {
  const { estudiantes, password } = req.body;
  if (!Array.isArray(estudiantes) || estudiantes.length === 0) {
    return res.status(400).json({ error: 'Debes indicar al menos un estudiante' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'La contraseña temporal debe tener al menos 4 caracteres' });
  }
  try {
    const materia = await pool.query('SELECT id FROM materias WHERE id = $1', [req.params.id]);
    if (materia.rows.length === 0) return res.status(404).json({ error: 'Materia no encontrada' });

    const hash = bcrypt.hashSync(password, 10);
    let creados = 0;
    let existentes = 0;
    let inscritos = 0;

    for (const est of estudiantes) {
      const nombre = (est.nombre || '').trim();
      const correo = (est.correo || '').trim().toLowerCase();
      if (!nombre || !correo) continue;

      let usuarioId;
      const existe = await pool.query('SELECT id FROM usuarios WHERE correo = $1', [correo]);
      if (existe.rows.length > 0) {
        usuarioId = existe.rows[0].id;
        existentes++;
      } else {
        const creado = await pool.query(
          "INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES ($1, $2, $3, 'estudiante') RETURNING id",
          [nombre, correo, hash]
        );
        usuarioId = creado.rows[0].id;
        creados++;
      }

      const insc = await pool.query(
        'INSERT INTO inscripciones (materia_id, usuario_id) VALUES ($1, $2) ON CONFLICT (materia_id, usuario_id) DO NOTHING RETURNING id',
        [req.params.id, usuarioId]
      );
      if (insc.rows.length > 0) inscritos++;
    }

    res.status(201).json({ creados, existentes, inscritos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar estudiantes en lote' });
  }
});

// Libro de calificaciones: matriz de estudiantes x tareas con la nota de cada uno,
// mas el promedio individual, para toda la materia (no solo una tarea a la vez).
app.get('/api/materias/:id/libro-notas', requireAdmin, async (req, res) => {
  try {
    const usuarioId = await usuarioEfectivo(req);
    if (!(await materiaVisible(req.params.id, usuarioId))) return res.status(404).json({ error: 'Materia no encontrada' });

    const tareasResult = await pool.query(
      'SELECT id, titulo FROM tareas WHERE materia_id = $1 ORDER BY id',
      [req.params.id]
    );

    const estudiantesResult = await pool.query(
      `SELECT u.id, u.nombre, u.correo
       FROM inscripciones i JOIN usuarios u ON u.id = i.usuario_id
       WHERE i.materia_id = $1
       ORDER BY u.nombre`,
      [req.params.id]
    );

    const notasResult = await pool.query(
      `SELECT n.usuario_id, n.tarea_id, n.nota
       FROM notas n JOIN tareas t ON t.id = n.tarea_id
       WHERE t.materia_id = $1`,
      [req.params.id]
    );

    const notasPorEstudiante = {};
    notasResult.rows.forEach((n) => {
      if (!notasPorEstudiante[n.usuario_id]) notasPorEstudiante[n.usuario_id] = {};
      notasPorEstudiante[n.usuario_id][n.tarea_id] = n.nota === null ? null : Number(n.nota);
    });

    const estudiantes = estudiantesResult.rows.map((e) => {
      const notas = notasPorEstudiante[e.id] || {};
      const valores = Object.values(notas).filter((v) => v !== null && v !== undefined);
      const promedio = valores.length
        ? Number((valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(2))
        : null;
      return { ...e, notas, promedio };
    });

    res.json({ tareas: tareasResult.rows, estudiantes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el libro de calificaciones' });
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

app.post('/api/materias/:id/anuncios', requireAdmin, async (req, res) => {
  const { contenido } = req.body;
  if (!contenido || !contenido.trim()) return res.status(400).json({ error: 'El contenido del anuncio es obligatorio' });
  try {
    const materia = await pool.query('SELECT id FROM materias WHERE id = $1 AND usuario_id = $2', [req.params.id, await usuarioEfectivo(req)]);
    if (materia.rows.length === 0) return res.status(404).json({ error: 'Materia no encontrada' });
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

app.delete('/api/anuncios/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM anuncios a USING materias m
       WHERE a.id = $1 AND a.materia_id = m.id AND m.usuario_id = $2
       RETURNING a.id`,
      [req.params.id, await usuarioEfectivo(req)]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Anuncio no encontrado' });
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

app.post('/api/tareas', requireAdmin, async (req, res) => {
  const { titulo, descripcion, prioridad, fecha_limite, materia_id } = req.body;
  if (!titulo) return res.status(400).json({ error: 'El título es obligatorio' });
  const prioridadFinal = PRIORIDADES_VALIDAS.includes(prioridad) ? prioridad : 'media';
  try {
    if (materia_id) {
      if (!(await materiaVisible(materia_id, await usuarioEfectivo(req)))) return res.status(403).json({ error: 'Materia no válida' });
    }
    const result = await pool.query(
      'INSERT INTO tareas (titulo, descripcion, prioridad, fecha_limite, materia_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [titulo, descripcion || null, prioridadFinal, fecha_limite || null, materia_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la tarea' });
  }
});

app.put('/api/tareas/:id', requireAdmin, async (req, res) => {
  const { titulo, descripcion, completada, prioridad, fecha_limite, materia_id } = req.body;
  const prioridadFinal = PRIORIDADES_VALIDAS.includes(prioridad) ? prioridad : 'media';
  try {
    const usuarioId = await usuarioEfectivo(req);
    const propia = await pool.query(
      `SELECT t.id FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE t.id = $1 AND ${VISIBLE_MATERIA.replace(/\$USR/g, '$2')}`,
      [req.params.id, usuarioId]
    );
    if (propia.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    const motivoBloqueo = await entregaBloqueada(req, req.params.id);
    if (motivoBloqueo) return res.status(403).json({ error: motivoBloqueo });
    if (materia_id) {
      if (!(await materiaVisible(materia_id, usuarioId))) return res.status(403).json({ error: 'Materia no válida' });
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

app.delete('/api/tareas/completadas', requireAdmin, async (req, res) => {
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

app.delete('/api/tareas/:id', requireAdmin, async (req, res) => {
  try {
    const usuarioId = await usuarioEfectivo(req);
    const motivoBloqueo = await entregaBloqueada(req, req.params.id);
    if (motivoBloqueo) return res.status(403).json({ error: motivoBloqueo });
    const archivosPrevios = await pool.query(
      `SELECT a.ruta FROM archivos_tarea a
       JOIN tareas t ON t.id = a.tarea_id
       JOIN materias m ON m.id = t.materia_id
       WHERE a.tarea_id = $1 AND ${VISIBLE_MATERIA.replace(/\$USR/g, '$2')}`,
      [req.params.id, usuarioId]
    );
    const result = await pool.query(
      `DELETE FROM tareas USING materias m
       WHERE tareas.id = $1 AND tareas.materia_id = m.id AND ${VISIBLE_MATERIA.replace(/\$USR/g, '$2')}
       RETURNING tareas.*`,
      [req.params.id, usuarioId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
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
      `SELECT t.id FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE t.id = $1 AND (m.usuario_id = $2 OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.materia_id = m.id AND i.usuario_id = $2))`,
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
      `SELECT t.id FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE t.id = $1 AND (m.usuario_id = $2 OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.materia_id = m.id AND i.usuario_id = $2))`,
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
      `SELECT t.id FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE t.id = $1 AND (m.usuario_id = $2 OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.materia_id = m.id AND i.usuario_id = $2))`,
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
      `SELECT t.id FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE t.id = $1 AND (m.usuario_id = $2 OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.materia_id = m.id AND i.usuario_id = $2))`,
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
      `SELECT t.id FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE t.id = $1 AND (m.usuario_id = $2 OR EXISTS (SELECT 1 FROM inscripciones i WHERE i.materia_id = m.id AND i.usuario_id = $2))`,
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

app.get('/api/tareas/:id/registro', requireAdmin, async (req, res) => {
  try {
    const usuarioId = await usuarioEfectivo(req);
    const tarea = await pool.query(
      `SELECT t.id, t.materia_id FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE t.id = $1 AND ${VISIBLE_MATERIA.replace(/\$USR/g, '$2')}`,
      [req.params.id, usuarioId]
    );
    if (tarea.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
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

app.put('/api/tareas/:id/notas', requireAdmin, async (req, res) => {
  const { usuario_id, nota, comentario } = req.body;
  if (!usuario_id) return res.status(400).json({ error: 'Debes indicar un estudiante' });
  const notaFinal = nota === '' || nota === null || nota === undefined ? null : Number(nota);
  if (notaFinal !== null && (isNaN(notaFinal) || notaFinal < 0 || notaFinal > 10)) {
    return res.status(400).json({ error: 'La nota debe estar entre 0 y 10' });
  }
  try {
    const tarea = await pool.query(
      `SELECT t.id FROM tareas t JOIN materias m ON m.id = t.materia_id WHERE t.id = $1 AND ${VISIBLE_MATERIA.replace(/\$USR/g, '$2')}`,
      [req.params.id, await usuarioEfectivo(req)]
    );
    if (tarea.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
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
  if (err.message === 'TIPO_ARCHIVO_NO_PERMITIDO') {
    return res.status(400).json({ error: 'Tipo de archivo no permitido. Solo se aceptan PDF, Word e imágenes.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => console.log(`Backend escuchando en el puerto ${PORT}`));
