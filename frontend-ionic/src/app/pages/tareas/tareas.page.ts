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
  IonTextarea,
  IonSearchbar,
  IonCard,
  IonCardContent,
  IonFab,
  IonFabButton,
  IonIcon, 
  IonModal,
  IonToast
} from '@ionic/angular/standalone';

import { ApiService, Materia, Tarea, TareaDetalle, Anuncio, EstadisticasTareas, ModoAulaEstudiante } from '../../services/api.service';
import { TareaFormComponent, TareaFormularioDatos } from '../../components/tarea-form/tarea-form.component';
import { TareaDetalleComponent } from '../../components/tarea-detalle/tarea-detalle.component';
import { MateriaEstudiantesComponent } from '../../components/materia-estudiantes/materia-estudiantes.component';
import { AlertController } from '@ionic/angular';

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
    IonTextarea,
    IonSearchbar,
    IonCard,
    IonCardContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonModal,
    TareaFormComponent,
    IonToast,
    TareaDetalleComponent,
    MateriaEstudiantesComponent
  ]
})

export class TareasPage implements OnInit {

  materiaId = 0;
  materia: Materia | null = null;

  tareas: Tarea[] = [];
  anuncios: Anuncio[] = [];

  anuncioContenido = '';

  publicandoAnuncio = false;
  cargandoAnuncios = false;

  eliminandoAnuncioId: number | null = null;

  mostrarFormulario = false;
  tareaEnEdicion: Tarea | null = null;

  mostrarEstudiantesMateria = false;

  mostrarDetalle = false;
  tareaSeleccionada: TareaDetalle | null = null;
  cargandoDetalleId: number | null = null;

  textoBusqueda = '';
  filtroActual: FiltroTareas = 'todas';

  cargando = true;
  mensajeError = '';

  guardandoTarea = false;
  eliminandoTareaId: number | null = null;

  toastAbierto = false;
  toastMensaje = '';
  toastColor: 'success' | 'danger' = 'success';

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
    private router: Router,
    private alertController:AlertController
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
    return (this.apiService.obtenerUsuario()?.rol === 'admin');
  }

  get modoAula():
    ModoAulaEstudiante | null {
    return this.apiService.obtenerModoAula();
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

  cargarAnuncios(): void {
    this.cargandoAnuncios = true;

    this.apiService
      .obtenerAnuncios(this.materiaId)
      .subscribe({
        next: (anuncios) => {
          this.anuncios = anuncios;
          this.cargandoAnuncios = false;
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al cargar anuncios:',
            error
          );

          this.cargandoAnuncios = false;

          this.mostrarToast(
            error.error?.error ??
              'No se pudieron cargar los anuncios.',
            'danger'
          );
        }
      });
  }

  publicarAnuncio(): void {
    const contenido =
      this.anuncioContenido.trim();

    if (!contenido) {
      this.mostrarToast(
        'Escribe un anuncio antes de publicarlo.',
        'danger'
      );

      return;
    }

    if (
      !this.esAdministrador ||
      this.publicandoAnuncio
    ) {
      return;
    }

    this.publicandoAnuncio = true;

    this.apiService
      .crearAnuncio(
        this.materiaId,
        contenido
      )
      .subscribe({
        next: () => {
          this.anuncioContenido = '';
          this.publicandoAnuncio = false;

          this.mostrarToast(
            'Anuncio publicado correctamente',
            'success'
          );

          this.cargarAnuncios();
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al publicar anuncio:',
            error
          );

          this.publicandoAnuncio = false;

          this.mostrarToast(
            error.error?.error ??
              'No se pudo publicar el anuncio.',
            'danger'
          );
        }
      });
  }

  async solicitarEliminarAnuncio(
    anuncio: Anuncio
  ): Promise<void> {
    const alerta =
      await this.alertController.create({
        header: '¿Eliminar este anuncio?',
        message:
          'Esta acción no se puede deshacer.',
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel'
          },
          {
            text: 'Eliminar',
            role: 'destructive',
            handler: () => {
              this.eliminarAnuncio(anuncio);
            }
          }
        ]
      });

    await alerta.present();
  }

  eliminarAnuncio(
    anuncio: Anuncio
  ): void {
    if (
      !this.esAdministrador ||
      this.eliminandoAnuncioId !== null
    ) {
      return;
    }

    this.eliminandoAnuncioId = anuncio.id;

    this.apiService
      .eliminarAnuncio(anuncio.id)
      .subscribe({
        next: () => {
          this.eliminandoAnuncioId = null;

          this.mostrarToast(
            'Anuncio eliminado correctamente',
            'success'
          );

          this.cargarAnuncios();
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al eliminar anuncio:',
            error
          );

          this.eliminandoAnuncioId = null;

          this.mostrarToast(
            error.error?.error ??
              'No se pudo eliminar el anuncio.',
            'danger'
          );
        }
      });
  }

  formatearFechaHoraAnuncio(
    fecha: string
  ): string {
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

  salirModoAula(): void {
    this.apiService.salirModoAula();

    this.router.navigate(['/materias']);
  }

  cerrarSesion(): void {
    this.apiService.cerrarSesion();

    this.router.navigateByUrl('/home', {
      replaceUrl: true
    });
  }

  abrirFormularioNuevaTarea(): void {
    this.tareaEnEdicion = null;
    this.mostrarFormulario = true;
  }

  abrirFormularioEditar(
    tarea: Tarea,
    evento: Event
  ): void {
    evento.stopPropagation();

    this.tareaEnEdicion = tarea;
    this.mostrarFormulario = true;
  }

  cerrarFormularioTarea(): void {
    this.mostrarFormulario = false;
    this.tareaEnEdicion = null;
    this.guardandoTarea = false;
  }

  abrirEstudiantesMateria(): void {
    if (!this.esAdministrador) {
      return;
    }

    this.mostrarEstudiantesMateria = true;
  }

  cerrarEstudiantesMateria(): void {
    this.mostrarEstudiantesMateria = false;
  }

  abrirDetalleTarea(tarea: Tarea): void {
    if (this.cargandoDetalleId !== null) {
      return;
    }

    this.cargandoDetalleId = tarea.id;

    this.apiService
      .obtenerDetalleTarea(tarea.id)
      .subscribe({
        next: (detalle) => {
          this.cargandoDetalleId = null;
          this.tareaSeleccionada = detalle;
          this.mostrarDetalle = true;
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al cargar el detalle:',
            error
          );

          this.cargandoDetalleId = null;

          this.mostrarToast(
            error.error?.error ??
              'No se pudo cargar el detalle.',
            'danger'
          );
        }
      });
  }

  cerrarDetalleTarea(): void {
    this.mostrarDetalle = false;
    this.tareaSeleccionada = null;
  }

  actualizarTrasCambioDetalle(): void {
    this.cargarDatos();
  }

  guardarTarea(
    datos: TareaFormularioDatos
  ): void {
    if (this.guardandoTarea) {
      return;
    }

    this.guardandoTarea = true;

    const editando = this.tareaEnEdicion !== null;

    const peticion = this.tareaEnEdicion
      ? this.apiService.actualizarTarea(
          this.tareaEnEdicion.id,
          this.materiaId,
          datos,
          this.tareaEnEdicion.completada
        )
      : this.apiService.crearTarea(
          this.materiaId,
          datos
        );

    peticion.subscribe({
      next: () => {
        this.cerrarFormularioTarea();

        this.mostrarToast(
          editando
            ? 'Tarea actualizada correctamente'
            : 'Tarea creada correctamente',
          'success'
        );

        this.cargarDatos();
      },
      error: (error: HttpErrorResponse) => {
        console.error(
          'Error al guardar la tarea:',
          error
        );

        this.guardandoTarea = false;

        this.mostrarToast(
          error.error?.error ??
            'No se pudo guardar la tarea.',
          'danger'
        );
      }
    });
  }

  async solicitarEliminarTarea(
    tarea: Tarea,
    evento: Event
  ): Promise<void> {
    evento.stopPropagation();

    const alerta =
      await this.alertController.create({
        header: '¿Eliminar esta tarea?',
        message:
          'Esta acción no se puede deshacer.',
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel'
          },
          {
            text: 'Eliminar',
            role: 'destructive',
            handler: () => {
              this.eliminarTarea(tarea);
            }
          }
        ]
      });

    await alerta.present();
  }

  eliminarTarea(tarea: Tarea): void {
    if (this.eliminandoTareaId !== null) {
      return;
    }

    this.eliminandoTareaId = tarea.id;

    this.apiService
      .eliminarTarea(tarea.id)
      .subscribe({
        next: () => {
          this.eliminandoTareaId = null;

          this.mostrarToast(
            'Tarea eliminada correctamente',
            'success'
          );

          this.cargarDatos();
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al eliminar la tarea:',
            error
          );

          this.eliminandoTareaId = null;

          this.mostrarToast(
            error.error?.error ??
              'No se pudo eliminar la tarea.',
            'danger'
          );
        }
      });
  }

  mostrarToast(
    mensaje: string,
    color: 'success' | 'danger'
  ): void {
    this.toastMensaje = mensaje;
    this.toastColor = color;
    this.toastAbierto = true;
  }
}

