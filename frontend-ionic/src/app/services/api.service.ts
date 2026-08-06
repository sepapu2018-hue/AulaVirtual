import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpHeaders, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  rol: 'admin' | 'profesor' | 'estudiante';
}

export interface Estudiante {
  id: number;
  nombre: string;
  correo: string;
}

export interface Profesor {
  id: number;
  nombre: string;
  correo: string;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}

export interface Materia {
  id: number;
  nombre: string;
  profesor: string | null;
  profesor_id: number | null;
  orden: number;
  fecha_creacion: string;
  es_dueno: boolean;
  total: number;
  completadas: number;
  pendientes: number;
}

export interface EstadisticasTareas {
  total: number;
  completadas: number;
  pendientes: number;
  vencidas: number;
  por_prioridad: {
    alta: number;
    media: number;
    baja: number;
  };
}

export interface Tarea {
  id: number;
  materia_id: number;
  titulo: string;
  descripcion: string | null;
  prioridad: 'alta' | 'media' | 'baja';
  fecha_limite: string | null;
  completada: boolean;
  archivo_nombre: string | null;
  archivo_ruta: string | null;
  fecha_creacion: string;
  materia_nombre: string;
  num_archivos: number;
  mi_nota: number | string | null;
}

export interface ArchivoTarea {
  id: number;
  tarea_id: number;
  usuario_id: number | null;
  nombre_original: string;
  ruta: string;
  fecha_subida: string;
  usuario_nombre: string | null;
}

export interface RegistroEntrega {
  usuario_id: number;
  nombre: string;
  num_archivos: number;
  nota: number | string | null;
}

export interface NotaTarea {
  nota: number | string | null;
  comentario: string | null;
}

export interface TareaDetalle {
  id: number;
  materia_id: number;
  titulo: string;
  descripcion: string | null;
  prioridad: 'alta' | 'media' | 'baja';
  fecha_limite: string | null;
  completada: boolean;
  archivo_nombre: string | null;
  archivo_ruta: string | null;
  fecha_creacion: string;
  archivos: ArchivoTarea[];
  mi_nota: NotaTarea | null;
}

export interface Comentario {
  id: number;
  contenido: string;
  fecha_creacion: string;
  autor_nombre: string;
  autor_rol: string;
}

export interface Anuncio {
  id: number;
  materia_id: number;
  contenido: string;
  fecha_creacion: string;
}

export interface ModoAulaEstudiante {
  id: number;
  nombre: string;
}

const MODO_AULA_KEY = 'gt_modo_aula';

export const modoAulaInterceptor: HttpInterceptorFn = (
  request,
  next
) => {
  const usuarioTexto =
    localStorage.getItem('gt_usuario');

  const modoTexto =
    sessionStorage.getItem(MODO_AULA_KEY);

  if (!usuarioTexto || !modoTexto) {
    return next(request);
  }

  try {
    const usuario = JSON.parse(usuarioTexto);
    const modo: ModoAulaEstudiante =
      JSON.parse(modoTexto);

    const endpointCompatible =
      /\/api\/(materias|tareas|anuncios)(\/|$)/
        .test(request.url);

    if (
      usuario.rol !== 'admin' ||
      !endpointCompatible ||
      request.params.has('como')
    ) {
      return next(request);
    }

    return next(
      request.clone({
        params: request.params.set(
          'como',
          String(modo.id)
        )
      })
    );
  } catch {
    sessionStorage.removeItem(MODO_AULA_KEY);

    return next(request);
  }
};

@Injectable({
  providedIn: 'root'
})

export class ApiService {

  private readonly apiUrl = 'http://localhost:3001/api';

  constructor(private http: HttpClient) {}

  comprobarBackend(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(
      `${this.apiUrl}/health`
    );
  }

  iniciarSesion(
    correo: string,
    password: string
  ): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/auth/login`,
      {
        correo,
        password
      }
    );
  }

  obtenerMaterias(): Observable<Materia[]> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.get<Materia[]>(
      `${this.apiUrl}/materias`,
      { headers }
    );
  }

  crearMateria(
    datos: {
      nombre: string;
      profesor_id: number;
    }
  ): Observable<unknown> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.post(
      `${this.apiUrl}/materias`,
      datos,
      { headers }
    );
  }

  actualizarMateria(
    materiaId: number,
    datos: {
      nombre: string;
      profesor_id: number;
    }
  ): Observable<unknown> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.put(
      `${this.apiUrl}/materias/${materiaId}`,
      datos,
      { headers }
    );
  }

  eliminarMateria(
    materiaId: number
  ): Observable<unknown> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.delete(
      `${this.apiUrl}/materias/${materiaId}`,
      { headers }
    );
  }

  obtenerEstudiantes(): Observable<Estudiante[]> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.get<Estudiante[]>(
      `${this.apiUrl}/usuarios`,
      { headers }
    );
  }

  crearEstudiante(
    datos: {
      nombre: string;
      correo: string;
      password: string;
    }
  ): Observable<Estudiante> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.post<Estudiante>(
      `${this.apiUrl}/usuarios`,
      datos,
      { headers }
    );
  }

  eliminarEstudiante(
    estudianteId: number
  ): Observable<unknown> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.delete(
      `${this.apiUrl}/usuarios/${estudianteId}`,
      { headers }
    );
}

  obtenerProfesores(): Observable<Profesor[]> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.get<Profesor[]>(
      `${this.apiUrl}/usuarios?rol=profesor`,
      { headers }
    );
  }

  crearProfesor(
    datos: {
      nombre: string;
      correo: string;
      password: string;
    }
  ): Observable<Profesor> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.post<Profesor>(
      `${this.apiUrl}/usuarios`,
      {
        ...datos,
        rol: 'profesor'
      },
      { headers }
    );
  }

  eliminarProfesor(
    profesorId: number
  ): Observable<unknown> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.delete(
      `${this.apiUrl}/usuarios/${profesorId}`,
      { headers }
    );
  }

  obtenerEstudiantesMateria(
    materiaId: number
  ): Observable<Estudiante[]> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.get<Estudiante[]>(
      `${this.apiUrl}/materias/${materiaId}/estudiantes`,
      { headers }
    );
  }

  inscribirEstudiante(
    materiaId: number,
    usuarioId: number
  ): Observable<unknown> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.post(
      `${this.apiUrl}/materias/${materiaId}/estudiantes`,
      {
        usuario_id: usuarioId
      },
      { headers }
    );
  }

  quitarEstudianteMateria(
    materiaId: number,
    usuarioId: number
  ): Observable<unknown> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.delete(
      `${this.apiUrl}/materias/${materiaId}/estudiantes/${usuarioId}`,
      { headers }
    );
  }

  obtenerTareasPorMateria(
    materiaId: number
  ): Observable<Tarea[]> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.get<Tarea[]>(
      `${this.apiUrl}/tareas?materia_id=${materiaId}`,
      { headers }
    );
  }

  obtenerDetalleTarea(
    tareaId: number
  ): Observable<TareaDetalle> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.get<TareaDetalle>(
      `${this.apiUrl}/tareas/${tareaId}`,
      { headers }
    );
  }

  obtenerComentarios(
    tareaId: number
  ): Observable<Comentario[]> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.get<Comentario[]>(
      `${this.apiUrl}/tareas/${tareaId}/comentarios`,
      { headers }
    );
  }

  crearComentario(
    tareaId: number,
    contenido: string
  ): Observable<unknown> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.post(
      `${this.apiUrl}/tareas/${tareaId}/comentarios`,
      { contenido },
      { headers }
    );
  }

  eliminarComentario(
    comentarioId: number
  ): Observable<unknown> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.delete(
      `${this.apiUrl}/comentarios/${comentarioId}`,
      { headers }
    );
  }

  obtenerUrlArchivo(ruta: string): string {
    return `${this.apiUrl}/archivos/${encodeURIComponent(ruta)}`;
  }

  subirArchivoTarea(
    tareaId: number,
    archivo: File
  ): Observable<HttpEvent<unknown>> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    const formData = new FormData();
    formData.append('archivo', archivo);

    const peticion = new HttpRequest(
      'POST',
      `${this.apiUrl}/tareas/${tareaId}/archivo`,
      formData,
      {
        headers,
        reportProgress: true
      }
    );

    return this.http.request(peticion);
  }

  eliminarArchivoTarea(
    tareaId: number,
    archivoId: number
  ): Observable<unknown> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.delete(
      `${this.apiUrl}/tareas/${tareaId}/archivo/${archivoId}`,
      { headers }
    );
  }

  obtenerRegistroEntregas(
    tareaId: number
  ): Observable<RegistroEntrega[]> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.get<RegistroEntrega[]>(
      `${this.apiUrl}/tareas/${tareaId}/registro`,
      { headers }
    );
  }

  guardarNotaTarea(
    tareaId: number,
    usuarioId: number,
    nota: number | null
  ): Observable<unknown> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.put(
      `${this.apiUrl}/tareas/${tareaId}/notas`,
      {
        usuario_id: usuarioId,
        nota
      },
      { headers }
    );
  }

  crearTarea(
    materiaId: number,
    datos: {
      titulo: string;
      descripcion: string;
      prioridad: 'alta' | 'media' | 'baja';
      fecha_limite: string | null;
    }
  ): Observable<Tarea> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.post<Tarea>(
      `${this.apiUrl}/tareas`,
      {
        ...datos,
        materia_id: materiaId
      },
      { headers }
    );
  }

  actualizarTarea(
    tareaId: number,
    materiaId: number,
    datos: {
      titulo: string;
      descripcion: string;
      prioridad: 'alta' | 'media' | 'baja';
      fecha_limite: string | null;
    },
    completada: boolean
  ): Observable<Tarea> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.put<Tarea>(
      `${this.apiUrl}/tareas/${tareaId}`,
      {
        ...datos,
        completada,
        materia_id: materiaId
      },
      { headers }
    );
  }

  eliminarTarea(
    tareaId: number
  ): Observable<{ mensaje?: string }> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.delete<{ mensaje?: string }>(
      `${this.apiUrl}/tareas/${tareaId}`,
      { headers }
    );
  }

  obtenerEstadisticasTareas(
    materiaId?: number
  ): Observable<EstadisticasTareas> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    const url = materiaId
      ? `${this.apiUrl}/tareas/estadisticas?materia_id=${materiaId}`
      : `${this.apiUrl}/tareas/estadisticas`;

    return this.http.get<EstadisticasTareas>(
      url,
      { headers }
    );
  }

  obtenerAnuncios(
    materiaId: number
  ): Observable<Anuncio[]> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.get<Anuncio[]>(
      `${this.apiUrl}/materias/${materiaId}/anuncios`,
      { headers }
    );
  }

  crearAnuncio(
    materiaId: number,
    contenido: string
  ): Observable<unknown> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.post(
      `${this.apiUrl}/materias/${materiaId}/anuncios`,
      { contenido },
      { headers }
    );
  }

  eliminarAnuncio(
    anuncioId: number
  ): Observable<unknown> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.delete(
      `${this.apiUrl}/anuncios/${anuncioId}`,
      { headers }
    );
  }

  guardarSesion(respuesta: LoginResponse): void {
    localStorage.setItem('gt_token', respuesta.token);
    localStorage.setItem(
      'gt_usuario',
      JSON.stringify(respuesta.usuario)
    );
  }

  cerrarSesion(): void {
    localStorage.removeItem('gt_token');
    localStorage.removeItem('gt_usuario');
    sessionStorage.removeItem(MODO_AULA_KEY);
  }

  obtenerToken(): string | null {
    return localStorage.getItem('gt_token');
  }

  obtenerUsuario(): Usuario | null {
    const usuarioGuardado = localStorage.getItem('gt_usuario');

    if (!usuarioGuardado) {
      return null;
    }

    try {
      return JSON.parse(usuarioGuardado) as Usuario;
    } catch {
      this.cerrarSesion();
      return null;
    }
  }

  entrarModoAula(
    estudiante: Estudiante
  ): void {
    const modo: ModoAulaEstudiante = {
      id: estudiante.id,
      nombre: estudiante.nombre
    };

    sessionStorage.setItem(
      MODO_AULA_KEY,
      JSON.stringify(modo)
    );
  }

  salirModoAula(): void {
    sessionStorage.removeItem(MODO_AULA_KEY);
  }

  obtenerModoAula():
    ModoAulaEstudiante | null {
    const valor =
      sessionStorage.getItem(MODO_AULA_KEY);

    if (!valor) {
      return null;
    }

    try {
      return JSON.parse(valor);
    } catch {
      sessionStorage.removeItem(MODO_AULA_KEY);
      return null;
    }
  }
}