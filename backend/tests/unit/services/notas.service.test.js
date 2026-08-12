jest.mock('../../../src/repositories/notas.repository');
jest.mock('../../../src/services/materias.service');
jest.mock('../../../src/services/usuarios.service');

const notasRepository = require('../../../src/repositories/notas.repository');
const materiasService = require('../../../src/services/materias.service');
const usuariosService = require('../../../src/services/usuarios.service');
const notasService = require('../../../src/services/notas.service');

beforeEach(() => {
  jest.clearAllMocks();
});

const PROFESOR = { id: 1, rol: 'profesor' };

describe('notasService.listarPorMateria', () => {
  test('rechaza si el usuario no es docente de la materia', async () => {
    materiasService.esDocenteDeMateria.mockResolvedValue(false);

    await expect(notasService.listarPorMateria(5, PROFESOR)).rejects.toMatchObject({
      status: 403
    });
    expect(notasRepository.listarPorMateria).not.toHaveBeenCalled();
  });

  test('reparte 50 puntos entre las tareas de la materia y suma por estudiante', async () => {
    materiasService.esDocenteDeMateria.mockResolvedValue(true);
    notasRepository.listarPorMateria.mockResolvedValue([
      { usuario_id: 10, estudiante_nombre: 'Ana', estudiante_correo: 'ana@x.com', tarea_id: 1, tarea_titulo: 'T1', nota: 10 },
      { usuario_id: 10, estudiante_nombre: 'Ana', estudiante_correo: 'ana@x.com', tarea_id: 2, tarea_titulo: 'T2', nota: 5 },
      { usuario_id: 11, estudiante_nombre: 'Beto', estudiante_correo: 'beto@x.com', tarea_id: 1, tarea_titulo: 'T1', nota: null },
      { usuario_id: 11, estudiante_nombre: 'Beto', estudiante_correo: 'beto@x.com', tarea_id: 2, tarea_titulo: 'T2', nota: null }
    ]);

    const resumen = await notasService.listarPorMateria(5, PROFESOR);

    expect(resumen.total_tareas).toBe(2);
    expect(resumen.valor_tarea).toBe(25);
    expect(resumen.nota_maxima).toBe(50);

    const ana = resumen.estudiantes.find((e) => e.usuario_id === 10);
    expect(ana.tareas_calificadas).toBe(2);
    expect(ana.nota_final).toBe(37.5);
    expect(ana.detalle).toEqual([
      { tarea_id: 1, tarea_titulo: 'T1', nota: 10, valor_tarea: 25, nota_sobre_50: 25 },
      { tarea_id: 2, tarea_titulo: 'T2', nota: 5, valor_tarea: 25, nota_sobre_50: 12.5 }
    ]);

    const beto = resumen.estudiantes.find((e) => e.usuario_id === 11);
    expect(beto.tareas_calificadas).toBe(0);
    expect(beto.nota_final).toBe(0);
  });

  test('no revienta si la materia todavia no tiene tareas', async () => {
    materiasService.esDocenteDeMateria.mockResolvedValue(true);
    notasRepository.listarPorMateria.mockResolvedValue([]);

    const resumen = await notasService.listarPorMateria(5, PROFESOR);

    expect(resumen.total_tareas).toBe(0);
    expect(resumen.valor_tarea).toBe(0);
    expect(resumen.estudiantes).toEqual([]);
  });
});

describe('notasService.misNotas', () => {
  test('rechaza si la materia no es visible para el usuario efectivo', async () => {
    usuariosService.usuarioEfectivo.mockResolvedValue(10);
    materiasService.esVisiblePara.mockResolvedValue(false);

    await expect(notasService.misNotas(5, { id: 10, rol: 'estudiante' })).rejects.toMatchObject({
      status: 403
    });
  });

  test('devuelve solo el resumen del estudiante efectivo', async () => {
    usuariosService.usuarioEfectivo.mockResolvedValue(10);
    materiasService.esVisiblePara.mockResolvedValue(true);
    notasRepository.listarPorMateria.mockResolvedValue([
      { usuario_id: 10, estudiante_nombre: 'Ana', estudiante_correo: 'ana@x.com', tarea_id: 1, tarea_titulo: 'T1', nota: 8 },
      { usuario_id: 11, estudiante_nombre: 'Beto', estudiante_correo: 'beto@x.com', tarea_id: 1, tarea_titulo: 'T1', nota: 4 }
    ]);

    const propio = await notasService.misNotas(5, { id: 99, rol: 'admin' }, '10');

    expect(usuariosService.usuarioEfectivo).toHaveBeenCalledWith({ id: 99, rol: 'admin' }, '10');
    expect(propio.usuario_id).toBe(10);
    expect(propio.nota_final).toBe(40);
    expect(propio.detalle).toHaveLength(1);
  });

  test('devuelve un resumen vacio si el estudiante aun no tiene tareas calificadas en la materia', async () => {
    usuariosService.usuarioEfectivo.mockResolvedValue(10);
    materiasService.esVisiblePara.mockResolvedValue(true);
    notasRepository.listarPorMateria.mockResolvedValue([]);

    const propio = await notasService.misNotas(5, { id: 10, rol: 'estudiante' });

    expect(propio.usuario_id).toBe(10);
    expect(propio.nota_final).toBe(0);
    expect(propio.detalle).toEqual([]);
  });
});
