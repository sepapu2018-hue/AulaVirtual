jest.mock('fs');
jest.mock('../../../src/repositories/tareas.repository');
jest.mock('../../../src/repositories/archivos.repository');
jest.mock('../../../src/services/tareas.service');
jest.mock('../../../src/services/usuarios.service');

const fs = require('fs');
const tareasRepository = require('../../../src/repositories/tareas.repository');
const archivosRepository = require('../../../src/repositories/archivos.repository');
const tareasService = require('../../../src/services/tareas.service');
const usuariosService = require('../../../src/services/usuarios.service');
const archivosService = require('../../../src/services/archivos.service');

const admin = { id: 1, rol: 'admin' };
const archivoSubido = { filename: 'guardado-123.pdf', originalname: 'tarea.pdf' };

beforeEach(() => {
  jest.clearAllMocks();
  usuariosService.usuarioEfectivo.mockResolvedValue(1);
  tareasService.motivoEntregaBloqueada.mockResolvedValue(null);
  fs.unlink.mockImplementation((ruta, callback) => callback());
});

describe('archivosService.listar', () => {
  test('404 si la tarea no es visible para el usuario', async () => {
    tareasRepository.esVisiblePara.mockResolvedValue(false);
    await expect(archivosService.listar(1, admin, undefined)).rejects.toMatchObject({ status: 404 });
  });

  test('devuelve los archivos cuando la tarea es visible', async () => {
    tareasRepository.esVisiblePara.mockResolvedValue(true);
    archivosRepository.listarPorTarea.mockResolvedValue([{ id: 1, nombre_original: 'tarea.pdf' }]);

    const archivos = await archivosService.listar(1, admin, undefined);

    expect(archivos).toEqual([{ id: 1, nombre_original: 'tarea.pdf' }]);
  });
});

describe('archivosService.subir', () => {
  test('404 y borra el archivo temporal si la tarea no es visible', async () => {
    tareasRepository.esVisiblePara.mockResolvedValue(false);

    await expect(archivosService.subir(1, admin, undefined, archivoSubido)).rejects.toMatchObject({ status: 404 });
    expect(fs.unlink).toHaveBeenCalledTimes(1);
    expect(archivosRepository.crear).not.toHaveBeenCalled();
  });

  test('403 y borra el archivo temporal si la entrega está bloqueada', async () => {
    tareasRepository.esVisiblePara.mockResolvedValue(true);
    tareasService.motivoEntregaBloqueada.mockResolvedValue('El plazo de entrega ya venció y no se puede modificar');

    await expect(archivosService.subir(1, { id: 5, rol: 'estudiante' }, undefined, archivoSubido)).rejects.toMatchObject({
      status: 403,
      message: 'El plazo de entrega ya venció y no se puede modificar'
    });
    expect(fs.unlink).toHaveBeenCalledTimes(1);
  });

  test('guarda el archivo, marca la tarea completada y devuelve la tarea con archivos', async () => {
    tareasRepository.esVisiblePara.mockResolvedValue(true);
    tareasService.conArchivos.mockResolvedValue({ id: 1, completada: true, archivos: [{ id: 9 }] });

    const resultado = await archivosService.subir(1, admin, undefined, archivoSubido);

    expect(archivosRepository.crear).toHaveBeenCalledWith({
      tareaId: 1,
      usuarioId: 1,
      nombreOriginal: 'tarea.pdf',
      ruta: 'guardado-123.pdf'
    });
    expect(tareasRepository.marcarCompletada).toHaveBeenCalledWith(1, true);
    expect(resultado.completada).toBe(true);
    expect(fs.unlink).not.toHaveBeenCalled();
  });
});

describe('archivosService.eliminar', () => {
  test('404 si la tarea no es visible', async () => {
    tareasRepository.esVisiblePara.mockResolvedValue(false);
    await expect(archivosService.eliminar(1, 9, admin, undefined)).rejects.toMatchObject({ status: 404 });
  });

  test('403 si la entrega está bloqueada', async () => {
    tareasRepository.esVisiblePara.mockResolvedValue(true);
    tareasService.motivoEntregaBloqueada.mockResolvedValue('Esta tarea ya fue calificada y no se puede modificar');

    await expect(archivosService.eliminar(1, 9, { id: 5, rol: 'estudiante' }, undefined)).rejects.toMatchObject({ status: 403 });
  });

  test('404 si el archivo no existe', async () => {
    tareasRepository.esVisiblePara.mockResolvedValue(true);
    archivosRepository.eliminar.mockResolvedValue(null);

    await expect(archivosService.eliminar(1, 9, admin, undefined)).rejects.toMatchObject({
      status: 404,
      message: 'Archivo no encontrado'
    });
  });

  test('desmarca la tarea como completada si no quedan archivos', async () => {
    tareasRepository.esVisiblePara.mockResolvedValue(true);
    archivosRepository.eliminar.mockResolvedValue({ ruta: 'guardado-123.pdf' });
    archivosRepository.contarPorTarea.mockResolvedValue(0);
    tareasService.conArchivos.mockResolvedValue({ id: 1, completada: false, archivos: [] });

    const resultado = await archivosService.eliminar(1, 9, admin, undefined);

    expect(tareasRepository.marcarCompletada).toHaveBeenCalledWith(1, false);
    expect(resultado.completada).toBe(false);
  });

  test('mantiene la tarea completada si aún quedan archivos', async () => {
    tareasRepository.esVisiblePara.mockResolvedValue(true);
    archivosRepository.eliminar.mockResolvedValue({ ruta: 'guardado-123.pdf' });
    archivosRepository.contarPorTarea.mockResolvedValue(2);
    tareasService.conArchivos.mockResolvedValue({ id: 1, completada: true, archivos: [{}, {}] });

    await archivosService.eliminar(1, 9, admin, undefined);

    expect(tareasRepository.marcarCompletada).not.toHaveBeenCalled();
  });
});
