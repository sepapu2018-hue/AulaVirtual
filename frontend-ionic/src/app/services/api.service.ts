import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  rol: 'admin' | 'estudiante';
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}

export interface Materia {
  id: number;
  nombre: string;
  profesor: string | null;
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

  obtenerEstadisticasTareas(): Observable<EstadisticasTareas> {
    const token = this.obtenerToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.get<EstadisticasTareas>(
      `${this.apiUrl}/tareas/estadisticas`,
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
}