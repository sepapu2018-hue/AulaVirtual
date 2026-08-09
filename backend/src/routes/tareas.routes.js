const express = require('express');
const tareasController = require('../controllers/tareas.controller');
const comentariosController = require('../controllers/comentarios.controller');
const archivosController = require('../controllers/archivos.controller');
const { requireAdminOProfesor } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

const router = express.Router();

router.get('/', tareasController.listar);
router.get('/estadisticas', tareasController.estadisticas);
router.get('/:id', tareasController.obtenerDetalle);
router.get('/:id/comentarios', comentariosController.listarPorTarea);
router.get('/:id/archivos', archivosController.listarPorTarea);
router.get('/:id/registro', requireAdminOProfesor, tareasController.registro);

router.post('/', requireAdminOProfesor, tareasController.crear);
router.post('/:id/comentarios', comentariosController.crear);
router.post('/:id/archivo', upload.single('archivo'), archivosController.subir);

router.put('/:id', requireAdminOProfesor, tareasController.actualizar);
router.put('/:id/notas', requireAdminOProfesor, tareasController.guardarNota);

router.delete('/completadas', requireAdminOProfesor, tareasController.eliminarCompletadas);
router.delete('/:id', requireAdminOProfesor, tareasController.eliminar);
router.delete('/:id/archivo/:archivoId', archivosController.eliminar);

module.exports = router;
