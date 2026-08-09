const adminRepository = require('../repositories/admin.repository');
const usuariosService = require('./usuarios.service');

async function estadisticas() {
  const [usuarios, materias, tareas, porMateria] = await Promise.all([
    usuariosService.conteoPorRol(),
    adminRepository.totalMaterias(),
    adminRepository.totalesTareas(),
    adminRepository.tareasPorMateria()
  ]);

  return { usuarios, materias, tareas, por_materia: porMateria };
}

module.exports = { estadisticas };
