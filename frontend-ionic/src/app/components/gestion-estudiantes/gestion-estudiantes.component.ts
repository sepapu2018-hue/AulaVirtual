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
  Estudiante,
  Profesor
} from '../../services/api.service';

type TipoCuenta = 'estudiante' | 'profesor';

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

  tipoListado: TipoCuenta = 'estudiante';
  tipoNuevaCuenta: TipoCuenta = 'estudiante';

  estudiantes: Estudiante[] = [];
  profesores: Profesor[] = [];

  nombre = '';
  correo = '';
  password = '';

  busqueda = '';

  cargando = true;
  creando = false;

  eliminandoId: number | null = null;

  mensaje = '';

  tipoMensaje: 'success' | 'danger' =
    'success';

  constructor(
    private apiService: ApiService,
    private alertController: AlertController
  ) {}

  ngOnInit(): void {
    this.cargarCuentas();
  }

  get listaActual(): (Estudiante | Profesor)[] {
    return this.tipoListado === 'estudiante'
      ? this.estudiantes
      : this.profesores;
  }

  get listaFiltrada(): (Estudiante | Profesor)[] {
    const texto =
      this.busqueda.trim().toLowerCase();

    if (!texto) {
      return this.listaActual;
    }

    return this.listaActual.filter(
      cuenta =>
        cuenta.nombre
          .toLowerCase()
          .includes(texto) ||
        cuenta.correo
          .toLowerCase()
          .includes(texto)
    );
  }

  get operacionEnProceso(): boolean {
    return (
      this.creando ||
      this.eliminandoId !== null
    );
  }

  cambiarListado(tipo: TipoCuenta): void {
    this.tipoListado = tipo;
  }

  cargarCuentas(
    mensajeExito = ''
  ): void {
    this.cargando = true;

    this.apiService
      .obtenerEstudiantes()
      .subscribe({
        next: (estudiantes) => {
          this.estudiantes = estudiantes;

          this.apiService
            .obtenerProfesores()
            .subscribe({
              next: (profesores) => {
                this.profesores = profesores;
                this.cargando = false;

                if (mensajeExito) {
                  this.tipoMensaje = 'success';
                  this.mensaje = mensajeExito;
                }
              },
              error: (error: HttpErrorResponse) => {
                console.error(
                  'Error al cargar profesores:',
                  error
                );

                this.cargando = false;
              }
            });
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
            'No se pudo cargar la lista de cuentas.';
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

    const datos = { nombre, correo, password };

    const peticion =
      this.tipoNuevaCuenta === 'profesor'
        ? this.apiService.crearProfesor(datos)
        : this.apiService.crearEstudiante(datos);

    peticion.subscribe({
      next: () => {
        this.nombre = '';
        this.correo = '';
        this.password = '';

        this.creando = false;

        this.tipoListado = this.tipoNuevaCuenta;

        this.cargarCuentas(
          this.tipoNuevaCuenta === 'profesor'
            ? 'Cuenta de profesor creada correctamente.'
            : 'Cuenta de estudiante creada correctamente.'
        );
      },
      error: (error: HttpErrorResponse) => {
        console.error(
          'Error al crear la cuenta:',
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
    cuenta: Estudiante | Profesor
  ): Promise<void> {
    if (this.operacionEnProceso) {
      return;
    }

    const alerta =
      await this.alertController.create({
        header: '¿Eliminar esta cuenta?',
        message:
          `Se eliminará la cuenta de ${cuenta.nombre} y la información asociada. Esta acción no se puede deshacer.`,
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel'
          },
          {
            text: 'Eliminar',
            role: 'destructive',
            handler: () => {
              this.eliminarCuenta(cuenta);
            }
          }
        ]
      });

    await alerta.present();
  }

  eliminarCuenta(
    cuenta: Estudiante | Profesor
  ): void {
    if (this.operacionEnProceso) {
      return;
    }

    this.eliminandoId = cuenta.id;
    this.mensaje = '';

    const peticion =
      this.tipoListado === 'profesor'
        ? this.apiService.eliminarProfesor(cuenta.id)
        : this.apiService.eliminarEstudiante(cuenta.id);

    peticion.subscribe({
      next: () => {
        this.eliminandoId = null;

        this.cargarCuentas(
          'Cuenta eliminada correctamente.'
        );
      },
      error: (error: HttpErrorResponse) => {
        console.error(
          'Error al eliminar la cuenta:',
          error
        );

        this.eliminandoId = null;

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
    if (
      this.operacionEnProceso ||
      this.tipoListado !== 'estudiante'
    ) {
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
