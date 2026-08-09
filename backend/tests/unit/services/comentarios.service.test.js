jest.mock('../../../src/repositories/tareas.repository');
jest.mock('../../../src/repositories/comentarios.repository');
jest.mock('../../../src/services/usuarios.service');

const tareasRepository = require('../../../src/repositories/tareas.repository');
const comentariosRepository = require('../../../src/repositories/comentarios.repository');
const usuariosService = require('../../../src/services/usuarios.service');
const comentariosService = require('../../../src/services/comentarios.service');

const estudiante = { id: 5, nombre: 'Ana', rol: 'estudiante' };

beforeEach(() => {
  jest.clearAllMocks();
  usuariosService.usuarioEfectivo.mockResolvedValue(5);
});

describe('comentariosService.listar', () => {
  test('404 si la tarea no es visible', async () => {
    tareasRepository.esVisiblePara.mockResolvedValue(false);
    await expect(comentariosService.listar(1, estudiante, undefined)).rejects.toMatchObject({ status: 404 });
  });

  test('devuelve los comentarios cuando la tarea es visible', async () => {
    tareasRepository.esVisiblePara.mockResolvedValue(true);
    comentariosRepository.listarPorTarea.mockResolvedValue([{ id: 1, contenido: 'Hola' }]);

    const comentarios = await comentariosService.listar(1, estudiante, undefined);
    expect(comentarios).toEqual([{ id: 1, contenido: 'Hola' }]);
  });
});

describe('comentariosService.crear', () => {
  test('rechaza contenido vacío o solo espacios', async () => {
    await expect(comentariosService.crear(1, '   ', estudiante, undefined)).rejects.toMatchObject({
      status: 400,
      message: 'El comentario no puede estar vacío'
    });
    expect(tareasRepository.esVisiblePara).not.toHaveBeenCalled();
  });

  test('404 si la tarea no es visible', async () => {
    tareasRepository.esVisiblePara.mockResolvedValue(false);
    await expect(comentariosService.crear(1, 'Una duda', estudiante, undefined)).rejects.toMatchObject({ status: 404 });
  });

  test('guarda el comentario con el nombre y rol del autor', async () => {
    tareasRepository.esVisiblePara.mockResolvedValue(true);
    comentariosRepository.crear.mockResolvedValue({ id: 2, contenido: 'Una duda' });

    await comentariosService.crear(1, '  Una duda  ', estudiante, undefined);

    expect(comentariosRepository.crear).toHaveBeenCalledWith({
      tareaId: 1,
      autorNombre: 'Ana',
      autorRol: 'estudiante',
      contenido: 'Una duda'
    });
  });
});

describe('comentariosService.eliminar', () => {
  test('404 si no se pudo eliminar (no existe o sin visibilidad)', async () => {
    comentariosRepository.eliminarSiVisible.mockResolvedValue(null);
    await expect(comentariosService.eliminar(1, estudiante, undefined)).rejects.toMatchObject({
      status: 404,
      message: 'Comentario no encontrado'
    });
  });

  test('elimina correctamente sin exigir que el usuario sea el autor', async () => {
    comentariosRepository.eliminarSiVisible.mockResolvedValue({ id: 1 });
    await expect(comentariosService.eliminar(1, estudiante, undefined)).resolves.toBeUndefined();
  });
});
