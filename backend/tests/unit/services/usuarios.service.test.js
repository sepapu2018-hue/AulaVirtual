jest.mock('../../../src/repositories/usuarios.repository');
jest.mock('bcryptjs');

const bcrypt = require('bcryptjs');
const usuariosRepository = require('../../../src/repositories/usuarios.repository');
const usuariosService = require('../../../src/services/usuarios.service');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usuariosService.listar', () => {
  test('usa el rol pedido cuando es válido', async () => {
    usuariosRepository.listarPorRol.mockResolvedValue([]);
    await usuariosService.listar('profesor');
    expect(usuariosRepository.listarPorRol).toHaveBeenCalledWith('profesor');
  });

  test('cae a "estudiante" cuando el rol no es gestionable', async () => {
    usuariosRepository.listarPorRol.mockResolvedValue([]);
    await usuariosService.listar('rol-inventado');
    expect(usuariosRepository.listarPorRol).toHaveBeenCalledWith('estudiante');
  });
});

describe('usuariosService.crear', () => {
  test('rechaza si falta nombre, correo o contraseña', async () => {
    await expect(usuariosService.crear({ nombre: '', correo: '', password: '' })).rejects.toMatchObject({
      status: 400,
      message: 'Nombre, correo y contraseña son obligatorios'
    });
  });

  test('rechaza contraseñas de menos de 4 caracteres', async () => {
    await expect(
      usuariosService.crear({ nombre: 'Ana', correo: 'ana@x.com', password: 'abc' })
    ).rejects.toMatchObject({ status: 400, message: 'La contraseña debe tener al menos 4 caracteres' });
  });

  test('rechaza correo ya registrado', async () => {
    usuariosRepository.existeCorreo.mockResolvedValue(true);

    await expect(
      usuariosService.crear({ nombre: 'Ana', correo: 'ana@x.com', password: 'abcd' })
    ).rejects.toMatchObject({ status: 400, message: 'Ya existe una cuenta con ese correo' });
  });

  test('crea la cuenta con el rol pedido, hasheando la contraseña', async () => {
    usuariosRepository.existeCorreo.mockResolvedValue(false);
    bcrypt.hashSync.mockReturnValue('hash-seguro');
    usuariosRepository.crear.mockResolvedValue({ id: 5, nombre: 'Ana', correo: 'ana@x.com', rol: 'profesor' });

    const resultado = await usuariosService.crear({ nombre: '  Ana  ', correo: '  ANA@X.com  ', password: 'abcd', rol: 'profesor' });

    expect(bcrypt.hashSync).toHaveBeenCalledWith('abcd', 10);
    expect(usuariosRepository.crear).toHaveBeenCalledWith({
      nombre: 'Ana',
      correo: 'ana@x.com',
      passwordHash: 'hash-seguro',
      rol: 'profesor'
    });
    expect(resultado.rol).toBe('profesor');
  });

  test('cae a rol "estudiante" si no se pide uno gestionable', async () => {
    usuariosRepository.existeCorreo.mockResolvedValue(false);
    bcrypt.hashSync.mockReturnValue('hash');
    usuariosRepository.crear.mockResolvedValue({});

    await usuariosService.crear({ nombre: 'Ana', correo: 'ana@x.com', password: 'abcd', rol: 'superadmin' });

    expect(usuariosRepository.crear).toHaveBeenCalledWith(expect.objectContaining({ rol: 'estudiante' }));
  });
});

describe('usuariosService.eliminar', () => {
  test('impide que un usuario se elimine a sí mismo', async () => {
    await expect(usuariosService.eliminar(1, 1)).rejects.toMatchObject({
      status: 400,
      message: 'No puedes eliminar tu propia cuenta'
    });
    expect(usuariosRepository.buscarPorId).not.toHaveBeenCalled();
  });

  test('impide eliminar al último administrador', async () => {
    usuariosRepository.buscarPorId.mockResolvedValue({ rol: 'admin' });
    usuariosRepository.contarPorRol.mockResolvedValue(1);

    await expect(usuariosService.eliminar(2, 1)).rejects.toMatchObject({
      status: 400,
      message: 'No puedes eliminar al último administrador del sistema'
    });
    expect(usuariosRepository.eliminar).not.toHaveBeenCalled();
  });

  test('permite eliminar un admin si hay más de uno', async () => {
    usuariosRepository.buscarPorId.mockResolvedValue({ rol: 'admin' });
    usuariosRepository.contarPorRol.mockResolvedValue(2);
    usuariosRepository.eliminar.mockResolvedValue({ id: 2 });

    await expect(usuariosService.eliminar(2, 1)).resolves.toBeUndefined();
  });

  test('lanza 404 si la cuenta no existe o no es gestionable', async () => {
    usuariosRepository.buscarPorId.mockResolvedValue(null);
    usuariosRepository.eliminar.mockResolvedValue(null);

    await expect(usuariosService.eliminar(99, 1)).rejects.toMatchObject({
      status: 404,
      message: 'Cuenta no encontrada'
    });
  });
});

describe('usuariosService.usuarioEfectivo', () => {
  test('un estudiante o profesor siempre actúa como sí mismo', async () => {
    const usuario = { id: 7, rol: 'estudiante' };
    const id = await usuariosService.usuarioEfectivo(usuario, 99);
    expect(id).toBe(7);
    expect(usuariosRepository.buscarEstudiante).not.toHaveBeenCalled();
  });

  test('el admin sin ?como actúa como sí mismo', async () => {
    const id = await usuariosService.usuarioEfectivo({ id: 1, rol: 'admin' }, undefined);
    expect(id).toBe(1);
  });

  test('el admin con ?como válido actúa como ese estudiante', async () => {
    usuariosRepository.buscarEstudiante.mockResolvedValue({ id: 42 });
    const id = await usuariosService.usuarioEfectivo({ id: 1, rol: 'admin' }, 42);
    expect(id).toBe(42);
  });

  test('el admin con ?como inválido cae de vuelta a sí mismo', async () => {
    usuariosRepository.buscarEstudiante.mockResolvedValue(null);
    const id = await usuariosService.usuarioEfectivo({ id: 1, rol: 'admin' }, 999);
    expect(id).toBe(1);
  });
});

describe('usuariosService.esProfesorValido', () => {
  test('delega en el repositorio', async () => {
    usuariosRepository.esProfesorValido.mockResolvedValue(true);
    await expect(usuariosService.esProfesorValido(3)).resolves.toBe(true);
    expect(usuariosRepository.esProfesorValido).toHaveBeenCalledWith(3);
  });
});

describe('usuariosService.buscarEstudianteValido', () => {
  test('delega en el repositorio', async () => {
    usuariosRepository.buscarEstudiante.mockResolvedValue({ id: 4 });
    await expect(usuariosService.buscarEstudianteValido(4)).resolves.toEqual({ id: 4 });
  });
});

describe('usuariosService.conteoPorRol', () => {
  test('arma el objeto con los tres roles aunque falten filas', async () => {
    usuariosRepository.conteoPorRol.mockResolvedValue([{ rol: 'estudiante', total: 5 }]);
    const conteo = await usuariosService.conteoPorRol();
    expect(conteo).toEqual({ admin: 0, profesor: 0, estudiante: 5 });
  });
});
