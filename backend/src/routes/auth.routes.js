const express = require('express');
const authController = require('../controllers/auth.controller');
const { limitadorLogin } = require('../middlewares/seguridad');

const router = express.Router();

router.post('/login', limitadorLogin, authController.login);

module.exports = router;
