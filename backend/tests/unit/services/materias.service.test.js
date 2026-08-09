jest.mock('../../../src/repositories/materias.repository');
jest.mock('../../../src/repositories/inscripciones.repository');
jest.mock('../../../src/services/usuarios.service');

const materiasRepository = require('../../../src/repositories/materias.repository');
const inscripcionesRepository = require('../../../src/repositories/inscripciones.repository');
const usuariosService = require('../../../src/services/usuarios.service');
const materiasService = require('../../../src/services/materias.service');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('materiasService.esDocenteDeMateria', () => {
  test('el admin siempre es docente de cualquier materia', async () => {
    const resultado = await materiasService.esDocenteDeMateria(1, { id: 1, rol: 'admin' });
    expect(resultado).toBe(true);
    expect(materiasRepository.esProfesorAsignado).not.toHaveBeenCalled();
  });

  test('un estudiante nunca es docente', async () => {
    const resultado = await materiasService.esDocenteDeMateria(1, { id: 1, rol: 'estudiante' });
    expect(resultado).toBe(false);
  });

  test('un profesor solo es docente si tiene la materia asignada', async () => {
    materiasRepository.esProfesorAsignado.mockResolvedValue(true);
    const resultado = await materiasService.esDocenteDeMateria(5, { id: 9, rol: 'profesor' });
    expect(resultado).toBe(true);
    expect(materiasRepository.esProfesorAsignado).toHaveBeenCalledWith(5, 9);
  });

  test('un profesor sin la materia asignada no es docente de ella', async () => {
    materiasRepository.esProfesorAsignado.mockResolvedValue(false);
    const resultado = await materiasService.esDocenteDeMateria(5, { id: 9, rol: 'profesor' });
    expect(resultado).toBe(false);
  });
});

describe('materiasService.esVisiblePara', () => {
  test('delega en el repositorio', async () => {
    materiasRepository.esVisiblePara.mockResolvedValue(true);
    await expect(materiasService.esVisiblePara(1, 2)).resolves.toBe(true);
    expect(materiasRepository.esVisiblePara).toHaveBeenCalledWith(1, 2);
  });
});

describe('materiasService.listar', () => {
  test('resuelve el usuario efectivo y devuelve las materias visibles', async () => {
    usuariosService.usuarioEfectivo.mockResolvedValue(7);
    materiasRepository.listarVisiblesPorUsuario.mockResolvedValue([{ id: 1 }]);

    const materias = await materiasService.listar({ id: 1, rol: 'admin' }, 7);

    expect(usuariosService.usuarioEfectivo).toHaveBeenCalledWith({ id: 1, rol: 'admin' }, 7);
    expect(materiasRepository.listarVisiblesPorUsuario).toHaveBeenCalledWith(7);
    expect(materias).toEqual([{ id: 1 }]);
  });
});

describe('materiasService.crear', () => {
  const admin = { id: 1, rol: 'admin' };

  test('exige nombre', async () => {
    await expect(materiasService.crear({ nombre: '', profesorId: 3 }, admin)).rejects.toMatchObject({
      status: 400,
      message: 'El nombre de la materia es obligatorio'
    });
  });

  test('exige profesor asignado', async () => {
    await expect(materiasService.crear({ nombre: 'Cálculo', profesorId: null }, admin)).rejects.toMatchObject({
      status: 400,
      message: 'Debes asignar un profesor a la materia'
    });
  });

  test('rechaza un profesor que no existe o no tiene ese rol', async () => {
    usuariosService.esProfesorValido.mockResolvedValue(false);
    await expect(materiasService.crear({ nombre: 'Cálculo', profesorId: 3 }, admin)).rejects.toMatchObject({
      status: 400,
      message: 'El profesor seleccionado no es válido'
    });
  });

  test('crea la materia en el siguiente orden disponible', async () => {
    usuariosService.esProfesorValido.mockResolvedValue(true);
    materiasRepository.siguienteOrden.mockResolvedValue(4);
    materiasRepository.crear.mockResolvedValue({ id: 10, nombre: 'Cálculo', orden: 4 });

    const materia = await materiasService.crear({ nombre: 'Cálculo', profesorId: 3 }, admin);

    expect(materiasRepository.crear).toHaveBeenCalledWith({ usuarioId: 1, profesorId: 3, nombre: 'Cálculo', orden: 4 });
    expect(materia.id).toBe(10);
  });
});

describe('materiasService.reordenar', () => {
  test('exige un arreglo de ids no vacío', async () => {
    await expect(materiasService.reordenar([], { id: 1, rol: 'admin' })).rejects.toMatchObject({ status: 400 });
    await expect(materiasService.reordenar('no-array', { id: 1, rol: 'admin' })).rejects.toMatchObject({ status: 400 });
  });

  test('solo actualiza el orden de las materias visibles para el usuario', async () => {
    usuariosService.usuarioEfectivo.mockResolvedValue(1);
    materiasRepository.esVisiblePara.mockImplementation(async (id) => id !== 99);

    await materiasService.reordenar([10, 99, 20], { id: 1, rol: 'admin' }, undefined);

    expect(materiasRepository.actualizarOrden).toHaveBeenCalledWith(10, 1);
    expect(materiasRepository.actualizarOrden).toHaveBeenCalledWith(20, 3);
    expect(materiasRepository.actualizarOrden).not.toHaveBeenCalledWith(99, expect.anything());
  });
});

describe('materiasService.actualizar', () => {
  test('rechaza un profesor inválido', async () => {
    usuariosService.esProfesorValido.mockResolvedValue(false);

    await expect(
      materiasService.actualizar(1, { nombre: 'X', profesorId: 99 }, { id: 1, rol: 'admin' })
    ).rejects.toMatchObject({ status: 400, message: 'El profesor seleccionado no es válido' });
  });

  test('lanza 404 si la materia no existe o no le pertenece al usuario', async () => {
    usuariosService.esProfesorValido.mockResolvedValue(true);
    materiasRepository.actualizar.mockResolvedValue(null);

    await expect(
      materiasService.actualizar(1, { nombre: 'X', profesorId: 2 }, { id: 1, rol: 'admin' })
    ).rejects.toMatchObject({ status: 404, message: 'Materia no encontrada' });
  });

  test('actualiza correctamente cuando el profesor es válido y la materia existe', async () => {
    usuariosService.esProfesorValido.mockResolvedValue(true);
    materiasRepository.actualizar.mockResolvedValue({ id: 1, nombre: 'X', profesor_id: 2 });

    const materia = await materiasService.actualizar(1, { nombre: 'X', profesorId: 2 }, { id: 1, rol: 'admin' });

    expect(materia).toEqual({ id: 1, nombre: 'X', profesor_id: 2 });
  });
});

describe('materiasService.eliminar', () => {
  test('lanza 404 si no encuentra la materia del usuario', async () => {
    materiasRepository.eliminar.mockResolvedValue(null);
    await expect(materiasService.eliminar(1, { id: 1 })).rejects.toMatchObject({ status: 404 });
  });
});

describe('materiasService.listarEstudiantes', () => {
  test('rechaza si el usuario no es docente de la materia', async () => {
    await expect(
      materiasService.listarEstudiantes(1, { id: 1, rol: 'estudiante' })
    ).rejects.toMatchObject({ status: 403, message: 'No tienes permiso para ver los estudiantes de esta materia' });
  });

  test('devuelve la lista si el usuario es docente', async () => {
    inscripcionesRepository.listarEstudiantesDeMateria.mockResolvedValue([{ id: 1 }]);
    const estudiantes = await materiasService.listarEstudiantes(1, { id: 1, rol: 'admin' });
    expect(estudiantes).toEqual([{ id: 1 }]);
  });
});

describe('materiasService.inscribirEstudiante', () => {
  test('exige usuario_id', async () => {
    await expect(materiasService.inscribirEstudiante(1, undefined)).rejects.toMatchObject({ status: 400 });
  });

  test('404 si la materia no existe', async () => {
    materiasRepository.buscarPorId.mockResolvedValue(null);
    await expect(materiasService.inscribirEstudiante(1, 5)).rejects.toMatchObject({
      status: 404,
      message: 'Materia no encontrada'
    });
  });

  test('404 si el estudiante no existe o no tiene ese rol', async () => {
    materiasRepository.buscarPorId.mockResolvedValue({ id: 1 });
    usuariosService.buscarEstudianteValido.mockResolvedValue(null);

    await expect(materiasService.inscribirEstudiante(1, 5)).rejects.toMatchObject({
      status: 404,
      message: 'Estudiante no encontrado'
    });
  });

  test('inscribe correctamente y evita inscripción duplicada delegando en el repositorio', async () => {
    materiasRepository.buscarPorId.mockResolvedValue({ id: 1 });
    usuariosService.buscarEstudianteValido.mockResolvedValue({ id: 5, nombre: 'Ana' });

    const estudiante = await materiasService.inscribirEstudiante(1, 5);

    expect(inscripcionesRepository.inscribir).toHaveBeenCalledWith(1, 5);
    expect(estudiante).toEqual({ id: 5, nombre: 'Ana' });
  });
});

describe('materiasService.desinscribirEstudiante', () => {
  test('404 si el estudiante no estaba inscrito', async () => {
    inscripcionesRepository.desinscribir.mockResolvedValue(null);
    await expect(materiasService.desinscribirEstudiante(1, 5)).rejects.toMatchObject({
      status: 404,
      message: 'El estudiante no estaba inscrito'
    });
  });
});
