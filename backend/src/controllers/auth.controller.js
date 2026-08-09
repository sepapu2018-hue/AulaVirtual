const authService = require('../services/auth.service');
const controlador = require('../utils/controlador');

const login = controlador('Error al iniciar sesión', async (req, res) => {
  const { correo, password } = req.body;
  const resultado = await authService.login(correo, password);
  res.json(resultado);
});

module.exports = { login };
