jest.mock('fs');
jest.mock('../../../src/repositories/tareas.repository');
jest.mock('../../../src/repositories/notas.repository');
jest.mock('../../../src/repositories/archivos.repository');
jest.mock('../../../src/services/materias.service');
jest.mock('../../../src/services/usuarios.service');

const fs = require('fs');
const tareasRepository = require('../../../src/repositories/tareas.repository');
const notasRepository = require('../../../src/repositories/notas.repository');
const archivosRepository = require('../../../src/repositories/archivos.repository');
const materiasService = require('../../../src/services/materias.service');
const usuariosService = require('../../../src/services/usuarios.service');
const tareasService = require('../../../src/services/tareas.service');

const admin = { id: 1, rol: 'admin' };

beforeEach(() => {
  jest.clearAllMocks();
  usuariosService.usuarioEfectivo.mockImplementation(async (usuario) => usuario.id);
  fs.unlink.mockImplementation((ruta, callback) => callback());
});

describe('tareasService.listar', () => {
  test('resuelve el usuario efectivo y delega en el repositorio', async () => {
    tareasRepository.listarVisibles.mockResolvedValue([{ id: 1 }]);
    const tareas = await tareasService.listar(admin, 5, undefined);
    expect(usuariosService.usuarioEfectivo).toHaveBeenCalledWith(admin, undefined);
    expect(tareasRepository.listarVisibles).toHaveBeenCalledWith(1, 5);
    expect(tareas).toEqual([{ id: 1 }]);
  });
});

describe('tareasService.obtenerDetalle', () => {
  test('404 si la tarea no es visible', async () => {
    tareasRepository.buscarVisiblePorId.mockResolvedValue(null);
    await expect(tareasService.obtenerDetalle(1, admin, undefined)).rejects.toMatchObject({
      status: 404,
      message: 'Tarea no encontrada'
    });
  });

  test('incluye archivos y mi_nota (null si no hay nota) cuando la tarea es visible', async () => {
    tareasRepository.buscarVisiblePorId.mockResolvedValue({ id: 1, titulo: 'X' });
    notasRepository.buscarPorTareaYUsuario.mockResolvedValue(null);
    archivosRepository.listarPorTarea.mockResolvedValue([{ id: 9 }]);

    const tarea = await tareasService.obtenerDetalle(1, admin, undefined);

    expect(tarea).toEqual({ id: 1, titulo: 'X', archivos: [{ id: 9 }], mi_nota: null });
  });
});

describe('tareasService.eliminarCompletadas', () => {
  test('resuelve el usuario efectivo y devuelve cuántas se eliminaron', async () => {
    tareasRepository.eliminarCompletadas.mockResolvedValue(3);
    const eliminadas = await tareasService.eliminarCompletadas(admin, 5, undefined);
    expect(tareasRepository.eliminarCompletadas).toHaveBeenCalledWith(1, 5);
    expect(eliminadas).toBe(3);
  });
});

describe('tareasService.registro (caso exitoso)', () => {
  test('devuelve el registro de entregas cuando el usuario es docente', async () => {
    tareasRepository.buscarPorId.mockResolvedValue({ id: 1, materia_id: 5 });
    materiasService.esDocenteDeMateria.mockResolvedValue(true);
    tareasRepository.registroEntregas.mockResolvedValue([{ usuario_id: 5, nombre: 'Ana' }]);

    const registro = await tareasService.registro(1, admin);

    expect(tareasRepository.registroEntregas).toHaveBeenCalledWith(5, 1);
    expect(registro).toEqual([{ usuario_id: 5, nombre: 'Ana' }]);
  });
});

describe('tareasService.conArchivos', () => {
  test('combina la tarea con su lista de archivos, sin mi_nota', async () => {
    tareasRepository.buscarPorId.mockResolvedValue({ id: 1, completada: true });
    archivosRepository.listarPorTarea.mockResolvedValue([{ id: 9 }]);

    const tarea = await tareasService.conArchivos(1);

    expect(tarea).toEqual({ id: 1, completada: true, archivos: [{ id: 9 }] });
    expect(tarea.mi_nota).toBeUndefined();
  });
});

describe('tareasService.crear', () => {
  test('exige título', async () => {
    await expect(tareasService.crear({ titulo: '', materiaId: 1 }, admin)).rejects.toMatchObject({
      status: 400,
      message: 'El título es obligatorio'
    });
  });

  test('exige materia', async () => {
    await expect(tareasService.crear({ titulo: 'X', materiaId: null }, admin)).rejects.toMatchObject({
      status: 400,
      message: 'Debes indicar la materia de la tarea'
    });
  });

  test('rechaza si el usuario no es docente de la materia', async () => {
    materiasService.esDocenteDeMateria.mockResolvedValue(false);
    await expect(
      tareasService.crear({ titulo: 'X', materiaId: 1 }, { id: 2, rol: 'estudiante' })
    ).rejects.toMatchObject({ status: 403, message: 'No tienes permiso para crear tareas en esta materia' });
  });

  test('usa "media" como prioridad por defecto si viene una inválida', async () => {
    materiasService.esDocenteDeMateria.mockResolvedValue(true);
    tareasRepository.crear.mockResolvedValue({ id: 1, prioridad: 'media' });

    await tareasService.crear({ titulo: 'X', materiaId: 1, prioridad: 'urgentísima' }, admin);

    expect(tareasRepository.crear).toHaveBeenCalledWith(expect.objectContaining({ prioridad: 'media' }));
  });
});

describe('tareasService.actualizar', () => {
  test('404 si la tarea no existe', async () => {
    tareasRepository.buscarPorId.mockResolvedValue(null);
    await expect(tareasService.actualizar(1, {}, admin)).rejects.toMatchObject({ status: 404 });
  });

  test('403 si el usuario no es docente de la materia actual', async () => {
    tareasRepository.buscarPorId.mockResolvedValue({ id: 1, materia_id: 5 });
    materiasService.esDocenteDeMateria.mockResolvedValue(false);

    await expect(tareasService.actualizar(1, {}, { id: 2, rol: 'estudiante' })).rejects.toMatchObject({
      status: 403,
      message: 'No tienes permiso para modificar esta tarea'
    });
  });

  test('403 con mensaje distinto si se intenta mover a una materia no autorizada', async () => {
    tareasRepository.buscarPorId.mockResolvedValue({ id: 1, materia_id: 5 });
    materiasService.esDocenteDeMateria.mockImplementation(async (materiaId) => materiaId === 5);

    await expect(tareasService.actualizar(1, { materiaId: 9 }, admin)).rejects.toMatchObject({
      status: 403,
      message: 'Materia no válida'
    });
  });
});

describe('tareasService.eliminar', () => {
  test('404 si la tarea no existe', async () => {
    tareasRepository.buscarPorId.mockResolvedValue(null);
    await expect(tareasService.eliminar(1, admin)).rejects.toMatchObject({ status: 404 });
  });

  test('403 si no es docente de la materia', async () => {
    tareasRepository.buscarPorId.mockResolvedValue({ id: 1, materia_id: 5 });
    materiasService.esDocenteDeMateria.mockResolvedValue(false);
    await expect(tareasService.eliminar(1, { id: 2, rol: 'estudiante' })).rejects.toMatchObject({ status: 403 });
  });

  test('borra la tarea y limpia los archivos asociados en disco', async () => {
    tareasRepository.buscarPorId.mockResolvedValue({ id: 1, materia_id: 5 });
    materiasService.esDocenteDeMateria.mockResolvedValue(true);
    archivosRepository.listarRutasPorTarea.mockResolvedValue(['a.pdf', 'b.png']);

    await tareasService.eliminar(1, admin);

    expect(tareasRepository.eliminar).toHaveBeenCalledWith(1);
    expect(fs.unlink).toHaveBeenCalledTimes(2);
  });
});

describe('tareasService.guardarNota', () => {
  test('exige usuario_id', async () => {
    await expect(tareasService.guardarNota(1, { usuarioId: undefined, nota: 8 }, admin)).rejects.toMatchObject({
      status: 400,
      message: 'Debes indicar un estudiante'
    });
  });

  test.each([-1, 11, NaN])('rechaza notas fuera de rango (%p)', async (nota) => {
    await expect(tareasService.guardarNota(1, { usuarioId: 5, nota }, admin)).rejects.toMatchObject({
      status: 400,
      message: 'La nota debe estar entre 0 y 10'
    });
  });

  test('permite nota vacía como "borrar calificación"', async () => {
    tareasRepository.buscarPorId.mockResolvedValue({ id: 1, materia_id: 5 });
    materiasService.esDocenteDeMateria.mockResolvedValue(true);
    notasRepository.guardar.mockResolvedValue({ nota: null });

    await tareasService.guardarNota(1, { usuarioId: 5, nota: '' }, admin);

    expect(notasRepository.guardar).toHaveBeenCalledWith(1, 5, null, null);
  });

  test('404 si la tarea no existe', async () => {
    tareasRepository.buscarPorId.mockResolvedValue(null);
    await expect(tareasService.guardarNota(1, { usuarioId: 5, nota: 8 }, admin)).rejects.toMatchObject({ status: 404 });
  });

  test('403 si el usuario no puede calificar esa tarea', async () => {
    tareasRepository.buscarPorId.mockResolvedValue({ id: 1, materia_id: 5 });
    materiasService.esDocenteDeMateria.mockResolvedValue(false);

    await expect(
      tareasService.guardarNota(1, { usuarioId: 5, nota: 8 }, { id: 2, rol: 'profesor' })
    ).rejects.toMatchObject({ status: 403, message: 'No tienes permiso para calificar esta tarea' });
  });

  test('guarda una nota válida', async () => {
    tareasRepository.buscarPorId.mockResolvedValue({ id: 1, materia_id: 5 });
    materiasService.esDocenteDeMateria.mockResolvedValue(true);
    notasRepository.guardar.mockResolvedValue({ nota: 8.5 });

    const resultado = await tareasService.guardarNota(1, { usuarioId: 5, nota: 8.5, comentario: 'Bien' }, admin);

    expect(notasRepository.guardar).toHaveBeenCalledWith(1, 5, 8.5, 'Bien');
    expect(resultado.nota).toBe(8.5);
  });
});

describe('tareasService.estadisticas', () => {
  test('arma la distribución por prioridad con las tres claves', async () => {
    tareasRepository.estadisticas.mockResolvedValue({
      totales: { total: 3, completadas: 1, pendientes: 2, vencidas: 0 },
      porPrioridad: [{ prioridad: 'alta', cantidad: 2 }]
    });

    const resultado = await tareasService.estadisticas(admin, undefined, undefined);

    expect(resultado).toEqual({
      total: 3, completadas: 1, pendientes: 2, vencidas: 0,
      por_prioridad: { alta: 2, media: 0, baja: 0 }
    });
  });
});

describe('tareasService.registro', () => {
  test('404 si la tarea no existe', async () => {
    tareasRepository.buscarPorId.mockResolvedValue(null);
    await expect(tareasService.registro(1, admin)).rejects.toMatchObject({ status: 404 });
  });

  test('403 si el usuario no es docente de la materia', async () => {
    tareasRepository.buscarPorId.mockResolvedValue({ id: 1, materia_id: 5 });
    materiasService.esDocenteDeMateria.mockResolvedValue(false);
    await expect(tareasService.registro(1, { id: 2, rol: 'estudiante' })).rejects.toMatchObject({ status: 403 });
  });
});

describe('tareasService.motivoEntregaBloqueada', () => {
  test('el admin nunca está bloqueado', async () => {
    const motivo = await tareasService.motivoEntregaBloqueada(1, admin);
    expect(motivo).toBeNull();
    expect(tareasRepository.estadoEntrega).not.toHaveBeenCalled();
  });

  test('bloquea si ya fue calificada', async () => {
    tareasRepository.estadoEntrega.mockResolvedValue({ calificada: true, vencida: false });
    const motivo = await tareasService.motivoEntregaBloqueada(1, { id: 5, rol: 'estudiante' });
    expect(motivo).toBe('Esta tarea ya fue calificada y no se puede modificar');
  });

  test('bloquea si venció el plazo', async () => {
    tareasRepository.estadoEntrega.mockResolvedValue({ calificada: false, vencida: true });
    const motivo = await tareasService.motivoEntregaBloqueada(1, { id: 5, rol: 'estudiante' });
    expect(motivo).toBe('El plazo de entrega ya venció y no se puede modificar');
  });

  test('no bloquea si no hay nota ni vencimiento', async () => {
    tareasRepository.estadoEntrega.mockResolvedValue({ calificada: false, vencida: false });
    const motivo = await tareasService.motivoEntregaBloqueada(1, { id: 5, rol: 'estudiante' });
    expect(motivo).toBeNull();
  });
});
