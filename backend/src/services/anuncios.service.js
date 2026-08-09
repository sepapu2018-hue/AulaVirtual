const anunciosRepository = require('../repositories/anuncios.repository');
const materiasService = require('./materias.service');
const usuariosService = require('./usuarios.service');
const HttpError = require('../utils/httpError');

async function listar(materiaId, usuario, comoId) {
  const usuarioId = await usuariosService.usuarioEfectivo(usuario, comoId);
  if (!(await materiasService.esVisiblePara(materiaId, usuarioId))) {
    throw new HttpError(404, 'Materia no encontrada');
  }
  return anunciosRepository.listarPorMateria(materiaId);
}

async function crear(materiaId, contenido, usuario) {
  if (!contenido || !contenido.trim()) {
    throw new HttpError(400, 'El contenido del anuncio es obligatorio');
  }
  if (!(await materiasService.esDocenteDeMateria(materiaId, usuario))) {
    throw new HttpError(403, 'No tienes permiso para publicar anuncios en esta materia');
  }
  return anunciosRepository.crear(materiaId, contenido.trim());
}

async function eliminar(anuncioId, usuario) {
  const anuncio = await anunciosRepository.buscarPorId(anuncioId);
  if (!anuncio) throw new HttpError(404, 'Anuncio no encontrado');
  if (!(await materiasService.esDocenteDeMateria(anuncio.materia_id, usuario))) {
    throw new HttpError(403, 'No tienes permiso para eliminar este anuncio');
  }
  await anunciosRepository.eliminar(anuncioId);
}

module.exports = { listar, crear, eliminar };
