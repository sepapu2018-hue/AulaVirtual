import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import {
  IonHeader,
  IonToolbar,
  IonContent,
  IonSearchbar,
  IonButton,
  IonSpinner,
  IonText,
  IonCard,
  IonCardContent,
  IonProgressBar
} from '@ionic/angular/standalone';

import {
  ApiService,
  Materia,
  EstadisticasTareas
} from '../../services/api.service';

@Component({
  selector: 'app-materias',
  templateUrl: './materias.page.html',
  styleUrls: ['./materias.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonContent,
    IonSearchbar,
    IonButton,
    IonSpinner,
    IonText,
    IonCard,
    IonCardContent,
    IonProgressBar
  ]
})
export class MateriasPage implements OnInit {

  materias: Materia[] = [];
  textoBusqueda = '';

  cargando = true;
  mensajeError = '';

  usuario = this.apiService.obtenerUsuario();

  estadisticas: EstadisticasTareas = {
    total: 0,
    completadas: 0,
    pendientes: 0,
    vencidas: 0,
    por_prioridad: {
      alta: 0,
      media: 0,
      baja: 0
    }
  };

  fechaActual = new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());

  private readonly coloresMaterias = [
    '#1e3a5f',
    '#2f6690',
    '#3f6f52',
    '#6b4e71',
    '#8a5a12',
    '#475569'
  ];

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  get materiasFiltradas(): Materia[] {
    const busqueda = this.textoBusqueda
      .trim()
      .toLowerCase();

    if (!busqueda) {
      return this.materias;
    }

    return this.materias.filter((materia) => {
      const nombre = materia.nombre.toLowerCase();
      const profesor = materia.profesor?.toLowerCase() ?? '';

      return (
        nombre.includes(busqueda) ||
        profesor.includes(busqueda)
      );
    });
  }

  cargarDatos(): void {
    this.cargarMaterias();
    this.cargarEstadisticas();
  }

  cargarMaterias(): void {
    this.cargando = true;
    this.mensajeError = '';

    this.apiService.obtenerMaterias().subscribe({
      next: (materias) => {
        this.materias = materias;
        this.cargando = false;
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error al cargar materias:', error);

        this.mensajeError =
          error.error?.error ??
          'No se pudieron cargar las materias.';

        this.cargando = false;
      }
    });
  }

  cargarEstadisticas(): void {
    this.apiService.obtenerEstadisticasTareas().subscribe({
      next: (estadisticas) => {
        this.estadisticas = estadisticas;
      },
      error: (error) => {
        console.error(
          'Error al cargar estadísticas:',
          error
        );
      }
    });
  }

  obtenerIniciales(): string {
    const nombre = this.usuario?.nombre?.trim();

    if (!nombre) {
      return 'GT';
    }

    return nombre
      .split(/\s+/)
      .slice(0, 2)
      .map((palabra) => palabra.charAt(0))
      .join('')
      .toUpperCase();
  }

  obtenerColorMateria(id: number): string {
    return this.coloresMaterias[
      id % this.coloresMaterias.length
    ];
  }

  obtenerProgreso(materia: Materia): number {
    if (materia.total === 0) {
      return 0;
    }

    return materia.completadas / materia.total;
  }

  obtenerPorcentaje(materia: Materia): number {
    return Math.round(
      this.obtenerProgreso(materia) * 100
    );
  }

  abrirMateria(materia: Materia): void {
    this.router.navigate([
      '/materias',
      materia.id,
      'tareas'
    ]);
  }

  cerrarSesion(): void {
    this.apiService.cerrarSesion();

    this.router.navigateByUrl('/home', {
      replaceUrl: true
    });
  }
}