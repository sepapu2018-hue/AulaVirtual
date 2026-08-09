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
  IonButton,
  IonInput,
  IonSearchbar,
  IonSpinner,
  IonText
} from '@ionic/angular/standalone';

import { forkJoin } from 'rxjs';

import {
  ApiService,
  Administrador,
  Estudiante,
  Profesor
} from '../../services/api.service';

type TipoCuenta = 'estudiante' | 'profesor' | 'administrador';

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
    IonButton,
    IonInput,
    IonSearchbar,
    IonSpinner,
    IonText
  ]
})

export class GestionEstudiantesComponent
  implements OnInit {

  readonly aulaSeleccionada =
    output<Estudiante>();

  tipoListado: TipoCuenta = 'estudiante';
  tipoNuevaCuenta: TipoCuenta = 'estudiante';

  estudiantes: Estudiante[] = [];
  profesores: Profesor[] = [];
  administradores: Administrador[] = [];

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

  get listaActual(): (Estudiante | Profesor | Administrador)[] {
    if (this.tipoListado === 'estudiante') {
      return this.estudiantes;
    }

    if (this.tipoListado === 'profesor') {
      return this.profesores;
    }

    return this.administradores;
  }

  get usuarioActualId(): number | null {
    return this.apiService.obtenerUsuario()?.id ?? null;
  }

  get listaFiltrada(): (Estudiante | Profesor | Administrador)[] {
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

    forkJoin({
      estudiantes: this.apiService.obtenerEstudiantes(),
      profesores: this.apiService.obtenerProfesores(),
      administradores: this.apiService.obtenerAdministradores()
    }).subscribe({
      next: ({ estudiantes, profesores, administradores }) => {
        this.estudiantes = estudiantes;
        this.profesores = profesores;
        this.administradores = administradores;
        this.cargando = false;

        if (mensajeExito) {
          this.tipoMensaje = 'success';
          this.mensaje = mensajeExito;
        }
      },
      error: (error: HttpErrorResponse) => {
        console.error(
          'Error al cargar cuentas:',
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
        : this.tipoNuevaCuenta === 'administrador'
        ? this.apiService.crearAdministrador(datos)
        : this.apiService.crearEstudiante(datos);

    const mensajesExito: Record<TipoCuenta, string> = {
      profesor: 'Cuenta de profesor creada correctamente.',
      administrador: 'Cuenta de administrador creada correctamente.',
      estudiante: 'Cuenta de estudiante creada correctamente.'
    };

    peticion.subscribe({
      next: () => {
        this.nombre = '';
        this.correo = '';
        this.password = '';

        this.creando = false;

        this.tipoListado = this.tipoNuevaCuenta;

        this.cargarCuentas(
          mensajesExito[this.tipoNuevaCuenta]
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
    cuenta: Estudiante | Profesor | Administrador
  ): Promise<void> {
    if (this.operacionEnProceso) {
      return;
    }

    if (cuenta.id === this.usuarioActualId) {
      this.tipoMensaje = 'danger';
      this.mensaje = 'No puedes eliminar tu propia cuenta.';
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
    cuenta: Estudiante | Profesor | Administrador
  ): void {
    if (this.operacionEnProceso) {
      return;
    }

    this.eliminandoId = cuenta.id;
    this.mensaje = '';

    const peticion =
      this.tipoListado === 'profesor'
        ? this.apiService.eliminarProfesor(cuenta.id)
        : this.tipoListado === 'administrador'
        ? this.apiService.eliminarAdministrador(cuenta.id)
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
}
