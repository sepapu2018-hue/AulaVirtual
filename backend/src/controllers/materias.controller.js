const materiasService = require('../services/materias.service');
const controlador = require('../utils/controlador');

const listar = controlador('Error al obtener las materias', async (req, res) => {
  const materias = await materiasService.listar(req.usuario, req.query.como);
  res.json(materias);
});

const crear = controlador('Error al crear la materia', async (req, res) => {
  const materia = await materiasService.crear(
    { nombre: req.body.nombre, profesorId: req.body.profesor_id },
    req.usuario
  );
  res.status(201).json(materia);
});

const reordenar = controlador('Error al reordenar las materias', async (req, res) => {
  await materiasService.reordenar(req.body.orden, req.usuario, req.query.como);
  res.json({ message: 'Orden actualizado' });
});

const actualizar = controlador('Error al actualizar la materia', async (req, res) => {
  const materia = await materiasService.actualizar(
    req.params.id,
    { nombre: req.body.nombre, profesorId: req.body.profesor_id },
    req.usuario
  );
  res.json(materia);
});

const eliminar = controlador('Error al eliminar la materia', async (req, res) => {
  await materiasService.eliminar(req.params.id, req.usuario);
  res.json({ message: 'Materia eliminada' });
});

const listarEstudiantes = controlador('Error al obtener los estudiantes inscritos', async (req, res) => {
  const estudiantes = await materiasService.listarEstudiantes(req.params.id, req.usuario);
  res.json(estudiantes);
});

const inscribirEstudiante = controlador('Error al inscribir al estudiante', async (req, res) => {
  const estudiante = await materiasService.inscribirEstudiante(req.params.id, req.body.usuario_id);
  res.status(201).json(estudiante);
});

const desinscribirEstudiante = controlador('Error al desinscribir al estudiante', async (req, res) => {
  await materiasService.desinscribirEstudiante(req.params.id, req.params.usuarioId);
  res.json({ message: 'Estudiante desinscrito' });
});

module.exports = {
  listar,
  crear,
  reordenar,
  actualizar,
  eliminar,
  listarEstudiantes,
  inscribirEstudiante,
  desinscribirEstudiante
};
