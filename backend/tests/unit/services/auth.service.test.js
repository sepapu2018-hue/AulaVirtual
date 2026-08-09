jest.mock('../../../src/repositories/usuarios.repository');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuariosRepository = require('../../../src/repositories/usuarios.repository');
const authService = require('../../../src/services/auth.service');
const HttpError = require('../../../src/utils/httpError');

const usuarioFalso = {
  id: 1,
  nombre: 'Administrador',
  correo: 'admin@gestortareas.com',
  rol: 'admin',
  password_hash: 'hash-falso'
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authService.login', () => {
  test('rechaza si falta correo o contraseña', async () => {
    await expect(authService.login('', '')).rejects.toMatchObject({
      status: 400,
      message: 'Correo y contraseña son obligatorios'
    });
    expect(usuariosRepository.buscarPorCorreo).not.toHaveBeenCalled();
  });

  test('rechaza si el usuario no existe', async () => {
    usuariosRepository.buscarPorCorreo.mockResolvedValue(null);

    await expect(authService.login('nadie@x.com', 'clave')).rejects.toMatchObject({
      status: 401,
      message: 'Credenciales inválidas'
    });
  });

  test('rechaza si la contraseña no coincide', async () => {
    usuariosRepository.buscarPorCorreo.mockResolvedValue(usuarioFalso);
    bcrypt.compareSync.mockReturnValue(false);

    await expect(authService.login('admin@gestortareas.com', 'mala')).rejects.toBeInstanceOf(HttpError);
    await expect(authService.login('admin@gestortareas.com', 'mala')).rejects.toMatchObject({ status: 401 });
  });

  test('normaliza el correo (trim + minúsculas) antes de buscar', async () => {
    usuariosRepository.buscarPorCorreo.mockResolvedValue(usuarioFalso);
    bcrypt.compareSync.mockReturnValue(true);
    jwt.sign.mockReturnValue('token-falso');

    await authService.login('  ADMIN@gestortareas.com  ', 'admin123');

    expect(usuariosRepository.buscarPorCorreo).toHaveBeenCalledWith('admin@gestortareas.com');
  });

  test('devuelve token y datos públicos del usuario cuando las credenciales son correctas', async () => {
    usuariosRepository.buscarPorCorreo.mockResolvedValue(usuarioFalso);
    bcrypt.compareSync.mockReturnValue(true);
    jwt.sign.mockReturnValue('token-falso');

    const resultado = await authService.login('admin@gestortareas.com', 'admin123');

    expect(resultado).toEqual({
      token: 'token-falso',
      usuario: { id: 1, nombre: 'Administrador', correo: 'admin@gestortareas.com', rol: 'admin' }
    });
    // El hash nunca debe salir del service hacia el resto de la app.
    expect(resultado.usuario.password_hash).toBeUndefined();
  });
});
