const API_URL = '/api/tareas';
const API_URL_MATERIAS = '/api/materias';
const API_URL_AUTH = '/api/auth';
const API_URL_USUARIOS = '/api/usuarios';

const _fetchNativo = window.fetch.bind(window);
window.fetch = function (url, opciones = {}) {
  const token = localStorage.getItem('gt_token');
  let urlFinal = url;
  if (viendoComoAdmin && typeof url === 'string' && /^\/api\/(materias|tareas|anuncios)/.test(url)) {
    urlFinal += (url.includes('?') ? '&' : '?') + `como=${viendoComoAdmin.id}`;
  }
  const opcionesFinales = token
    ? { ...opciones, headers: { ...(opciones.headers || {}), 'Authorization': `Bearer ${token}` } }
    : opciones;
  return _fetchNativo(urlFinal, opcionesFinales).then((res) => {
    if (res.status === 401 && !String(url).endsWith('/api/auth/login')) {
      cerrarSesion();
    }
    return res;
  });
};

function guardarSesion(token, usuario) {
  localStorage.setItem('gt_token', token);
  localStorage.setItem('gt_usuario', JSON.stringify(usuario));
}

function obtenerSesion() {
  const token = localStorage.getItem('gt_token');
  const usuarioRaw = localStorage.getItem('gt_usuario');
  if (!token || !usuarioRaw) return null;
  try {
    return { token, usuario: JSON.parse(usuarioRaw) };
  } catch (e) {
    return null;
  }
}

function mostrarLogin() {
  document.getElementById('vista-login').style.display = 'flex';
  document.getElementById('topbar').style.display = 'none';
  document.getElementById('vista-materias').style.display = 'none';
  document.getElementById('vista-tareas').style.display = 'none';
}

function cerrarSesion() {
  localStorage.removeItem('gt_token');
  localStorage.removeItem('gt_usuario');
  materiaActual = null;
  viendoComoAdmin = null;
  document.getElementById('banner-admin').style.display = 'none';
  mostrarLogin();
}

function iniciarApp(usuario) {
  usuarioActual = usuario;
  viendoComoAdmin = null;
  document.getElementById('banner-admin').style.display = 'none';
  document.getElementById('vista-login').style.display = 'none';
  document.getElementById('topbar').style.display = '';
  document.getElementById('sesion-nombre').textContent = usuario.nombre;
  document.getElementById('sesion-avatar').textContent = usuario.nombre.trim().slice(0, 2).toUpperCase();
  document.getElementById('btn-gestionar-estudiantes').style.display = usuario.rol === 'admin' ? '' : 'none';
  document.getElementById('form-anuncio').style.display = usuario.rol === 'admin' ? '' : 'none';
  document.getElementById('btn-nueva-materia').style.display = usuario.rol === 'admin' ? '' : 'none';
  mostrarVista('materias');
  cargarMaterias();
  cargarResumenGlobal();
  cargarPendientesGlobal();
  notificarTareasProximas();
}

async function notificarTareasProximas() {
  try {
    const res = await fetch(API_URL);
    const tareas = await res.json();
    const hoy = fechaLocalHoy();
    const finSemana = fechaLocalEnDias(7);
    const pendientes = tareas.filter(t => !t.completada && t.fecha_limite);
    const hoyCount = pendientes.filter(t => t.fecha_limite.split('T')[0] === hoy).length;
    const semanaCount = pendientes.filter(t => {
      const f = t.fecha_limite.split('T')[0];
      return f > hoy && f <= finSemana;
    }).length;

    if (hoyCount === 0 && semanaCount === 0) return;
    const partes = [];
    if (hoyCount > 0) partes.push(`${hoyCount} tarea(s) vencen hoy`);
    if (semanaCount > 0) partes.push(`${semanaCount} vencen esta semana`);
    mostrarToast(partes.join(' · '), hoyCount > 0 ? 'error' : 'exito');
  } catch (err) {
    /* si falla, simplemente no se muestra la notificacion */
  }
}

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const correo = document.getElementById('login-correo').value.trim();
  const password = document.getElementById('login-password').value;
  const btnTexto = document.getElementById('login-btn-texto');
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  btnTexto.textContent = 'Ingresando...';
  try {
    const res = await fetch(`${API_URL_AUTH}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'No se pudo iniciar sesión';
      btnTexto.textContent = 'Iniciar sesión';
      return;
    }
    guardarSesion(data.token, data.usuario);
    iniciarApp(data.usuario);
  } catch (err) {
    errorEl.textContent = 'Error de conexión con el servidor';
    btnTexto.textContent = 'Iniciar sesión';
  }
});

document.getElementById('btn-cerrar-sesion').addEventListener('click', cerrarSesion);
const PALETA_MATERIAS = ['#1e3a5f', '#2f6690', '#3f6f52', '#6b4e71', '#8a5a12', '#475569'];

const ICONO_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const ICONO_LAPIZ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const ICONO_BASURA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
const ICONO_RELOJ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
const ICONO_CALENDARIO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const ICONO_INBOX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>';
const ICONO_EXITO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
const ICONO_ALERTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
const ICONO_CLIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
const ICONO_ARCHIVO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
const ICONO_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const ICONO_USUARIO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
const ICONO_MEGAFONO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>';
const ICONO_OJO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICONO_ARRASTRE = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';

const API_URL_ANUNCIOS = '/api/materias';

const ETIQUETAS_PRIORIDAD = { alta: 'Alta', media: 'Media', baja: 'Baja' };

const PESO_PRIORIDAD = { alta: 0, media: 1, baja: 2 };

let accionEliminar = null;
let todasLasTareas = [];
let filtroActivo = 'todas';
let textoBusqueda = '';
let ordenActivo = 'reciente';

let materiaActual = null;
let todasLasMaterias = [];
let textoBusquedaMaterias = '';

let todosLosEstudiantes = [];
let textoBusquedaUsuarios = '';
let viendoComoAdmin = null;
let usuarioActual = null;

function colorMateria(id) {
  return PALETA_MATERIAS[id % PALETA_MATERIAS.length];
}

async function cargarTareas() {
  if (!materiaActual) return;
  try {
    const res = await fetch(`${API_URL}?materia_id=${materiaActual}`);
    todasLasTareas = await res.json();
    aplicarFiltros();
    cargarEstadisticas();
    actualizarDetalleDesdeTareas();
  } catch (err) {
    document.getElementById('lista-tareas').innerHTML =
      `<div class="vacio">${ICONO_ALERTA}<p>No se pudo conectar con el backend.</p></div>`;
  }
}

async function cargarEstadisticas() {
  if (!materiaActual) return;
  try {
    const res = await fetch(`${API_URL}/estadisticas?materia_id=${materiaActual}`);
    const stats = await res.json();

    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-pendientes').textContent = stats.pendientes;
    document.getElementById('stat-completadas').textContent = stats.completadas;
    document.getElementById('stat-vencidas').textContent = stats.vencidas;

    const maxPrioridad = Math.max(1, stats.por_prioridad.alta, stats.por_prioridad.media, stats.por_prioridad.baja);
    ['alta', 'media', 'baja'].forEach(p => {
      const cantidad = stats.por_prioridad[p];
      document.getElementById(`barra-${p}`).style.width = `${(cantidad / maxPrioridad) * 100}%`;
      document.getElementById(`valor-${p}`).textContent = cantidad;
    });
  } catch (err) {
    /* si falla, los contadores simplemente no se actualizan */
  }
}

function aplicarFiltros() {
  let resultado = todasLasTareas;

  if (filtroActivo === 'pendientes') resultado = resultado.filter(t => !t.completada);
  if (filtroActivo === 'completadas') resultado = resultado.filter(t => t.completada);

  if (textoBusqueda.trim()) {
    const q = textoBusqueda.trim().toLowerCase();
    resultado = resultado.filter(t => t.titulo.toLowerCase().includes(q));
  }

  resultado = [...resultado].sort((a, b) => {
    if (ordenActivo === 'prioridad') {
      return PESO_PRIORIDAD[a.prioridad] - PESO_PRIORIDAD[b.prioridad];
    }
    if (ordenActivo === 'fecha_limite') {
      if (!a.fecha_limite && !b.fecha_limite) return 0;
      if (!a.fecha_limite) return 1;
      if (!b.fecha_limite) return -1;
      return a.fecha_limite.localeCompare(b.fecha_limite);
    }
    return b.id - a.id;
  });

  render(resultado);
}

function fechaLocalHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fechaLocalEnDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatearFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split('T')[0].split('-');
  return `${dia}/${mes}/${anio}`;
}

function render(tareas) {
  const lista = document.getElementById('lista-tareas');

  if (tareas.length === 0) {
    const mensaje = todasLasTareas.length === 0
      ? '¡Agrega la primera!'
      : 'No hay tareas que coincidan con el filtro.';
    lista.innerHTML = `<div class="vacio">${ICONO_INBOX}<p>${mensaje}</p></div>`;
    return;
  }

  const hoy = fechaLocalHoy();
  lista.innerHTML = '';
  tareas.forEach(t => {
    const prioridad = t.prioridad || 'media';
    const esAdmin = usuarioActual && usuarioActual.rol === 'admin';
    const tieneNota = t.mi_nota !== null && t.mi_nota !== undefined;
    const plazoVencido = t.fecha_limite && t.fecha_limite.split('T')[0] < hoy;
    const bloqueada = !esAdmin && (tieneNota || plazoVencido);

    const div = document.createElement('div');
    div.className = `tarea prioridad-${prioridad}` + (t.completada ? ' completada' : '');
    div.dataset.id = t.id;

    const vencida = t.fecha_limite && !t.completada && t.fecha_limite.split('T')[0] < hoy;

    div.innerHTML = `
      <span class="tarea-check" title="${t.completada ? 'Completada (archivo entregado)' : 'Pendiente de entrega'}">
        ${ICONO_CHECK}
      </span>
      <div class="tarea-info">
        <div class="tarea-header">
          <h3>${escapeHtml(t.titulo)}</h3>
          <span class="badge badge-${prioridad}">${ETIQUETAS_PRIORIDAD[prioridad] || prioridad}</span>
          ${tieneNota && !esAdmin ? `<span class="badge badge-calificada">${Number(t.mi_nota)}/10</span>` : ''}
          ${!tieneNota && plazoVencido && !esAdmin ? `<span class="badge badge-cerrada">Cerrada</span>` : ''}
        </div>
        ${t.descripcion ? `<p>${escapeHtml(t.descripcion)}</p>` : ''}
        <small>${ICONO_RELOJ} ${new Date(t.fecha_creacion).toLocaleString()}</small>
        ${t.fecha_limite ? `<small class="fecha-limite ${vencida ? 'vencida' : ''}">${ICONO_CALENDARIO} ${vencida ? 'Vencida el' : 'Vence'} ${formatearFecha(t.fecha_limite)}</small>` : ''}
        ${t.num_archivos > 0 ? `
          <div class="adjunto adjunto-chip">
            ${ICONO_ARCHIVO} <span>${t.num_archivos} archivo${t.num_archivos > 1 ? 's' : ''} adjunto${t.num_archivos > 1 ? 's' : ''}</span>
          </div>
        ` : ''}
      </div>
      <div class="tarea-acciones">
        ${bloqueada ? '' : `<button class="icon-btn" data-action="adjuntar" data-id="${t.id}" title="Adjuntar archivo">${ICONO_CLIP}</button>`}
        ${esAdmin ? `
          <button class="icon-btn icon-editar" data-action="editar" data-id="${t.id}" title="Editar">${ICONO_LAPIZ}</button>
          <button class="icon-btn icon-eliminar" data-action="eliminar" data-id="${t.id}" title="Eliminar">${ICONO_BASURA}</button>
        ` : ''}
      </div>
    `;
    lista.appendChild(div);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function mostrarToast(mensaje, tipo = 'exito') {
  const contenedor = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `${tipo === 'exito' ? ICONO_EXITO : ICONO_ALERTA}<span>${mensaje}</span>`;
  contenedor.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('saliendo');
    setTimeout(() => toast.remove(), 200);
  }, 2600);
}

document.getElementById('lista-tareas').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (btn) {
    const { action, id } = btn.dataset;
    if (action === 'editar') editarTarea(id);
    if (action === 'eliminar') pedirConfirmacionEliminar(id);
    if (action === 'adjuntar') abrirSelectorArchivo(id);
    return;
  }
  if (e.target.closest('a')) return;
  const card = e.target.closest('.tarea');
  if (card) abrirDetalle(card.dataset.id);
});

let idParaAdjuntar = null;
let origenAdjunto = 'directo';

function abrirSelectorArchivo(id) {
  idParaAdjuntar = id;
  origenAdjunto = 'directo';
  document.getElementById('input-archivo').click();
}

async function subirArchivo(id, archivo) {
  if (archivo.size > 5 * 1024 * 1024) {
    mostrarToast('El archivo supera el tamaño máximo permitido (5MB)', 'error');
    return;
  }
  const formData = new FormData();
  formData.append('archivo', archivo);

  try {
    const res = await fetch(`${API_URL}/${id}/archivo`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error();
    mostrarToast('Archivo adjuntado correctamente');
    await cargarTareas();
  } catch (err) {
    mostrarToast('No se pudo subir el archivo', 'error');
  }
}

document.getElementById('input-archivo').addEventListener('change', (e) => {
  const archivo = e.target.files[0];
  e.target.value = '';
  if (!archivo || !idParaAdjuntar) return;

  if (origenAdjunto === 'detalle') {
    seleccionarArchivoPendiente(archivo);
  } else {
    subirArchivo(idParaAdjuntar, archivo);
  }
  idParaAdjuntar = null;
});

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-filtro]');
  if (!btn) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('activa'));
  btn.classList.add('activa');
  filtroActivo = btn.dataset.filtro;
  aplicarFiltros();
});

document.getElementById('buscador').addEventListener('input', (e) => {
  textoBusqueda = e.target.value;
  aplicarFiltros();
});

document.getElementById('orden').addEventListener('change', (e) => {
  ordenActivo = e.target.value;
  aplicarFiltros();
});

document.getElementById('btn-refrescar').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  btn.classList.add('girando');
  cargarTareas().finally(() => {
    setTimeout(() => btn.classList.remove('girando'), 600);
  });
});

function imprimirTareas() {
  const titulo = document.getElementById('materia-titulo').textContent;
  document.getElementById('impresion-titulo').textContent = titulo;
  document.getElementById('impresion-fecha').textContent = new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });

  const hoy = fechaLocalHoy();
  const total = todasLasTareas.length;
  const completadas = todasLasTareas.filter(t => t.completada).length;
  const atrasadas = todasLasTareas.filter(t => !t.completada && t.fecha_limite && t.fecha_limite.split('T')[0] < hoy).length;
  const pendientes = total - completadas;

  document.getElementById('impresion-resumen').innerHTML = `
    <div class="stat"><strong>${total}</strong><span>Total</span></div>
    <div class="stat"><strong>${pendientes}</strong><span>Pendientes</span></div>
    <div class="stat"><strong>${completadas}</strong><span>Completadas</span></div>
    <div class="stat"><strong>${atrasadas}</strong><span>Atrasadas</span></div>
  `;

  document.getElementById('impresion-tbody').innerHTML = todasLasTareas.map(t => {
    const prioridad = t.prioridad || 'media';
    let estadoTexto = 'Pendiente';
    let estadoClase = 'pendiente';
    if (t.completada) {
      estadoTexto = 'Completada';
      estadoClase = 'completada';
    } else if (t.fecha_limite && t.fecha_limite.split('T')[0] < hoy) {
      estadoTexto = 'Atrasada';
      estadoClase = 'atrasada';
    }
    return `
      <tr>
        <td>${escapeHtml(t.titulo)}</td>
        <td><span class="imp-badge imp-badge-${prioridad}">${ETIQUETAS_PRIORIDAD[prioridad] || prioridad}</span></td>
        <td>${t.fecha_limite ? formatearFecha(t.fecha_limite) : '—'}</td>
        <td><span class="imp-estado imp-estado-${estadoClase}">${estadoTexto}</span></td>
      </tr>
    `;
  }).join('');

  window.print();
}

document.getElementById('btn-imprimir').addEventListener('click', imprimirTareas);

const fechaHoyEl = document.getElementById('fecha-hoy');
if (fechaHoyEl) {
  fechaHoyEl.textContent = new Date().toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

document.getElementById('form-tarea').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('tarea-id').value;
  const titulo = document.getElementById('titulo').value.trim();
  const descripcion = document.getElementById('descripcion').value.trim();
  const prioridad = document.getElementById('prioridad').value;
  const fecha_limite = document.getElementById('fecha_limite').value || null;
  const completada = document.getElementById('tarea-completada').value === 'true';

  if (!titulo) return;

  try {
    if (id) {
      await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, descripcion, completada, prioridad, fecha_limite, materia_id: materiaActual })
      });
      mostrarToast('Tarea actualizada correctamente');
    } else {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, descripcion, prioridad, fecha_limite, materia_id: materiaActual })
      });
      mostrarToast('Tarea creada correctamente');
    }
    resetForm();
    cargarTareas();
  } catch (err) {
    mostrarToast('Ocurrió un error, intenta de nuevo', 'error');
  }
});

async function editarTarea(id) {
  const res = await fetch(`${API_URL}/${id}`);
  const t = await res.json();
  document.getElementById('tarea-id').value = t.id;
  document.getElementById('titulo').value = t.titulo;
  document.getElementById('descripcion').value = t.descripcion || '';
  document.getElementById('prioridad').value = t.prioridad || 'media';
  document.getElementById('fecha_limite').value = t.fecha_limite ? t.fecha_limite.split('T')[0] : '';
  document.getElementById('tarea-completada').value = t.completada;
  document.getElementById('btn-submit-texto').textContent = 'Actualizar Tarea';
  document.getElementById('titulo').focus();
}

function pedirConfirmacionEliminar(id) {
  accionEliminar = { tipo: 'tarea', id };
  document.getElementById('modal-titulo').textContent = '¿Eliminar esta tarea?';
  document.getElementById('modal-texto').textContent = 'Esta acción no se puede deshacer.';
  document.getElementById('modal-overlay').classList.add('visible');
}

function pedirConfirmacionVaciar() {
  const completadas = todasLasTareas.filter(t => t.completada).length;
  if (completadas === 0) {
    mostrarToast('No hay tareas completadas para eliminar', 'error');
    return;
  }
  accionEliminar = { tipo: 'completadas' };
  document.getElementById('modal-titulo').textContent = '¿Vaciar tareas completadas?';
  document.getElementById('modal-texto').textContent = `Se eliminarán ${completadas} tarea(s) marcadas como completadas. Esta acción no se puede deshacer.`;
  document.getElementById('modal-overlay').classList.add('visible');
}

function cerrarModal() {
  document.getElementById('modal-overlay').classList.remove('visible');
  accionEliminar = null;
}

document.getElementById('modal-cancelar').addEventListener('click', cerrarModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') cerrarModal();
});

document.getElementById('btn-vaciar-completadas').addEventListener('click', pedirConfirmacionVaciar);

document.getElementById('modal-confirmar').addEventListener('click', async () => {
  const accion = accionEliminar;
  if (!accion) return;
  cerrarModal();

  if (accion.tipo === 'tarea') {
    const card = document.querySelector(`.tarea[data-id="${accion.id}"]`);
    if (card) card.classList.add('saliendo');
    await fetch(`${API_URL}/${accion.id}`, { method: 'DELETE' });
    mostrarToast('Tarea eliminada');
    setTimeout(cargarTareas, card ? 200 : 0);
  } else if (accion.tipo === 'completadas') {
    const res = await fetch(`${API_URL}/completadas?materia_id=${materiaActual}`, { method: 'DELETE' });
    const data = await res.json();
    mostrarToast(`${data.eliminadas} tarea(s) eliminada(s)`);
    cargarTareas();
  } else if (accion.tipo === 'materia') {
    await fetch(`${API_URL_MATERIAS}/${accion.id}`, { method: 'DELETE' });
    mostrarToast('Materia eliminada');
    cargarMaterias();
  } else if (accion.tipo === 'anuncio') {
    await fetch(`/api/anuncios/${accion.id}`, { method: 'DELETE' });
    mostrarToast('Anuncio eliminado');
    cargarAnuncios();
  } else if (accion.tipo === 'estudiante') {
    await fetch(`${API_URL_USUARIOS}/${accion.id}`, { method: 'DELETE' });
    mostrarToast('Cuenta eliminada');
    cargarEstudiantes();
  }
});

function abrirModalUsuarios() {
  document.getElementById('form-usuario').reset();
  document.getElementById('buscador-usuarios').value = '';
  textoBusquedaUsuarios = '';
  document.getElementById('usuarios-modal-overlay').classList.add('visible');
  cargarEstudiantes();
}

function cerrarModalUsuarios() {
  document.getElementById('usuarios-modal-overlay').classList.remove('visible');
}

async function cargarEstudiantes() {
  try {
    const res = await fetch(API_URL_USUARIOS);
    todosLosEstudiantes = await res.json();
    renderEstudiantes();
  } catch (err) {
    document.getElementById('lista-usuarios').innerHTML = '<div class="usuarios-vacio">No se pudo cargar la lista.</div>';
  }
}

document.getElementById('buscador-usuarios').addEventListener('input', (e) => {
  textoBusquedaUsuarios = e.target.value;
  renderEstudiantes();
});

function renderEstudiantes() {
  const cont = document.getElementById('lista-usuarios');
  const q = textoBusquedaUsuarios.trim().toLowerCase();
  const estudiantes = q
    ? todosLosEstudiantes.filter(u => u.nombre.toLowerCase().includes(q) || u.correo.toLowerCase().includes(q))
    : todosLosEstudiantes;

  if (!todosLosEstudiantes.length) {
    cont.innerHTML = '<div class="usuarios-vacio">Todavía no has creado ninguna cuenta de estudiante.</div>';
    return;
  }
  if (!estudiantes.length) {
    cont.innerHTML = '<div class="usuarios-vacio">Ningún estudiante coincide con la búsqueda.</div>';
    return;
  }
  cont.innerHTML = estudiantes.map(u => `
    <div class="usuario-row">
      <span class="usuario-row-avatar">${escapeHtml(u.nombre.trim().slice(0, 2).toUpperCase())}</span>
      <div class="usuario-row-info">
        <strong>${escapeHtml(u.nombre)}</strong>
        <span>${escapeHtml(u.correo)}</span>
      </div>
      <button class="icon-btn" data-action="ver-aula" data-id="${u.id}" data-nombre="${escapeHtml(u.nombre)}" title="Ver su aula virtual">${ICONO_OJO}</button>
      <button class="icon-btn" data-action="eliminar-usuario" data-id="${u.id}" title="Eliminar cuenta">${ICONO_BASURA}</button>
    </div>
  `).join('');
}

document.getElementById('btn-gestionar-estudiantes').addEventListener('click', abrirModalUsuarios);
document.getElementById('usuarios-modal-cerrar').addEventListener('click', cerrarModalUsuarios);
document.getElementById('usuarios-modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'usuarios-modal-overlay') cerrarModalUsuarios();
});

document.getElementById('form-usuario').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('usuario-nombre').value.trim();
  const correo = document.getElementById('usuario-correo').value.trim();
  const password = document.getElementById('usuario-password').value;
  if (!nombre || !correo || !password) return;
  try {
    const res = await fetch(API_URL_USUARIOS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, correo, password })
    });
    const data = await res.json();
    if (!res.ok) {
      mostrarToast(data.error || 'No se pudo crear la cuenta', 'error');
      return;
    }
    mostrarToast('Cuenta creada correctamente');
    document.getElementById('form-usuario').reset();
    cargarEstudiantes();
  } catch (err) {
    mostrarToast('Ocurrió un error, intenta de nuevo', 'error');
  }
});

document.getElementById('lista-usuarios').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'ver-aula') {
    entrarModoAdmin(btn.dataset.id, btn.dataset.nombre);
    return;
  }
  if (btn.dataset.action === 'eliminar-usuario') {
    accionEliminar = { tipo: 'estudiante', id: btn.dataset.id };
    document.getElementById('modal-titulo').textContent = '¿Eliminar esta cuenta?';
    document.getElementById('modal-texto').textContent = 'Se eliminarán también todas sus materias y tareas. Esta acción no se puede deshacer.';
    document.getElementById('modal-overlay').classList.add('visible');
  }
});

function entrarModoAdmin(id, nombre) {
  viendoComoAdmin = { id, nombre };
  cerrarModalUsuarios();
  document.getElementById('banner-admin-nombre').textContent = nombre;
  document.getElementById('banner-admin').style.display = 'flex';
  materiaActual = null;
  mostrarVista('materias');
  cargarMaterias();
  cargarResumenGlobal();
  cargarPendientesGlobal();
  mostrarToast(`Ahora estás viendo el aula de ${nombre}`);
}

function salirModoAdmin() {
  viendoComoAdmin = null;
  document.getElementById('banner-admin').style.display = 'none';
  materiaActual = null;
  mostrarVista('materias');
  cargarMaterias();
  cargarResumenGlobal();
  cargarPendientesGlobal();
}

document.getElementById('btn-salir-modo-admin').addEventListener('click', salirModoAdmin);

function resetForm() {
  document.getElementById('form-tarea').reset();
  document.getElementById('tarea-id').value = '';
  document.getElementById('tarea-completada').value = 'false';
  document.getElementById('prioridad').value = 'media';
  document.getElementById('btn-submit-texto').textContent = 'Agregar Tarea';
}

document.getElementById('btn-cancelar').addEventListener('click', resetForm);

/* ---------- Pagina de detalle de tarea ---------- */

let idDetalleAbierto = null;

function abrirDetalle(id) {
  const t = todasLasTareas.find(x => String(x.id) === String(id));
  if (!t) return;
  idDetalleAbierto = id;
  pintarDetalle(t);
  document.getElementById('detalle-overlay').classList.add('visible');
  document.getElementById('detalle-seccion-registro').style.display =
    (usuarioActual && usuarioActual.rol === 'admin') ? '' : 'none';
  cargarDetalleArchivos(id);
  cargarComentarios(id);
}

function cerrarDetalle() {
  document.getElementById('detalle-overlay').classList.remove('visible');
  idDetalleAbierto = null;
  cancelarArchivoPendiente();
  document.getElementById('comentario-contenido').value = '';
}

function pintarDetalle(t) {
  const prioridad = t.prioridad || 'media';
  const badge = document.getElementById('detalle-badge');
  badge.className = `badge badge-${prioridad}`;
  badge.textContent = ETIQUETAS_PRIORIDAD[prioridad] || prioridad;

  document.getElementById('detalle-titulo').textContent = t.titulo;
  document.getElementById('detalle-descripcion').textContent = t.descripcion || 'Sin descripción.';
  document.getElementById('detalle-estado').textContent = t.completada ? '✓ Completada' : 'Pendiente';
  document.getElementById('detalle-fecha-limite').textContent = t.fecha_limite
    ? `Vence: ${formatearFecha(t.fecha_limite)}`
    : 'Sin fecha límite';

  if (t.archivos) renderDetalleArchivo(t);
  cancelarArchivoPendiente();
}

let entregaBloqueadaActual = false;

async function cargarDetalleArchivos(id) {
  try {
    const res = await fetch(`${API_URL}/${id}`);
    const t = await res.json();
    if (String(idDetalleAbierto) !== String(id)) return;
    const esAdmin = usuarioActual && usuarioActual.rol === 'admin';
    const tieneNota = t.mi_nota !== null && t.mi_nota !== undefined;
    const plazoVencido = t.fecha_limite && t.fecha_limite.split('T')[0] < fechaLocalHoy();
    entregaBloqueadaActual = !esAdmin && (tieneNota || plazoVencido);
    renderDetalleArchivo(t);
    renderMiNota(t.mi_nota);
    document.getElementById('dropzone').style.display = entregaBloqueadaActual ? 'none' : '';
    const msgBloqueo = document.getElementById('detalle-archivo-bloqueado');
    msgBloqueo.textContent = tieneNota
      ? 'Esta tarea ya fue calificada. No puedes modificar tu entrega.'
      : 'El plazo de entrega ya venció. No puedes modificar tu entrega.';
    msgBloqueo.style.display = entregaBloqueadaActual ? 'block' : 'none';
    if (usuarioActual && usuarioActual.rol === 'admin') cargarRegistro(id);
  } catch (err) {
    /* si falla, simplemente no se actualiza la lista de archivos */
  }
}

function renderMiNota(miNota) {
  const cont = document.getElementById('detalle-mi-nota');
  if (!miNota || miNota.nota === null || miNota.nota === undefined) {
    cont.style.display = 'none';
    return;
  }
  document.getElementById('detalle-mi-nota-valor').textContent = `${Number(miNota.nota)}/10`;
  document.getElementById('detalle-mi-nota-comentario').textContent = miNota.comentario || '';
  cont.style.display = 'flex';
}

function renderDetalleArchivo(t) {
  const cont = document.getElementById('detalle-archivo-actual');
  const archivos = t.archivos || [];
  if (!archivos.length) {
    cont.innerHTML = '';
    return;
  }
  cont.innerHTML = archivos.map(a => `
    <div class="adjunto adjunto-grande">
      <button type="button" class="adjunto-descarga" data-action="descargar-archivo" data-ruta="${a.ruta}" data-nombre="${escapeHtml(a.nombre_original)}">
        ${ICONO_ARCHIVO} <span>${escapeHtml(a.nombre_original)}</span>
      </button>
      ${a.usuario_nombre ? `<span class="adjunto-autor">${escapeHtml(a.usuario_nombre)}</span>` : ''}
      ${entregaBloqueadaActual ? '' : `<button class="adjunto-quitar" data-action="quitar-archivo" data-tarea-id="${t.id}" data-archivo-id="${a.id}" title="Quitar archivo">${ICONO_X}</button>`}
    </div>
  `).join('');
}

async function cargarComentarios(id) {
  try {
    const res = await fetch(`${API_URL}/${id}/comentarios`);
    const comentarios = await res.json();
    if (String(idDetalleAbierto) === String(id)) renderComentarios(comentarios);
  } catch (err) {
    /* si falla, simplemente no se actualizan los comentarios */
  }
}

function renderComentarios(comentarios) {
  const cont = document.getElementById('lista-comentarios');
  if (!comentarios.length) {
    cont.innerHTML = '<div class="comentario-vacio">Todavía no hay comentarios.</div>';
    return;
  }
  cont.innerHTML = comentarios.map(c => `
    <div class="comentario-item">
      <div class="comentario-item-cabecera">
        <strong>${escapeHtml(c.autor_nombre)}</strong>
        <span class="comentario-item-rol">${c.autor_rol === 'admin' ? 'Profesor' : 'Estudiante'}</span>
        <button class="icon-btn" data-action="eliminar-comentario" data-id="${c.id}" title="Eliminar comentario">${ICONO_X}</button>
      </div>
      <div class="comentario-item-texto">${escapeHtml(c.contenido)}</div>
      <div class="comentario-item-fecha">${formatearFechaHora(c.fecha_creacion)}</div>
    </div>
  `).join('');
}

document.getElementById('form-comentario').addEventListener('submit', async (e) => {
  e.preventDefault();
  const textarea = document.getElementById('comentario-contenido');
  const contenido = textarea.value.trim();
  if (!contenido || !idDetalleAbierto) return;
  try {
    await fetch(`${API_URL}/${idDetalleAbierto}/comentarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido })
    });
    textarea.value = '';
    cargarComentarios(idDetalleAbierto);
  } catch (err) {
    mostrarToast('No se pudo publicar el comentario', 'error');
  }
});

document.getElementById('lista-comentarios').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action="eliminar-comentario"]');
  if (!btn || !idDetalleAbierto) return;
  try {
    await fetch(`/api/comentarios/${btn.dataset.id}`, { method: 'DELETE' });
    cargarComentarios(idDetalleAbierto);
  } catch (err) {
    mostrarToast('No se pudo eliminar el comentario', 'error');
  }
});

/* ---------- Registro de entregas y calificacion (solo admin) ---------- */

async function cargarRegistro(id) {
  try {
    const res = await fetch(`${API_URL}/${id}/registro`);
    if (!res.ok) return;
    const filas = await res.json();
    if (String(idDetalleAbierto) === String(id)) renderRegistro(filas);
  } catch (err) {
    /* si falla, simplemente no se muestra el registro */
  }
}

function renderRegistro(filas) {
  const cont = document.getElementById('registro-entregas');
  if (!filas.length) {
    cont.innerHTML = '<div class="usuarios-vacio">No hay estudiantes en esta materia todavía.</div>';
    return;
  }
  cont.innerHTML = filas.map(f => `
    <div class="registro-fila" data-id="${f.usuario_id}">
      <div class="registro-fila-info">
        <strong>${escapeHtml(f.nombre)}</strong>
        <span class="registro-fila-estado ${f.num_archivos > 0 ? 'entregado' : 'pendiente'}">
          ${f.num_archivos > 0 ? `${ICONO_EXITO} Entregó (${f.num_archivos})` : `${ICONO_ALERTA} No ha entregado`}
        </span>
      </div>
      <div class="registro-fila-nota">
        <input type="number" min="0" max="10" step="0.1" placeholder="—" value="${f.nota !== null ? f.nota : ''}" class="registro-nota-input">
        <button type="button" class="btn-secondary registro-guardar-nota">Guardar</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('registro-entregas').addEventListener('click', async (e) => {
  const btn = e.target.closest('.registro-guardar-nota');
  if (!btn || !idDetalleAbierto) return;
  const fila = btn.closest('.registro-fila');
  const usuarioId = fila.dataset.id;
  const input = fila.querySelector('.registro-nota-input');
  const nota = input.value === '' ? null : Number(input.value);
  if (nota !== null && (nota < 0 || nota > 10)) {
    mostrarToast('La nota debe estar entre 0 y 10', 'error');
    return;
  }
  try {
    const res = await fetch(`${API_URL}/${idDetalleAbierto}/notas`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: usuarioId, nota })
    });
    if (!res.ok) throw new Error();
    mostrarToast('Nota guardada');
  } catch (err) {
    mostrarToast('No se pudo guardar la nota', 'error');
  }
});

function actualizarDetalleDesdeTareas() {
  if (!idDetalleAbierto) return;
  const t = todasLasTareas.find(x => String(x.id) === String(idDetalleAbierto));
  if (t) pintarDetalle(t);
  cargarDetalleArchivos(idDetalleAbierto);
}

document.getElementById('detalle-cerrar').addEventListener('click', cerrarDetalle);
document.getElementById('detalle-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'detalle-overlay') cerrarDetalle();
});

document.getElementById('detalle-panel').addEventListener('click', async (e) => {
  const btnDescarga = e.target.closest('button[data-action="descargar-archivo"]');
  if (btnDescarga) {
    try {
      const res = await fetch(`/api/archivos/${btnDescarga.dataset.ruta}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = btnDescarga.dataset.nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      mostrarToast('No se pudo descargar el archivo', 'error');
    }
    return;
  }

  const btn = e.target.closest('button[data-action="quitar-archivo"]');
  if (!btn) return;
  try {
    await fetch(`${API_URL}/${btn.dataset.tareaId}/archivo/${btn.dataset.archivoId}`, { method: 'DELETE' });
    mostrarToast('Archivo eliminado');
    await cargarTareas();
  } catch (err) {
    mostrarToast('No se pudo quitar el archivo', 'error');
  }
});

let archivoPendiente = null;

function seleccionarArchivoPendiente(archivo) {
  if (archivo.size > 5 * 1024 * 1024) {
    mostrarToast('El archivo supera el tamaño máximo permitido (5MB)', 'error');
    return;
  }
  archivoPendiente = archivo;
  document.getElementById('dropzone').style.display = 'none';
  document.getElementById('archivo-pendiente-nombre').textContent = archivo.name;
  document.getElementById('archivo-pendiente').classList.add('visible');
}

function cancelarArchivoPendiente() {
  archivoPendiente = null;
  document.getElementById('archivo-pendiente').classList.remove('visible');
  document.getElementById('dropzone').style.display = '';
  document.getElementById('archivo-pendiente-botones').style.display = 'flex';
  document.getElementById('progreso-mini').style.display = 'none';
  document.getElementById('archivo-listo').style.display = 'none';
  document.getElementById('progreso-mini-relleno').style.width = '0%';
  document.getElementById('progreso-mini-texto').textContent = '0%';
}

function subirArchivoConProgreso(id, archivo) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('archivo', archivo);

    const xhr = new XMLHttpRequest();
    const sufijoComo = viendoComoAdmin ? `?como=${viendoComoAdmin.id}` : '';
    xhr.open('POST', `${API_URL}/${id}/archivo${sufijoComo}`);
    const token = localStorage.getItem('gt_token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', (e) => {
      if (!e.lengthComputable) return;
      const porcentaje = Math.round((e.loaded / e.total) * 100);
      document.getElementById('progreso-mini-relleno').style.width = `${porcentaje}%`;
      document.getElementById('progreso-mini-texto').textContent = `${porcentaje}%`;
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error('upload failed'));
    };
    xhr.onerror = () => reject(new Error('network error'));

    xhr.send(formData);
  });
}

document.getElementById('btn-cancelar-archivo').addEventListener('click', cancelarArchivoPendiente);

document.getElementById('btn-guardar-archivo').addEventListener('click', async () => {
  if (!archivoPendiente || !idDetalleAbierto) return;
  const archivo = archivoPendiente;
  const id = idDetalleAbierto;

  document.getElementById('archivo-pendiente-botones').style.display = 'none';
  document.getElementById('progreso-mini').style.display = 'flex';
  document.getElementById('progreso-mini-relleno').style.width = '0%';
  document.getElementById('progreso-mini-texto').textContent = '0%';

  try {
    await subirArchivoConProgreso(id, archivo);
    await cargarTareas();
    // cargarTareas() repinta el detalle (pintarDetalle -> cancelarArchivoPendiente)
    // y reinicia esta tarjeta: la volvemos a poner en el estado "listo" despues,
    // para que se alcance a ver el mensaje de exito antes de volver a la zona de arrastre.
    document.getElementById('dropzone').style.display = 'none';
    document.getElementById('archivo-pendiente').classList.add('visible');
    document.getElementById('progreso-mini').style.display = 'none';
    document.getElementById('archivo-pendiente-botones').style.display = 'none';
    document.getElementById('archivo-listo').style.display = 'flex';
    setTimeout(() => {
      archivoPendiente = null;
      cancelarArchivoPendiente();
    }, 900);
  } catch (err) {
    document.getElementById('progreso-mini').style.display = 'none';
    document.getElementById('archivo-pendiente-botones').style.display = 'flex';
    mostrarToast('No se pudo subir el archivo', 'error');
  }
});

const dropzone = document.getElementById('dropzone');

dropzone.addEventListener('click', () => {
  if (!idDetalleAbierto) return;
  idParaAdjuntar = idDetalleAbierto;
  origenAdjunto = 'detalle';
  document.getElementById('input-archivo').click();
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (!idDetalleAbierto) return;
  const archivo = e.dataTransfer.files[0];
  if (archivo) seleccionarArchivoPendiente(archivo);
});

/* ---------- Vista: Mis Materias ---------- */

function mostrarVista(nombre) {
  document.getElementById('vista-materias').style.display = nombre === 'materias' ? '' : 'none';
  document.getElementById('vista-tareas').style.display = nombre === 'tareas' ? '' : 'none';
}

async function cargarMaterias() {
  try {
    const res = await fetch(API_URL_MATERIAS);
    todasLasMaterias = await res.json();
    renderMaterias();
  } catch (err) {
    document.getElementById('materias-grid').innerHTML =
      `<div class="vacio materia-vacio">${ICONO_ALERTA}<p>No se pudo conectar con el backend.</p></div>`;
  }
}

async function cargarResumenGlobal() {
  try {
    const res = await fetch(`${API_URL}/estadisticas`);
    const stats = await res.json();
    document.getElementById('resumen-total').textContent = stats.total;
    document.getElementById('resumen-pendientes').textContent = stats.pendientes;
    document.getElementById('resumen-atrasadas').textContent = stats.vencidas;
  } catch (err) {
    /* si falla, los contadores simplemente se quedan en 0 */
  }
}

let filtroFechaPendientes = 'todas';

async function cargarPendientesGlobal() {
  try {
    const res = await fetch(API_URL);
    const todas = await res.json();
    renderPendientesGlobal(todas.filter(t => !t.completada));
  } catch (err) {
    document.getElementById('lista-pendientes-global').innerHTML =
      `<div class="vacio">${ICONO_ALERTA}<p>No se pudo conectar con el backend.</p></div>`;
  }
}

function renderPendientesGlobal(tareas) {
  const hoy = fechaLocalHoy();
  const finSemanaStr = fechaLocalEnDias(7);

  let filtradas = tareas;
  if (filtroFechaPendientes === 'atrasadas') {
    filtradas = tareas.filter(t => t.fecha_limite && t.fecha_limite.split('T')[0] < hoy);
  } else if (filtroFechaPendientes === 'hoy') {
    filtradas = tareas.filter(t => t.fecha_limite && t.fecha_limite.split('T')[0] === hoy);
  } else if (filtroFechaPendientes === 'semana') {
    filtradas = tareas.filter(t => t.fecha_limite && t.fecha_limite.split('T')[0] >= hoy && t.fecha_limite.split('T')[0] <= finSemanaStr);
  }

  filtradas = [...filtradas].sort((a, b) => {
    if (!a.fecha_limite && !b.fecha_limite) return 0;
    if (!a.fecha_limite) return 1;
    if (!b.fecha_limite) return -1;
    return a.fecha_limite.localeCompare(b.fecha_limite);
  });

  const cont = document.getElementById('lista-pendientes-global');

  if (filtradas.length === 0) {
    cont.innerHTML = `<div class="vacio">${ICONO_INBOX}<p>No hay deberes pendientes con este filtro.</p></div>`;
    return;
  }

  cont.innerHTML = '';
  filtradas.forEach(t => {
    const prioridad = t.prioridad || 'media';
    const vencida = t.fecha_limite && t.fecha_limite.split('T')[0] < hoy;

    const row = document.createElement('div');
    row.className = 'pendiente-row';
    row.dataset.id = t.id;
    row.dataset.materia = t.materia_id || '';
    row.innerHTML = `
      <span class="badge badge-${prioridad}">${ETIQUETAS_PRIORIDAD[prioridad] || prioridad}</span>
      <div class="pendiente-row-info">
        <strong>${escapeHtml(t.titulo)}</strong>
        <span class="pendiente-row-materia">${escapeHtml(t.materia_nombre || 'Sin materia')}</span>
      </div>
      <span class="pendiente-row-fecha ${vencida ? 'vencida' : ''}">${t.fecha_limite ? formatearFecha(t.fecha_limite) : 'Sin fecha'}</span>
    `;
    cont.appendChild(row);
  });
}

document.getElementById('lista-pendientes-global').addEventListener('click', (e) => {
  const row = e.target.closest('.pendiente-row');
  if (!row) return;
  irATarea(row.dataset.materia, row.dataset.id);
});

document.getElementById('filtro-fecha-pendientes').addEventListener('change', (e) => {
  filtroFechaPendientes = e.target.value;
  cargarPendientesGlobal();
});

function renderMaterias() {
  const grid = document.getElementById('materias-grid');
  let lista = todasLasMaterias;

  if (textoBusquedaMaterias.trim()) {
    const q = textoBusquedaMaterias.trim().toLowerCase();
    lista = lista.filter(m => m.nombre.toLowerCase().includes(q));
  }

  if (lista.length === 0) {
    const mensaje = todasLasMaterias.length === 0
      ? 'Todavía no tienes materias. ¡Crea la primera!'
      : 'No hay materias que coincidan con la búsqueda.';
    grid.innerHTML = `<div class="vacio materia-vacio">${ICONO_INBOX}<p>${mensaje}</p></div>`;
    return;
  }

  const sinFiltro = !textoBusquedaMaterias.trim();
  grid.innerHTML = '';
  lista.forEach(m => {
    const card = document.createElement('div');
    card.className = 'materia-card';
    card.dataset.id = m.id;
    const esAdmin = usuarioActual && usuarioActual.rol === 'admin';
    if (sinFiltro && esAdmin) card.draggable = true;
    const actividadNueva = esAdmin && m.actividad_reciente > 0;
    const tienePromedio = !esAdmin && m.promedio_notas !== null && m.promedio_notas !== undefined;

    card.innerHTML = `
      <div class="materia-card-banner" style="background:${colorMateria(m.id)}">
        ${sinFiltro && esAdmin ? `<span class="materia-card-arrastre" title="Arrastra para reordenar">${ICONO_ARRASTRE}</span>` : ''}
        ${actividadNueva ? `<span class="materia-card-actividad" title="Comentarios o entregas nuevas en los últimos 3 días">${m.actividad_reciente} nuevo${m.actividad_reciente > 1 ? 's' : ''}</span>` : ''}
        ${esAdmin ? `
        <div class="materia-card-acciones">
          <button class="materia-card-icon-btn" data-action="editar-materia" data-id="${m.id}" title="Editar materia">${ICONO_LAPIZ}</button>
          <button class="materia-card-icon-btn" data-action="eliminar-materia" data-id="${m.id}" title="Eliminar materia">${ICONO_X}</button>
        </div>` : ''}
      </div>
      <div class="materia-card-body">
        <div class="materia-card-nombre">${escapeHtml(m.nombre)}</div>
        ${m.profesor ? `<div class="materia-card-profesor">${ICONO_USUARIO} ${escapeHtml(m.profesor)}</div>` : ''}
        <div class="materia-card-stats">
          <div class="materia-card-stat"><strong>${m.total}</strong><span>Total</span></div>
          <div class="materia-card-stat"><strong>${m.pendientes}</strong><span>Pendientes</span></div>
          <div class="materia-card-stat"><strong>${m.completadas}</strong><span>Listas</span></div>
          ${tienePromedio ? `<div class="materia-card-stat materia-card-stat-promedio"><strong>${m.promedio_notas}</strong><span>Promedio</span></div>` : ''}
        </div>
        <div class="materia-card-footer">
          <button type="button" class="btn-ver-materia" data-action="ver-materia" data-id="${m.id}">Ver Materia</button>
          ${esAdmin ? `<button type="button" class="btn-texto" data-action="ver-calificaciones" data-id="${m.id}">Calificaciones</button>` : ''}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

document.getElementById('materias-grid').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (btn) {
    const { action, id } = btn.dataset;
    if (action === 'editar-materia') abrirModalEditarMateria(id);
    if (action === 'eliminar-materia') pedirConfirmacionEliminarMateria(id);
    if (action === 'ver-materia') abrirMateria(id);
    if (action === 'ver-calificaciones') abrirModalCalificaciones(id);
    return;
  }
  const card = e.target.closest('.materia-card');
  if (card) abrirMateria(card.dataset.id);
});

document.getElementById('buscador-materias').addEventListener('input', (e) => {
  textoBusquedaMaterias = e.target.value;
  renderMaterias();
});

let materiaArrastrada = null;
const materiasGrid = document.getElementById('materias-grid');

materiasGrid.addEventListener('dragstart', (e) => {
  const card = e.target.closest('.materia-card');
  if (!card) return;
  materiaArrastrada = card.dataset.id;
  card.classList.add('arrastrando');
});

materiasGrid.addEventListener('dragend', (e) => {
  const card = e.target.closest('.materia-card');
  if (card) card.classList.remove('arrastrando');
});

materiasGrid.addEventListener('dragover', (e) => {
  e.preventDefault();
  const card = e.target.closest('.materia-card');
  if (card) card.classList.add('sobre-drop');
});

materiasGrid.addEventListener('dragleave', (e) => {
  const card = e.target.closest('.materia-card');
  if (card) card.classList.remove('sobre-drop');
});

materiasGrid.addEventListener('drop', async (e) => {
  e.preventDefault();
  const card = e.target.closest('.materia-card');
  if (card) card.classList.remove('sobre-drop');
  if (!card || !materiaArrastrada || String(card.dataset.id) === String(materiaArrastrada)) return;

  const idxOrigen = todasLasMaterias.findIndex(m => String(m.id) === String(materiaArrastrada));
  const idxDestino = todasLasMaterias.findIndex(m => String(m.id) === String(card.dataset.id));
  materiaArrastrada = null;
  if (idxOrigen === -1 || idxDestino === -1) return;

  const [movida] = todasLasMaterias.splice(idxOrigen, 1);
  todasLasMaterias.splice(idxDestino, 0, movida);
  renderMaterias();

  try {
    await fetch(`${API_URL_MATERIAS}/reordenar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orden: todasLasMaterias.map(m => m.id) })
    });
  } catch (err) {
    mostrarToast('No se pudo guardar el nuevo orden', 'error');
  }
});

async function abrirMateria(id) {
  const m = todasLasMaterias.find(x => String(x.id) === String(id));
  if (!m) return;
  materiaActual = id;
  document.getElementById('materia-titulo').textContent = m.nombre;
  document.getElementById('materia-subtitulo').textContent = m.profesor
    ? `${m.profesor} · Organiza y da seguimiento a tus deberes`
    : 'Organiza, prioriza y da seguimiento a tus deberes de esta materia';
  const esAdmin = usuarioActual && usuarioActual.rol === 'admin';
  document.getElementById('btn-estudiantes-materia').style.display = esAdmin ? '' : 'none';
  document.getElementById('panel-form').style.display = esAdmin ? '' : 'none';
  document.getElementById('btn-vaciar-completadas').style.display = esAdmin ? '' : 'none';
  document.getElementById('btn-imprimir').style.display = esAdmin ? '' : 'none';
  resetForm();
  mostrarVista('tareas');
  await cargarTareas();
  cargarAnuncios();
}

async function cargarAnuncios() {
  if (!materiaActual) return;
  try {
    const res = await fetch(`${API_URL_ANUNCIOS}/${materiaActual}/anuncios`);
    const anuncios = await res.json();
    renderAnuncios(anuncios);
  } catch (err) {
    document.getElementById('lista-anuncios').innerHTML = '<div class="anuncio-vacio">No se pudieron cargar los anuncios.</div>';
  }
}

function renderAnuncios(anuncios) {
  const cont = document.getElementById('lista-anuncios');
  if (!anuncios.length) {
    cont.innerHTML = '<div class="anuncio-vacio">Todavía no hay anuncios en esta materia.</div>';
    return;
  }
  const esAdmin = usuarioActual && usuarioActual.rol === 'admin';
  const hace24h = Date.now() - 24 * 60 * 60 * 1000;
  cont.innerHTML = anuncios.map(a => {
    const esNuevo = !esAdmin && new Date(a.fecha_creacion).getTime() > hace24h;
    return `
    <div class="anuncio-item" data-id="${a.id}">
      <span class="anuncio-item-icono">${ICONO_MEGAFONO}</span>
      <div class="anuncio-item-cuerpo">
        <div class="anuncio-item-texto">${escapeHtml(a.contenido)} ${esNuevo ? '<span class="anuncio-item-nuevo">Nuevo</span>' : ''}</div>
        <div class="anuncio-item-fecha">${formatearFechaHora(a.fecha_creacion)}</div>
      </div>
      ${esAdmin ? `<button class="icon-btn" data-action="eliminar-anuncio" data-id="${a.id}" title="Eliminar anuncio">${ICONO_BASURA}</button>` : ''}
    </div>
  `;
  }).join('');
}

function formatearFechaHora(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
}

document.getElementById('form-anuncio').addEventListener('submit', async (e) => {
  e.preventDefault();
  const textarea = document.getElementById('anuncio-contenido');
  const contenido = textarea.value.trim();
  if (!contenido || !materiaActual) return;
  try {
    await fetch(`${API_URL_ANUNCIOS}/${materiaActual}/anuncios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido })
    });
    textarea.value = '';
    mostrarToast('Anuncio publicado');
    cargarAnuncios();
  } catch (err) {
    mostrarToast('No se pudo publicar el anuncio', 'error');
  }
});

document.getElementById('lista-anuncios').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action="eliminar-anuncio"]');
  if (!btn) return;
  accionEliminar = { tipo: 'anuncio', id: btn.dataset.id };
  document.getElementById('modal-titulo').textContent = '¿Eliminar este anuncio?';
  document.getElementById('modal-texto').textContent = 'Esta acción no se puede deshacer.';
  document.getElementById('modal-overlay').classList.add('visible');
});

/* ---------- Inscripcion de estudiantes en una materia ---------- */

let inscritosActuales = [];

async function abrirModalInscripcion() {
  if (!materiaActual) return;
  const m = todasLasMaterias.find(x => String(x.id) === String(materiaActual));
  document.getElementById('inscripcion-materia-nombre').textContent = m ? m.nombre : '';
  document.getElementById('inscripcion-modal-overlay').classList.add('visible');
  await cargarInscritos();
}

function cerrarModalInscripcion() {
  document.getElementById('inscripcion-modal-overlay').classList.remove('visible');
}

async function cargarInscritos() {
  try {
    const [resInscritos, resTodos] = await Promise.all([
      fetch(`${API_URL_MATERIAS}/${materiaActual}/estudiantes`),
      fetch(API_URL_USUARIOS)
    ]);
    inscritosActuales = await resInscritos.json();
    const todosLosEst = await resTodos.json();
    renderInscritos();
    renderSelectInscripcion(todosLosEst);
  } catch (err) {
    document.getElementById('lista-inscritos').innerHTML = '<div class="usuarios-vacio">No se pudo cargar la lista.</div>';
  }
}

function renderSelectInscripcion(todosLosEst) {
  const select = document.getElementById('inscripcion-select');
  const inscritosIds = new Set(inscritosActuales.map(u => String(u.id)));
  const disponibles = todosLosEst.filter(u => !inscritosIds.has(String(u.id)));
  select.innerHTML = '<option value="">Selecciona un estudiante...</option>' +
    disponibles.map(u => `<option value="${u.id}">${escapeHtml(u.nombre)} (${escapeHtml(u.correo)})</option>`).join('');
}

function renderInscritos() {
  const cont = document.getElementById('lista-inscritos');
  if (!inscritosActuales.length) {
    cont.innerHTML = '<div class="usuarios-vacio">Todavía no has agregado estudiantes a esta materia.</div>';
    return;
  }
  cont.innerHTML = inscritosActuales.map(u => `
    <div class="usuario-row">
      <span class="usuario-row-avatar">${escapeHtml(u.nombre.trim().slice(0, 2).toUpperCase())}</span>
      <div class="usuario-row-info">
        <strong>${escapeHtml(u.nombre)}</strong>
        <span>${escapeHtml(u.correo)}</span>
      </div>
      <button class="icon-btn" data-action="quitar-inscrito" data-id="${u.id}" title="Quitar de esta materia">${ICONO_X}</button>
    </div>
  `).join('');
}

document.getElementById('btn-estudiantes-materia').addEventListener('click', abrirModalInscripcion);
document.getElementById('inscripcion-modal-cerrar').addEventListener('click', cerrarModalInscripcion);
document.getElementById('inscripcion-modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'inscripcion-modal-overlay') cerrarModalInscripcion();
});

document.getElementById('form-inscripcion').addEventListener('submit', async (e) => {
  e.preventDefault();
  const select = document.getElementById('inscripcion-select');
  const usuarioId = select.value;
  if (!usuarioId || !materiaActual) return;
  try {
    const res = await fetch(`${API_URL_MATERIAS}/${materiaActual}/estudiantes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: usuarioId })
    });
    if (!res.ok) throw new Error();
    mostrarToast('Estudiante agregado a la materia');
    await cargarInscritos();
  } catch (err) {
    mostrarToast('No se pudo agregar al estudiante', 'error');
  }
});

document.getElementById('lista-inscritos').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action="quitar-inscrito"]');
  if (!btn || !materiaActual) return;
  try {
    await fetch(`${API_URL_MATERIAS}/${materiaActual}/estudiantes/${btn.dataset.id}`, { method: 'DELETE' });
    mostrarToast('Estudiante quitado de la materia');
    await cargarInscritos();
  } catch (err) {
    mostrarToast('No se pudo quitar al estudiante', 'error');
  }
});

document.getElementById('btn-toggle-lote').addEventListener('click', () => {
  const form = document.getElementById('form-inscripcion-lote');
  form.style.display = form.style.display === 'none' ? '' : 'none';
});

document.getElementById('form-inscripcion-lote').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!materiaActual) return;
  const texto = document.getElementById('lote-estudiantes').value;
  const password = document.getElementById('lote-password').value;

  const estudiantes = texto.split('\n')
    .map(linea => linea.trim())
    .filter(Boolean)
    .map(linea => {
      const [nombre, correo] = linea.split(',').map(s => s.trim());
      return { nombre, correo };
    })
    .filter(e => e.nombre && e.correo);

  if (!estudiantes.length) {
    mostrarToast('Pega al menos una línea con formato "Nombre, correo"', 'error');
    return;
  }
  if (!password) {
    mostrarToast('Indica una contraseña temporal para las cuentas nuevas', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_URL_MATERIAS}/${materiaActual}/estudiantes/lote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estudiantes, password })
    });
    const data = await res.json();
    if (!res.ok) {
      mostrarToast(data.error || 'No se pudo agregar la lista', 'error');
      return;
    }
    mostrarToast(`${data.creados} cuenta(s) nueva(s), ${data.inscritos} inscrito(s) en la materia`);
    document.getElementById('form-inscripcion-lote').reset();
    document.getElementById('form-inscripcion-lote').style.display = 'none';
    await cargarInscritos();
  } catch (err) {
    mostrarToast('Ocurrió un error, intenta de nuevo', 'error');
  }
});

/* ---------- Libro de calificaciones de una materia ---------- */

async function abrirModalCalificaciones(materiaId) {
  const m = todasLasMaterias.find(x => String(x.id) === String(materiaId));
  document.getElementById('calificaciones-materia-nombre').textContent = m ? m.nombre : '';
  document.getElementById('calificaciones-tabla-cont').innerHTML =
    '<div class="cargando"><span class="spinner"></span> Cargando...</div>';
  document.getElementById('calificaciones-modal-overlay').classList.add('visible');
  try {
    const res = await fetch(`${API_URL_MATERIAS}/${materiaId}/libro-notas`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderLibroCalificaciones(data);
  } catch (err) {
    document.getElementById('calificaciones-tabla-cont').innerHTML =
      '<div class="usuarios-vacio">No se pudo cargar el libro de calificaciones.</div>';
  }
}

function cerrarModalCalificaciones() {
  document.getElementById('calificaciones-modal-overlay').classList.remove('visible');
}

function renderLibroCalificaciones(data) {
  const cont = document.getElementById('calificaciones-tabla-cont');
  const { tareas, estudiantes } = data;

  if (!estudiantes.length) {
    cont.innerHTML = '<div class="usuarios-vacio">Todavía no hay estudiantes inscritos en esta materia.</div>';
    return;
  }
  if (!tareas.length) {
    cont.innerHTML = '<div class="usuarios-vacio">Todavía no hay tareas creadas en esta materia.</div>';
    return;
  }

  const encabezados = tareas.map(t => `<th title="${escapeHtml(t.titulo)}">${escapeHtml(t.titulo.slice(0, 14))}${t.titulo.length > 14 ? '…' : ''}</th>`).join('');
  const filas = estudiantes.map(e => {
    const celdas = tareas.map(t => {
      const nota = e.notas[t.id];
      return `<td>${nota !== undefined && nota !== null ? nota : '—'}</td>`;
    }).join('');
    return `
      <tr>
        <td class="calificaciones-nombre">${escapeHtml(e.nombre)}</td>
        ${celdas}
        <td class="calificaciones-promedio">${e.promedio !== null ? e.promedio : '—'}</td>
      </tr>
    `;
  }).join('');

  cont.innerHTML = `
    <div class="calificaciones-tabla-scroll">
      <table class="calificaciones-tabla">
        <thead>
          <tr><th>Estudiante</th>${encabezados}<th>Promedio</th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
}

document.getElementById('calificaciones-modal-cerrar').addEventListener('click', cerrarModalCalificaciones);
document.getElementById('calificaciones-modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'calificaciones-modal-overlay') cerrarModalCalificaciones();
});

async function irATarea(materiaId, tareaId) {
  if (!materiaId) {
    mostrarToast('Esta tarea no tiene materia asignada', 'error');
    return;
  }
  await abrirMateria(materiaId);
  abrirDetalle(tareaId);
}

function volverAMaterias() {
  materiaActual = null;
  mostrarVista('materias');
  cargarMaterias();
  cargarResumenGlobal();
  cargarPendientesGlobal();
}

document.getElementById('btn-volver-materias').addEventListener('click', volverAMaterias);

function pedirConfirmacionEliminarMateria(id) {
  const m = todasLasMaterias.find(x => String(x.id) === String(id));
  accionEliminar = { tipo: 'materia', id };
  document.getElementById('modal-titulo').textContent = '¿Eliminar esta materia?';
  document.getElementById('modal-texto').textContent = (m && m.total > 0)
    ? `Esta materia tiene ${m.total} tarea(s). No se borrarán, pero quedarán sin materia asignada.`
    : 'Esta acción no se puede deshacer.';
  document.getElementById('modal-overlay').classList.add('visible');
}

function abrirModalNuevaMateria() {
  document.getElementById('materia-modal-titulo').textContent = 'Nueva Materia';
  document.getElementById('materia-id').value = '';
  document.getElementById('materia-nombre').value = '';
  document.getElementById('materia-profesor').value = '';
  document.getElementById('materia-modal-overlay').classList.add('visible');
  document.getElementById('materia-nombre').focus();
}

function abrirModalEditarMateria(id) {
  const m = todasLasMaterias.find(x => String(x.id) === String(id));
  if (!m) return;
  document.getElementById('materia-modal-titulo').textContent = 'Editar Materia';
  document.getElementById('materia-id').value = m.id;
  document.getElementById('materia-nombre').value = m.nombre;
  document.getElementById('materia-profesor').value = m.profesor || '';
  document.getElementById('materia-modal-overlay').classList.add('visible');
  document.getElementById('materia-nombre').focus();
}

function cerrarModalMateria() {
  document.getElementById('materia-modal-overlay').classList.remove('visible');
}

document.getElementById('btn-nueva-materia').addEventListener('click', abrirModalNuevaMateria);
document.getElementById('materia-modal-cancelar').addEventListener('click', cerrarModalMateria);
document.getElementById('materia-modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'materia-modal-overlay') cerrarModalMateria();
});

document.getElementById('form-materia').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('materia-id').value;
  const nombre = document.getElementById('materia-nombre').value.trim();
  const profesor = document.getElementById('materia-profesor').value.trim();
  if (!nombre) return;

  try {
    if (id) {
      await fetch(`${API_URL_MATERIAS}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, profesor })
      });
      mostrarToast('Materia actualizada correctamente');
    } else {
      await fetch(API_URL_MATERIAS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, profesor })
      });
      mostrarToast('Materia creada correctamente');
    }
    cerrarModalMateria();
    cargarMaterias();
  } catch (err) {
    mostrarToast('Ocurrió un error, intenta de nuevo', 'error');
  }
});

const sesionGuardada = obtenerSesion();
if (sesionGuardada) {
  iniciarApp(sesionGuardada.usuario);
} else {
  mostrarLogin();
}
