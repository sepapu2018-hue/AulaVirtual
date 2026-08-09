jest.mock('../../../src/repositories/admin.repository');
jest.mock('../../../src/services/usuarios.service');

const adminRepository = require('../../../src/repositories/admin.repository');
const usuariosService = require('../../../src/services/usuarios.service');
const adminService = require('../../../src/services/admin.service');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('adminService.estadisticas', () => {
  test('combina el conteo de usuarios, materias y tareas en un solo objeto', async () => {
    usuariosService.conteoPorRol.mockResolvedValue({ admin: 1, profesor: 2, estudiante: 10 });
    adminRepository.totalMaterias.mockResolvedValue(4);
    adminRepository.totalesTareas.mockResolvedValue({ total: 20, completadas: 8, pendientes: 12 });
    adminRepository.tareasPorMateria.mockResolvedValue([{ id: 1, nombre: 'Cálculo', completadas: 3, pendientes: 1 }]);

    const resultado = await adminService.estadisticas();

    expect(resultado).toEqual({
      usuarios: { admin: 1, profesor: 2, estudiante: 10 },
      materias: 4,
      tareas: { total: 20, completadas: 8, pendientes: 12 },
      por_materia: [{ id: 1, nombre: 'Cálculo', completadas: 3, pendientes: 1 }]
    });
  });
});
