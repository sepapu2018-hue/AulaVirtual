const express = require('express');
const comentariosController = require('../controllers/comentarios.controller');

const router = express.Router();

router.delete('/:id', comentariosController.eliminar);

module.exports = router;
