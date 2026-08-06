import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import {
  AlertController
} from '@ionic/angular';

import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText
} from '@ionic/angular/standalone';

import { forkJoin, of } from 'rxjs';

import {
  ApiService,
  Estudiante
} from '../../services/api.service';

@Component({
  selector: 'app-materia-estudiantes',
  standalone: true,
  templateUrl:
    './materia-estudiantes.component.html',
  styleUrls: [
    './materia-estudiantes.component.scss'
  ],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonText
  ]
})
export class MateriaEstudiantesComponent
  implements OnInit {

  @Input({ required: true })
  materiaId!: number;

  @Input()
  materiaNombre = 'Materia';

  @Output()
  cerrarModal = new EventEmitter<void>();

  inscritos: Estudiante[] = [];
  disponibles: Estudiante[] = [];

  estudianteSeleccionadoId:
    number | null = null;

  cargando = true;
  agregando = false;

  eliminandoEstudianteId:
    number | null = null;

  mensaje = '';

  tipoMensaje: 'success' | 'danger' =
    'success';

  constructor(
    private apiService: ApiService,
    private alertController: AlertController
  ) {}

  ngOnInit(): void {
    this.cargarEstudiantes();
  }

  get esAdministrador(): boolean {
    return (
      this.apiService.obtenerUsuario()?.rol ===
      'admin'
    );
  }

  get esDocente(): boolean {
    const rol = this.apiService.obtenerUsuario()?.rol;
    return rol === 'admin' || rol === 'profesor';
  }

  cargarEstudiantes(
    mensajeExito = ''
  ): void {
    if (!this.esDocente) {
      this.cargando = false;
      this.tipoMensaje = 'danger';
      this.mensaje =
        'No tienes permiso para ver los estudiantes de esta materia.';

      return;
    }

    this.cargando = true;

    forkJoin({
      inscritos:
        this.apiService
          .obtenerEstudiantesMateria(
            this.materiaId
          ),

      // Solo el admin gestiona inscripciones, así que solo él
      // necesita la lista completa de estudiantes disponibles.
      todos: this.esAdministrador
        ? this.apiService.obtenerEstudiantes()
        : of<Estudiante[]>([])
    }).subscribe({
      next: ({ inscritos, todos }) => {
        this.inscritos = inscritos;

        const inscritosIds = new Set(
          inscritos.map(
            estudiante => estudiante.id
          )
        );

        this.disponibles = todos.filter(
          estudiante =>
            !inscritosIds.has(estudiante.id)
        );

        if (
          this.estudianteSeleccionadoId !==
            null &&
          !this.disponibles.some(
            estudiante =>
              estudiante.id ===
              this.estudianteSeleccionadoId
          )
        ) {
          this.estudianteSeleccionadoId =
            null;
        }

        this.cargando = false;

        if (mensajeExito) {
          this.tipoMensaje = 'success';
          this.mensaje = mensajeExito;
        }
      },
      error: (error: HttpErrorResponse) => {
        console.error(
          'Error al cargar estudiantes:',
          error
        );

        this.cargando = false;
        this.tipoMensaje = 'danger';

        this.mensaje =
          error.error?.error ??
          'No se pudo cargar la lista de estudiantes.';
      }
    });
  }

  agregarEstudiante(): void {
    if (
      !this.esAdministrador ||
      this.agregando
    ) {
      return;
    }

    if (
      this.estudianteSeleccionadoId ===
      null
    ) {
      this.tipoMensaje = 'danger';
      this.mensaje =
        'Selecciona un estudiante.';

      return;
    }

    this.agregando = true;
    this.mensaje = '';

    const usuarioId =
      this.estudianteSeleccionadoId;

    this.apiService
      .inscribirEstudiante(
        this.materiaId,
        usuarioId
      )
      .subscribe({
        next: () => {
          this.agregando = false;

          this.estudianteSeleccionadoId =
            null;

          this.cargarEstudiantes(
            'Estudiante agregado correctamente.'
          );
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al inscribir estudiante:',
            error
          );

          this.agregando = false;
          this.tipoMensaje = 'danger';

          this.mensaje =
            error.error?.error ??
            'No se pudo agregar al estudiante.';
        }
      });
  }

  async confirmarQuitarEstudiante(
    estudiante: Estudiante
  ): Promise<void> {
    if (
      !this.esAdministrador ||
      this.eliminandoEstudianteId !== null
    ) {
      return;
    }

    const alerta =
      await this.alertController.create({
        header: '¿Quitar estudiante?',
        message:
          `${estudiante.nombre} dejará de pertenecer a esta materia.`,
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel'
          },
          {
            text: 'Quitar',
            role: 'destructive',
            handler: () => {
              this.quitarEstudiante(
                estudiante
              );
            }
          }
        ]
      });

    await alerta.present();
  }

  quitarEstudiante(
    estudiante: Estudiante
  ): void {
    if (
      !this.esAdministrador ||
      this.eliminandoEstudianteId !== null
    ) {
      return;
    }

    this.eliminandoEstudianteId =
      estudiante.id;

    this.mensaje = '';

    this.apiService
      .quitarEstudianteMateria(
        this.materiaId,
        estudiante.id
      )
      .subscribe({
        next: () => {
          this.eliminandoEstudianteId =
            null;

          this.cargarEstudiantes(
            'Estudiante retirado de la materia.'
          );
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al quitar estudiante:',
            error
          );

          this.eliminandoEstudianteId =
            null;

          this.tipoMensaje = 'danger';

          this.mensaje =
            error.error?.error ??
            'No se pudo quitar al estudiante.';
        }
      });
  }

  obtenerIniciales(nombre: string): string {
    return nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(parte => parte.charAt(0))
      .join('')
      .toUpperCase();
  }

  cerrar(): void {
    if (
      this.agregando ||
      this.eliminandoEstudianteId !== null
    ) {
      return;
    }

    this.cerrarModal.emit();
  }
}