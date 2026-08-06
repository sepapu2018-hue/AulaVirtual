import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';

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
  IonProgressBar,
  IonModal,
  IonToast
} from '@ionic/angular/standalone';

import {
  ApiService,
  Materia,
  EstadisticasTareas,
  Estudiante,
  ModoAulaEstudiante,
  Profesor
} from '../../services/api.service';

import {
  MateriaFormComponent,
  MateriaFormularioDatos
} from '../../components/materia-form/materia-form.component';

import {
  GestionEstudiantesComponent
} from '../../components/gestion-estudiantes/gestion-estudiantes.component';

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
    IonProgressBar,
    IonModal,
    IonToast,
    MateriaFormComponent,
    GestionEstudiantesComponent
  ]
})

export class MateriasPage implements OnInit {

  materias: Materia[] = [];
  textoBusqueda = '';

  cargando = true;
  mensajeError = '';

  usuario = this.apiService.obtenerUsuario();

  mostrarFormularioMateria = false;

  mostrarGestionEstudiantes = false;

  materiaEnEdicion: Materia | null = null;

  profesores: Profesor[] = [];

  guardandoMateria = false;
  eliminandoMateriaId: number | null = null;

  toastAbierto = false;
  toastMensaje = '';
  toastColor: 'success' | 'danger' = 'success';

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

  get esAdministrador(): boolean {
    return this.usuario?.rol === 'admin';
  }

  get modoAula():
    ModoAulaEstudiante | null {
    return this.apiService.obtenerModoAula();
  }

  constructor(
    private apiService: ApiService,
    private router: Router,
    private alertController: AlertController
  ) {}

  ngOnInit(): void {
    this.cargarDatos();

    if (this.esAdministrador) {
      this.cargarProfesores();
    }
  }

  cargarProfesores(): void {
    this.apiService.obtenerProfesores().subscribe({
      next: (profesores) => {
        this.profesores = profesores;
      },
      error: (error) => {
        console.error('Error al cargar profesores:', error);
      }
    });
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

  abrirNuevaMateria(): void {
    this.materiaEnEdicion = null;
    this.mostrarFormularioMateria = true;
  }

  abrirEditarMateria(
    materia: Materia,
    evento: Event
  ): void {
    evento.stopPropagation();

    this.materiaEnEdicion = materia;
    this.mostrarFormularioMateria = true;
  }

  cerrarFormularioMateria(): void {
    if (this.guardandoMateria) {
      return;
    }

    this.mostrarFormularioMateria = false;
    this.materiaEnEdicion = null;
  }

  abrirGestionEstudiantes(): void {
    if (!this.esAdministrador) {
      return;
    }

    this.mostrarGestionEstudiantes = true;
  }

  cerrarGestionEstudiantes(): void {
    this.mostrarGestionEstudiantes = false;
    this.cargarProfesores();
  }

  entrarModoAula(
    estudiante: Estudiante
  ): void {
    if (!this.esAdministrador) {
      return;
    }

    this.apiService
      .entrarModoAula(estudiante);

    this.mostrarGestionEstudiantes = false;

    this.mostrarToastMateria(
      `Ahora estás viendo el aula de ${estudiante.nombre}`,
      'success'
    );

    this.cargarMaterias();
  }

  salirModoAula(): void {
    this.apiService.salirModoAula();

    this.mostrarToastMateria(
      'Regresaste a la vista del administrador',
      'success'
    );

    this.cargarMaterias();
  }

  guardarMateria(
    datos: MateriaFormularioDatos
  ): void {
    if (
      !this.esAdministrador ||
      this.guardandoMateria
    ) {
      return;
    }

    this.guardandoMateria = true;

    const editando =
      this.materiaEnEdicion !== null;

    const peticion = this.materiaEnEdicion
      ? this.apiService.actualizarMateria(
          this.materiaEnEdicion.id,
          datos
        )
      : this.apiService.crearMateria(datos);

    peticion.subscribe({
      next: () => {
        this.guardandoMateria = false;
        this.mostrarFormularioMateria = false;
        this.materiaEnEdicion = null;

        this.mostrarToastMateria(
          editando
            ? 'Materia actualizada correctamente'
            : 'Materia creada correctamente',
          'success'
        );

        this.cargarMaterias();
      },
      error: (error: HttpErrorResponse) => {
        console.error(
          'Error al guardar materia:',
          error
        );

        this.guardandoMateria = false;

        this.mostrarToastMateria(
          error.error?.error ??
            'No se pudo guardar la materia.',
          'danger'
        );
      }
    });
  }

  async solicitarEliminarMateria(
    materia: Materia,
    evento: Event
  ): Promise<void> {
    evento.stopPropagation();

    if (
      !this.esAdministrador ||
      this.eliminandoMateriaId !== null
    ) {
      return;
    }

    const mensaje =
      materia.total > 0
        ? `Esta materia tiene ${materia.total} tarea(s). Al eliminarla, también se eliminarán todas sus tareas asociadas. Esta acción no se puede deshacer.`
        : 'Esta acción no se puede deshacer.';

    const alerta =
      await this.alertController.create({
        header: '¿Eliminar esta materia?',
        message: mensaje,
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel'
          },
          {
            text: 'Eliminar',
            role: 'destructive',
            handler: () => {
              this.eliminarMateria(materia);
            }
          }
        ]
      });

    await alerta.present();
  }

  eliminarMateria(
    materia: Materia
  ): void {
    if (
      !this.esAdministrador ||
      this.eliminandoMateriaId !== null
    ) {
      return;
    }

    this.eliminandoMateriaId = materia.id;

    this.apiService
      .eliminarMateria(materia.id)
      .subscribe({
        next: () => {
          this.eliminandoMateriaId = null;

          this.mostrarToastMateria(
            'Materia eliminada correctamente',
            'success'
          );

          this.cargarMaterias();
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al eliminar la materia:',
            error
          );

          this.eliminandoMateriaId = null;

          this.mostrarToastMateria(
            error.error?.error ??
              'No se pudo eliminar la materia.',
            'danger'
          );
        }
      });
  }

  mostrarToastMateria(
    mensaje: string,
    color: 'success' | 'danger'
  ): void {
    this.toastMensaje = mensaje;
    this.toastColor = color;
    this.toastAbierto = true;
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