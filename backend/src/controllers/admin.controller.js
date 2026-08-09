const adminService = require('../services/admin.service');
const controlador = require('../utils/controlador');

const estadisticas = controlador('Error al obtener las estadísticas', async (req, res) => {
  res.json(await adminService.estadisticas());
});

module.exports = { estadisticas };
