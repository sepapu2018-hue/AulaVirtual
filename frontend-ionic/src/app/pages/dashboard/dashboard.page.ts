import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import {
  IonHeader,
  IonToolbar,
  IonButton,
  IonContent,
  IonSpinner,
  IonText
} from '@ionic/angular/standalone';

import {
  ApiService,
  EstadisticasAdmin,
  Estudiante
} from '../../services/api.service';

import {
  GestionEstudiantesComponent
} from '../../components/gestion-estudiantes/gestion-estudiantes.component';

interface BarraRol {
  etiqueta: string;
  valor: number;
  claseColor: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonButton,
    IonContent,
    IonSpinner,
    IonText,
    GestionEstudiantesComponent
  ]
})
export class DashboardPage implements OnInit {

  usuario = this.apiService.obtenerUsuario();

  estadisticas: EstadisticasAdmin | null = null;

  cargando = true;
  mensajeError = '';

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarEstadisticas();
  }

  cargarEstadisticas(): void {
    this.cargando = true;
    this.mensajeError = '';

    this.apiService.obtenerEstadisticasAdmin().subscribe({
      next: (estadisticas) => {
        this.estadisticas = estadisticas;
        this.cargando = false;
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error al cargar estadísticas:', error);

        this.mensajeError =
          error.error?.error ??
          'No se pudieron cargar las estadísticas.';

        this.cargando = false;
      }
    });
  }

  // Orden fijo (nunca reordenado por valor) para que el color
  // siempre identifique al mismo rol, sin importar los conteos.
  get barrasRoles(): BarraRol[] {
    const usuarios = this.estadisticas?.usuarios;

    return [
      {
        etiqueta: 'Estudiantes',
        valor: usuarios?.estudiante ?? 0,
        claseColor: 'color-estudiantes'
      },
      {
        etiqueta: 'Profesores',
        valor: usuarios?.profesor ?? 0,
        claseColor: 'color-profesores'
      },
      {
        etiqueta: 'Administradores',
        valor: usuarios?.admin ?? 0,
        claseColor: 'color-administradores'
      }
    ];
  }

  get maxUsuariosPorRol(): number {
    return Math.max(
      1,
      ...this.barrasRoles.map((barra) => barra.valor)
    );
  }

  totalMateria(
    materia: { completadas: number; pendientes: number }
  ): number {
    return materia.completadas + materia.pendientes;
  }

  porcentajeCompletadas(
    materia: { completadas: number; pendientes: number }
  ): number {
    const total = this.totalMateria(materia);
    return total === 0 ? 0 : (materia.completadas / total) * 100;
  }

  verAula(estudiante: Estudiante): void {
    this.apiService.entrarModoAula(estudiante);
    this.router.navigateByUrl('/materias');
  }

  volver(): void {
    this.router.navigate(['/materias']);
  }
}
