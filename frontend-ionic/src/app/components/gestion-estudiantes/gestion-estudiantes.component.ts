import {
  Component,
  OnInit,
  output
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
  IonInput,
  IonSearchbar,
  IonSpinner,
  IonText
} from '@ionic/angular/standalone';

import {
  ApiService,
  Estudiante
} from '../../services/api.service';

@Component({
  selector: 'app-gestion-estudiantes',
  standalone: true,
  templateUrl:
    './gestion-estudiantes.component.html',
  styleUrls: [
    './gestion-estudiantes.component.scss'
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
    IonInput,
    IonSearchbar,
    IonSpinner,
    IonText
  ]
})

export class GestionEstudiantesComponent
  implements OnInit {

  readonly cerrarModal = output<void>();

  readonly aulaSeleccionada =
    output<Estudiante>();

  estudiantes: Estudiante[] = [];

  nombre = '';
  correo = '';
  password = '';

  busqueda = '';

  cargando = true;
  creando = false;

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

  get estudiantesFiltrados(): Estudiante[] {
    const texto =
      this.busqueda.trim().toLowerCase();

    if (!texto) {
      return this.estudiantes;
    }

    return this.estudiantes.filter(
      estudiante =>
        estudiante.nombre
          .toLowerCase()
          .includes(texto) ||
        estudiante.correo
          .toLowerCase()
          .includes(texto)
    );
  }

  get operacionEnProceso(): boolean {
    return (
      this.creando ||
      this.eliminandoEstudianteId !== null
    );
  }

  cargarEstudiantes(
    mensajeExito = ''
  ): void {
    this.cargando = true;

    this.apiService
      .obtenerEstudiantes()
      .subscribe({
        next: (estudiantes) => {
          this.estudiantes = estudiantes;
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

  crearCuenta(): void {
    if (this.creando) {
      return;
    }

    const nombre =
      this.nombre.trim();

    const correo =
      this.correo.trim().toLowerCase();

    const password =
      this.password;

    if (!nombre || !correo || !password) {
      this.tipoMensaje = 'danger';
      this.mensaje =
        'Nombre, correo y contraseña son obligatorios.';

      return;
    }

    if (!correo.includes('@')) {
      this.tipoMensaje = 'danger';
      this.mensaje =
        'Ingresa un correo electrónico válido.';

      return;
    }

    if (password.length < 6) {
      this.tipoMensaje = 'danger';
      this.mensaje =
        'La contraseña debe tener al menos 6 caracteres.';

      return;
    }

    this.creando = true;
    this.mensaje = '';

    this.apiService
      .crearEstudiante({
        nombre,
        correo,
        password
      })
      .subscribe({
        next: () => {
          this.nombre = '';
          this.correo = '';
          this.password = '';

          this.creando = false;

          this.cargarEstudiantes(
            'Cuenta creada correctamente.'
          );
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al crear estudiante:',
            error
          );

          this.creando = false;
          this.tipoMensaje = 'danger';

          this.mensaje =
            error.error?.error ??
            'No se pudo crear la cuenta.';
        }
      });
  }

  async confirmarEliminar(
    estudiante: Estudiante
  ): Promise<void> {
    if (this.operacionEnProceso) {
      return;
    }

    const alerta =
      await this.alertController.create({
        header: '¿Eliminar esta cuenta?',
        message:
          `Se eliminará la cuenta de ${estudiante.nombre} y la información asociada. Esta acción no se puede deshacer.`,
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel'
          },
          {
            text: 'Eliminar',
            role: 'destructive',
            handler: () => {
              this.eliminarCuenta(
                estudiante
              );
            }
          }
        ]
      });

    await alerta.present();
  }

  eliminarCuenta(
    estudiante: Estudiante
  ): void {
    if (this.operacionEnProceso) {
      return;
    }

    this.eliminandoEstudianteId =
      estudiante.id;

    this.mensaje = '';

    this.apiService
      .eliminarEstudiante(estudiante.id)
      .subscribe({
        next: () => {
          this.eliminandoEstudianteId =
            null;

          this.cargarEstudiantes(
            'Cuenta eliminada correctamente.'
          );
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al eliminar estudiante:',
            error
          );

          this.eliminandoEstudianteId =
            null;

          this.tipoMensaje = 'danger';

          this.mensaje =
            error.error?.error ??
            'No se pudo eliminar la cuenta.';
        }
      });
  }

  obtenerIniciales(
    nombre: string
  ): string {
    return nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(
        palabra =>
          palabra.charAt(0)
      )
      .join('')
      .toUpperCase();
  }

  consultarAula(
    estudiante: Estudiante
  ): void {
    if (this.operacionEnProceso) {
      return;
    }

    this.aulaSeleccionada.emit(estudiante);
  }

  cerrar(): void {
    if (this.operacionEnProceso) {
      return;
    }

    this.cerrarModal.emit();
  }
}