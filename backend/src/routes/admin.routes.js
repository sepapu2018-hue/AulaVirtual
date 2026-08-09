const express = require('express');
const adminController = require('../controllers/admin.controller');
const { requireAdmin } = require('../middlewares/auth');

const router = express.Router();

router.get('/estadisticas', requireAdmin, adminController.estadisticas);

module.exports = router;
