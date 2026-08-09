const tareasService = require('../services/tareas.service');
const controlador = require('../utils/controlador');

const listar = controlador('Error al obtener las tareas', async (req, res) => {
  const tareas = await tareasService.listar(req.usuario, req.query.materia_id, req.query.como);
  res.json(tareas);
});

const estadisticas = controlador('Error al obtener estadísticas', async (req, res) => {
  const datos = await tareasService.estadisticas(req.usuario, req.query.materia_id, req.query.como);
  res.json(datos);
});

const obtenerDetalle = controlador('Error al obtener la tarea', async (req, res) => {
  const tarea = await tareasService.obtenerDetalle(req.params.id, req.usuario, req.query.como);
  res.json(tarea);
});

const crear = controlador('Error al crear la tarea', async (req, res) => {
  const { titulo, descripcion, prioridad, fecha_limite, materia_id } = req.body;
  const tarea = await tareasService.crear(
    { titulo, descripcion, prioridad, fechaLimite: fecha_limite, materiaId: materia_id },
    req.usuario
  );
  res.status(201).json(tarea);
});

const actualizar = controlador('Error al actualizar la tarea', async (req, res) => {
  const { titulo, descripcion, completada, prioridad, fecha_limite, materia_id } = req.body;
  const tarea = await tareasService.actualizar(
    req.params.id,
    { titulo, descripcion, completada, prioridad, fechaLimite: fecha_limite, materiaId: materia_id },
    req.usuario
  );
  res.json(tarea);
});

const eliminar = controlador('Error al eliminar la tarea', async (req, res) => {
  await tareasService.eliminar(req.params.id, req.usuario);
  res.json({ message: 'Tarea eliminada' });
});

const eliminarCompletadas = controlador('Error al eliminar las tareas completadas', async (req, res) => {
  const eliminadas = await tareasService.eliminarCompletadas(req.usuario, req.query.materia_id, req.query.como);
  res.json({ eliminadas });
});

const registro = controlador('Error al obtener el registro de entregas', async (req, res) => {
  const registro = await tareasService.registro(req.params.id, req.usuario);
  res.json(registro);
});

const guardarNota = controlador('Error al guardar la nota', async (req, res) => {
  const { usuario_id, nota, comentario } = req.body;
  const notaGuardada = await tareasService.guardarNota(
    req.params.id,
    { usuarioId: usuario_id, nota, comentario },
    req.usuario
  );
  res.json(notaGuardada);
});

module.exports = {
  listar,
  estadisticas,
  obtenerDetalle,
  crear,
  actualizar,
  eliminar,
  eliminarCompletadas,
  registro,
  guardarNota
};
