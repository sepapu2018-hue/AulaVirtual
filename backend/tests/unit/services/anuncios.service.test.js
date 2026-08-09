jest.mock('../../../src/repositories/anuncios.repository');
jest.mock('../../../src/services/materias.service');
jest.mock('../../../src/services/usuarios.service');

const anunciosRepository = require('../../../src/repositories/anuncios.repository');
const materiasService = require('../../../src/services/materias.service');
const usuariosService = require('../../../src/services/usuarios.service');
const anunciosService = require('../../../src/services/anuncios.service');

const profesor = { id: 2, rol: 'profesor' };

beforeEach(() => {
  jest.clearAllMocks();
  usuariosService.usuarioEfectivo.mockResolvedValue(2);
});

describe('anunciosService.listar', () => {
  test('404 si la materia no es visible', async () => {
    materiasService.esVisiblePara.mockResolvedValue(false);
    await expect(anunciosService.listar(1, profesor, undefined)).rejects.toMatchObject({ status: 404 });
  });
});

describe('anunciosService.crear', () => {
  test('rechaza contenido vacío como creación como estudiante', async () => {
    await expect(anunciosService.crear(1, '', profesor)).rejects.toMatchObject({
      status: 400,
      message: 'El contenido del anuncio es obligatorio'
    });
  });

  test('403 si el usuario no es docente de la materia (ej. un estudiante)', async () => {
    materiasService.esDocenteDeMateria.mockResolvedValue(false);
    await expect(
      anunciosService.crear(1, 'Aviso', { id: 5, rol: 'estudiante' })
    ).rejects.toMatchObject({ status: 403, message: 'No tienes permiso para publicar anuncios en esta materia' });
  });

  test('publica el anuncio cuando el profesor tiene la materia asignada', async () => {
    materiasService.esDocenteDeMateria.mockResolvedValue(true);
    anunciosRepository.crear.mockResolvedValue({ id: 1, contenido: 'Aviso' });

    const anuncio = await anunciosService.crear(1, '  Aviso  ', profesor);

    expect(anunciosRepository.crear).toHaveBeenCalledWith(1, 'Aviso');
    expect(anuncio.id).toBe(1);
  });
});

describe('anunciosService.eliminar', () => {
  test('404 si el anuncio no existe', async () => {
    anunciosRepository.buscarPorId.mockResolvedValue(null);
    await expect(anunciosService.eliminar(1, profesor)).rejects.toMatchObject({ status: 404 });
  });

  test('403 si el usuario no es docente de la materia del anuncio', async () => {
    anunciosRepository.buscarPorId.mockResolvedValue({ materia_id: 9 });
    materiasService.esDocenteDeMateria.mockResolvedValue(false);
    await expect(anunciosService.eliminar(1, profesor)).rejects.toMatchObject({ status: 403 });
  });

  test('elimina el anuncio cuando el usuario es docente de la materia', async () => {
    anunciosRepository.buscarPorId.mockResolvedValue({ materia_id: 9 });
    materiasService.esDocenteDeMateria.mockResolvedValue(true);
    await expect(anunciosService.eliminar(1, profesor)).resolves.toBeUndefined();
    expect(anunciosRepository.eliminar).toHaveBeenCalledWith(1);
  });
});
