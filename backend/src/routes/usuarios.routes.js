const express = require('express');
const usuariosController = require('../controllers/usuarios.controller');
const { requireAdmin } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requireAdmin, usuariosController.listar);
router.post('/', requireAdmin, usuariosController.crear);
router.delete('/:id', requireAdmin, usuariosController.eliminar);

module.exports = router;
