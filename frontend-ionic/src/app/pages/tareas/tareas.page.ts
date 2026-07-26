import { addIcons } from 'ionicons';
import { add } from 'ionicons/icons';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import {
  IonHeader,
  IonToolbar,
  IonContent,
  IonButton,
  IonSpinner,
  IonText,
  IonSearchbar,
  IonCard,
  IonCardContent,
  IonFab,
  IonFabButton,
  IonIcon, 
  IonModal
} from '@ionic/angular/standalone';

import {
  ApiService,
  Materia,
  Tarea,
  Anuncio,
  EstadisticasTareas
} from '../../services/api.service';

import { TareaFormComponent } from '../../components/tarea-form/tarea-form.component';

type FiltroTareas =
  | 'todas'
  | 'pendientes'
  | 'completadas';

@Component({
  selector: 'app-tareas',
  templateUrl: './tareas.page.html',
  styleUrls: ['./tareas.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonContent,
    IonButton,
    IonSpinner,
    IonText,
    IonSearchbar,
    IonCard,
    IonCardContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonModal,
    TareaFormComponent
  ]
})

export class TareasPage implements OnInit {

  materiaId = 0;
  materia: Materia | null = null;

  tareas: Tarea[] = [];
  anuncios: Anuncio[] = [];

  mostrarFormulario = false;

  textoBusqueda = '';
  filtroActual: FiltroTareas = 'todas';

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

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    addIcons({
      add
    });
  }

  ngOnInit(): void {
    const parametro = this.route.snapshot.paramMap.get(
      'materiaId'
    );

    const materiaId = Number(parametro);

    if (!materiaId || Number.isNaN(materiaId)) {
      this.router.navigateByUrl('/materias', {
        replaceUrl: true
      });

      return;
    }

    this.materiaId = materiaId;
    this.cargarDatos();
  }

  get esAdministrador(): boolean {
    return this.usuario?.rol === 'admin';
  }

  get tareasFiltradas(): Tarea[] {
    const busqueda = this.textoBusqueda
      .trim()
      .toLowerCase();

    return this.tareas.filter((tarea) => {
      const coincideBusqueda =
        !busqueda ||
        tarea.titulo.toLowerCase().includes(busqueda) ||
        (tarea.descripcion ?? '')
          .toLowerCase()
          .includes(busqueda);

      let coincideEstado = true;

      if (this.filtroActual === 'pendientes') {
        coincideEstado = !tarea.completada;
      }

      if (this.filtroActual === 'completadas') {
        coincideEstado = tarea.completada;
      }

      return coincideBusqueda && coincideEstado;
    });
  }

  cargarDatos(): void {
    this.cargando = true;
    this.mensajeError = '';

    forkJoin({
      materias: this.apiService.obtenerMaterias(),

      tareas:
        this.apiService.obtenerTareasPorMateria(
          this.materiaId
        ),

      estadisticas:
        this.apiService.obtenerEstadisticasTareas(
          this.materiaId
        ),

      anuncios:
        this.apiService.obtenerAnuncios(
          this.materiaId
        )
    }).subscribe({
      next: ({
        materias,
        tareas,
        estadisticas,
        anuncios
      }) => {
        this.materia =
          materias.find(
            (materia) =>
              materia.id === this.materiaId
          ) ?? null;

        this.tareas = tareas;
        this.estadisticas = estadisticas;
        this.anuncios = anuncios;

        if (!this.materia) {
          this.mensajeError =
            'La materia no fue encontrada.';
        }

        this.cargando = false;
      },
      error: (error: HttpErrorResponse) => {
        console.error(
          'Error al cargar la materia:',
          error
        );

        this.mensajeError =
          error.error?.error ??
          'No se pudieron cargar los datos de la materia.';

        this.cargando = false;
      }
    });
  }

  establecerFiltro(
    filtro: FiltroTareas
  ): void {
    this.filtroActual = filtro;
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

  obtenerTextoPrioridad(
    prioridad: Tarea['prioridad']
  ): string {
    const textos = {
      alta: 'Alta',
      media: 'Media',
      baja: 'Baja'
    };

    return textos[prioridad];
  }

  estaVencida(tarea: Tarea): boolean {
    if (
      tarea.completada ||
      !tarea.fecha_limite
    ) {
      return false;
    }

    const fechaTexto =
      tarea.fecha_limite.split('T')[0];

    const fechaLimite = new Date(
      `${fechaTexto}T00:00:00`
    );

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return fechaLimite < hoy;
  }

  formatearFecha(
    fecha: string | null
  ): string {
    if (!fecha) {
      return 'Sin fecha límite';
    }

    const fechaTexto = fecha.split('T')[0];

    return new Intl.DateTimeFormat(
      'es-EC',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }
    ).format(
      new Date(`${fechaTexto}T00:00:00`)
    );
  }

  formatearFechaHora(fecha: string): string {
    return new Intl.DateTimeFormat(
      'es-EC',
      {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }
    ).format(new Date(fecha));
  }

  volverMaterias(): void {
    this.router.navigateByUrl('/materias');
  }

  cerrarSesion(): void {
    this.apiService.cerrarSesion();

    this.router.navigateByUrl('/home', {
      replaceUrl: true
    });
  }

  abrirFormularioNuevaTarea(): void {
    this.mostrarFormulario = true;
  }
}

