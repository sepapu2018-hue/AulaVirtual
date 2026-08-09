const express = require('express');
const materiasController = require('../controllers/materias.controller');
const anunciosController = require('../controllers/anuncios.controller');
const { requireAdmin, requireAdminOProfesor } = require('../middlewares/auth');

const router = express.Router();

router.get('/', materiasController.listar);
router.post('/', requireAdmin, materiasController.crear);

router.put('/reordenar', requireAdmin, materiasController.reordenar);
router.put('/:id', requireAdmin, materiasController.actualizar);
router.delete('/:id', requireAdmin, materiasController.eliminar);

router.get('/:id/estudiantes', materiasController.listarEstudiantes);
router.post('/:id/estudiantes', requireAdmin, materiasController.inscribirEstudiante);
router.delete('/:id/estudiantes/:usuarioId', requireAdmin, materiasController.desinscribirEstudiante);

router.get('/:id/anuncios', anunciosController.listarPorMateria);
router.post('/:id/anuncios', requireAdminOProfesor, anunciosController.crear);

module.exports = router;
