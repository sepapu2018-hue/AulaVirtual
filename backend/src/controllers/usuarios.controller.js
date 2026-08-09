const usuariosService = require('../services/usuarios.service');
const controlador = require('../utils/controlador');

const listar = controlador('Error al obtener los usuarios', async (req, res) => {
  const usuarios = await usuariosService.listar(req.query.rol);
  res.json(usuarios);
});

const crear = controlador('Error al crear la cuenta', async (req, res) => {
  const usuario = await usuariosService.crear(req.body);
  res.status(201).json(usuario);
});

const eliminar = controlador('Error al eliminar la cuenta', async (req, res) => {
  await usuariosService.eliminar(Number(req.params.id), req.usuario.id);
  res.json({ message: 'Cuenta eliminada' });
});

module.exports = { listar, crear, eliminar };
