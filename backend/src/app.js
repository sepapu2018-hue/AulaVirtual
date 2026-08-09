const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { corsOptions } = require('./middlewares/seguridad');
const { requireAuth } = require('./middlewares/auth');
const errorHandler = require('./middlewares/errorHandler');
const { UPLOADS_DIR } = require('./config/uploads');

const authRoutes = require('./routes/auth.routes');
const materiasRoutes = require('./routes/materias.routes');
const tareasRoutes = require('./routes/tareas.routes');
const anunciosRoutes = require('./routes/anuncios.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const comentariosRoutes = require('./routes/comentarios.routes');
const adminRoutes = require('./routes/admin.routes');
const docsRoutes = require('./routes/docs.routes');

const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());

// Servido públicamente (sin autenticación), igual que antes: el frontend
// enlaza directo a estas URLs sin enviar el header Authorization.
app.use('/api/archivos', express.static(UPLOADS_DIR));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/docs', docsRoutes);

app.use('/api/auth', authRoutes);

app.use('/api/materias', requireAuth, materiasRoutes);
app.use('/api/tareas', requireAuth, tareasRoutes);
app.use('/api/anuncios', requireAuth, anunciosRoutes);
app.use('/api/usuarios', requireAuth, usuariosRoutes);
app.use('/api/comentarios', requireAuth, comentariosRoutes);
app.use('/api/admin', requireAuth, adminRoutes);

app.use(errorHandler);

module.exports = app;
