const express = require('express');
const anunciosController = require('../controllers/anuncios.controller');
const { requireAdminOProfesor } = require('../middlewares/auth');

const router = express.Router();

router.delete('/:id', requireAdminOProfesor, anunciosController.eliminar);

module.exports = router;
