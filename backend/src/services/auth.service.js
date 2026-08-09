const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuariosRepository = require('../repositories/usuarios.repository');
const HttpError = require('../utils/httpError');
const { JWT_SECRET } = require('../config/env');

function generarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

async function login(correo, password) {
  if (!correo || !password) {
    throw new HttpError(400, 'Correo y contraseña son obligatorios');
  }

  const usuario = await usuariosRepository.buscarPorCorreo(correo.trim().toLowerCase());
  if (!usuario) {
    throw new HttpError(401, 'Credenciales inválidas');
  }

  const coincide = bcrypt.compareSync(password, usuario.password_hash);
  if (!coincide) {
    throw new HttpError(401, 'Credenciales inválidas');
  }

  return {
    token: generarToken(usuario),
    usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol }
  };
}

module.exports = { login };
