const bcrypt = require('bcryptjs');
const usuariosRepository = require('../repositories/usuarios.repository');
const HttpError = require('../utils/httpError');

const ROLES_GESTIONABLES = ['estudiante', 'profesor', 'admin'];

async function listar(rolSolicitado) {
  const rol = ROLES_GESTIONABLES.includes(rolSolicitado) ? rolSolicitado : 'estudiante';
  return usuariosRepository.listarPorRol(rol);
}

async function crear({ nombre, correo, password, rol: rolSolicitado }) {
  const rol = ROLES_GESTIONABLES.includes(rolSolicitado) ? rolSolicitado : 'estudiante';

  if (!nombre || !correo || !password) {
    throw new HttpError(400, 'Nombre, correo y contraseña son obligatorios');
  }
  if (password.length < 4) {
    throw new HttpError(400, 'La contraseña debe tener al menos 4 caracteres');
  }

  const correoNormalizado = correo.trim().toLowerCase();
  if (await usuariosRepository.existeCorreo(correoNormalizado)) {
    throw new HttpError(400, 'Ya existe una cuenta con ese correo');
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  return usuariosRepository.crear({ nombre: nombre.trim(), correo: correoNormalizado, passwordHash, rol });
}

async function eliminar(idObjetivo, usuarioActualId) {
  if (idObjetivo === usuarioActualId) {
    throw new HttpError(400, 'No puedes eliminar tu propia cuenta');
  }

  const objetivo = await usuariosRepository.buscarPorId(idObjetivo);
  if (objetivo && objetivo.rol === 'admin') {
    const totalAdmins = await usuariosRepository.contarPorRol('admin');
    if (totalAdmins <= 1) {
      throw new HttpError(400, 'No puedes eliminar al último administrador del sistema');
    }
  }

  const eliminado = await usuariosRepository.eliminar(idObjetivo, ROLES_GESTIONABLES);
  if (!eliminado) {
    throw new HttpError(404, 'Cuenta no encontrada');
  }
}

async function esProfesorValido(id) {
  return usuariosRepository.esProfesorValido(id);
}

async function buscarEstudianteValido(id) {
  return usuariosRepository.buscarEstudiante(id);
}

async function conteoPorRol() {
  const filas = await usuariosRepository.conteoPorRol();
  const conteo = { admin: 0, profesor: 0, estudiante: 0 };
  filas.forEach((fila) => { conteo[fila.rol] = fila.total; });
  return conteo;
}

// El admin puede actuar "como" un estudiante pasando ?como=<id_estudiante>.
// Cualquier otro usuario siempre actúa sobre sus propios datos.
async function usuarioEfectivo(usuario, comoId) {
  if (usuario.rol === 'admin' && comoId) {
    const estudiante = await usuariosRepository.buscarEstudiante(comoId);
    if (estudiante) return estudiante.id;
  }
  return usuario.id;
}

module.exports = {
  ROLES_GESTIONABLES,
  listar,
  crear,
  eliminar,
  esProfesorValido,
  buscarEstudianteValido,
  conteoPorRol,
  usuarioEfectivo
};
