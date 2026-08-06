import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonTextarea, IonSpinner, IonText, IonProgressBar } from '@ionic/angular/standalone';
import { ApiService, Comentario, RegistroEntrega, TareaDetalle } from '../../services/api.service';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';


@Component({
  selector: 'app-tarea-detalle',
  standalone: true,
  templateUrl: './tarea-detalle.component.html',
  styleUrls: ['./tarea-detalle.component.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    FormsModule,
    IonTextarea,
    IonSpinner,
    IonText,
    IonProgressBar
  ]
})

export class TareaDetalleComponent implements OnInit {

  @Input({ required: true })
  tarea!: TareaDetalle;

  @Output()
  cerrarDetalle = new EventEmitter<void>();
  comentarios: Comentario[] = [];
  comentarioContenido = '';
  cargandoComentarios = true;
  publicandoComentario = false;
  eliminandoComentarioId: number | null = null;
  mensajeComentarios = '';
  registroEntregas: RegistroEntrega[] = [];
  cargandoRegistro = false;
  guardandoNotaUsuarioId: number | null = null;
  mensajeRegistro = '';
  tipoMensajeRegistro: 'success' | 'danger' = 'success';

  @Output()
  tareaActualizada = new EventEmitter<void>();
  usuario = this.apiService.obtenerUsuario();
  archivoSeleccionado: File | null = null;
  subiendoArchivo = false;
  progresoArchivo = 0;
  eliminandoArchivoId: number | null = null;
  mensajeArchivo = '';
  tipoMensajeArchivo: 'success' | 'danger' = 'success';

  constructor(
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.cargarComentarios();

    if (this.esDocente) {
      this.cargarRegistroEntregas();
    }
  }

  get esAdministrador(): boolean {
    return this.usuario?.rol === 'admin';
  }

  get esDocente(): boolean {
    return this.usuario?.rol === 'admin' || this.usuario?.rol === 'profesor';
  }

  get tieneCalificacion(): boolean {
    return (
      this.tarea.mi_nota?.nota !== null &&
      this.tarea.mi_nota?.nota !== undefined
    );
  }

  get plazoVencido(): boolean {
    if (!this.tarea.fecha_limite) {
      return false;
    }

    const fechaTexto =
      this.tarea.fecha_limite.split('T')[0];

    const fechaLimite = new Date(
      `${fechaTexto}T00:00:00`
    );

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return fechaLimite < hoy;
  }

  get entregaBloqueada(): boolean {
    return (
      !this.esAdministrador &&
      (
        this.tieneCalificacion ||
        this.plazoVencido
      )
    );
  }

  get mensajeBloqueoArchivo(): string {
    if (this.tieneCalificacion) {
      return 'Esta tarea ya fue calificada. No puedes modificar tu entrega.';
    }

    return 'El plazo de entrega ya venció. No puedes modificar tu entrega.';
  }

  obtenerUrlArchivo(ruta: string): string {
    return this.apiService.obtenerUrlArchivo(ruta)
  }

  seleccionarArchivo(evento: Event): void {
    const input =
      evento.target as HTMLInputElement;

    const archivo = input.files?.[0];

    input.value = '';

    if (!archivo) {
      return;
    }

    this.prepararArchivo(archivo);
  }

  permitirSoltarArchivo(evento: DragEvent): void {
    evento.preventDefault();
  }

  soltarArchivo(evento: DragEvent): void {
    evento.preventDefault();

    const archivo =
      evento.dataTransfer?.files?.[0];

    if (!archivo) {
      return;
    }

    this.prepararArchivo(archivo);
  }

  prepararArchivo(archivo: File): void {
    const limite = 5 * 1024 * 1024;

    if (archivo.size > limite) {
      this.tipoMensajeArchivo = 'danger';
      this.mensajeArchivo =
        'El archivo supera el tamaño máximo permitido de 5 MB.';

      return;
    }

    this.archivoSeleccionado = archivo;
    this.progresoArchivo = 0;
    this.mensajeArchivo = '';
  }

  cancelarArchivo(): void {
    if (this.subiendoArchivo) {
      return;
    }

    this.archivoSeleccionado = null;
    this.progresoArchivo = 0;
    this.mensajeArchivo = '';
  }

  subirArchivo(): void {
    if (
      !this.archivoSeleccionado ||
      this.subiendoArchivo
    ) {
      return;
    }

    this.subiendoArchivo = true;
    this.progresoArchivo = 0;
    this.mensajeArchivo = '';

    this.apiService
      .subirArchivoTarea(
        this.tarea.id,
        this.archivoSeleccionado
      )
      .subscribe({
        next: (evento) => {
          if (
            evento.type ===
            HttpEventType.UploadProgress
          ) {
            const total = evento.total ?? 0;

            this.progresoArchivo = total
              ? Math.round(
                  100 * evento.loaded / total
                )
              : 0;
          }

          if (
            evento.type ===
            HttpEventType.Response
          ) {
            this.subiendoArchivo = false;
            this.archivoSeleccionado = null;
            this.progresoArchivo = 100;

            this.tipoMensajeArchivo = 'success';
            this.mensajeArchivo =
              'Archivo guardado correctamente.';

            this.recargarDetalle();
          }
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al subir archivo:',
            error
          );

          this.subiendoArchivo = false;
          this.progresoArchivo = 0;

          this.tipoMensajeArchivo = 'danger';
          this.mensajeArchivo =
            error.error?.error ??
            'No se pudo subir el archivo.';
        }
      });
  }

  eliminarArchivo(archivoId: number): void {
    if (this.eliminandoArchivoId !== null) {
      return;
    }

    this.eliminandoArchivoId = archivoId;
    this.mensajeArchivo = '';

    this.apiService
      .eliminarArchivoTarea(
        this.tarea.id,
        archivoId
      )
      .subscribe({
        next: () => {
          this.eliminandoArchivoId = null;

          this.tipoMensajeArchivo = 'success';
          this.mensajeArchivo =
            'Archivo eliminado correctamente.';

          this.recargarDetalle();
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al eliminar archivo:',
            error
          );

          this.eliminandoArchivoId = null;

          this.tipoMensajeArchivo = 'danger';
          this.mensajeArchivo =
            error.error?.error ??
            'No se pudo eliminar el archivo.';
        }
      });
  }

  recargarDetalle(): void {
    this.apiService
      .obtenerDetalleTarea(this.tarea.id)
      .subscribe({
        next: (detalle) => {
          this.tarea = detalle;
          this.tareaActualizada.emit();
        },
        error: (error) => {
          console.error(
            'Error al actualizar detalle:',
            error
          );
        }
      });
  }

  cerrar(): void {
    this.cerrarDetalle.emit();
  }

  obtenerTextoPrioridad(): string {
    const nombres = {
      alta: 'Alta',
      media: 'Media',
      baja: 'Baja'
    };

    return nombres[this.tarea.prioridad];
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
        month: 'long',
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
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    ).format(new Date(fecha));
  }

  estaVencida(): boolean {
    if (
      this.tarea.completada ||
      !this.tarea.fecha_limite
    ) {
      return false;
    }

    const fechaTexto =
      this.tarea.fecha_limite.split('T')[0];

    const fechaLimite = new Date(
      `${fechaTexto}T00:00:00`
    );

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return fechaLimite < hoy;
  }

  cargarComentarios(): void {
    this.cargandoComentarios = true;
    this.mensajeComentarios = '';

    this.apiService
      .obtenerComentarios(this.tarea.id)
      .subscribe({
        next: (comentarios) => {
          this.comentarios = comentarios;
          this.cargandoComentarios = false;
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al cargar comentarios:',
            error
          );

          this.mensajeComentarios =
            error.error?.error ??
            'No se pudieron cargar los comentarios.';

          this.cargandoComentarios = false;
        }
      });
  }

  publicarComentario(): void {
    const contenido =
      this.comentarioContenido.trim();

    if (!contenido) {
      this.mensajeComentarios =
        'Escribe un comentario antes de publicarlo.';

      return;
    }

    if (this.publicandoComentario) {
      return;
    }

    this.publicandoComentario = true;
    this.mensajeComentarios = '';

    this.apiService
      .crearComentario(
        this.tarea.id,
        contenido
      )
      .subscribe({
        next: () => {
          this.comentarioContenido = '';
          this.publicandoComentario = false;

          this.cargarComentarios();
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al publicar comentario:',
            error
          );

          this.mensajeComentarios =
            error.error?.error ??
            'No se pudo publicar el comentario.';

          this.publicandoComentario = false;
        }
      });
  }

  eliminarComentario(
    comentario: Comentario
  ): void {
    if (this.eliminandoComentarioId !== null) {
      return;
    }

    this.eliminandoComentarioId =
      comentario.id;

    this.apiService
      .eliminarComentario(comentario.id)
      .subscribe({
        next: () => {
          this.eliminandoComentarioId = null;

          this.cargarComentarios();
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al eliminar comentario:',
            error
          );

          this.mensajeComentarios =
            error.error?.error ??
            'No se pudo eliminar el comentario.';

          this.eliminandoComentarioId = null;
        }
      });
  }

  obtenerTextoRol(
    comentario: Comentario
  ): string {
    if (comentario.autor_rol === 'admin' || comentario.autor_rol === 'profesor') {
      return 'Profesor';
    }

    return 'Estudiante';
  }

  cargarRegistroEntregas(): void {
    if (!this.esDocente) {
      return;
    }

    this.cargandoRegistro = true;
    this.mensajeRegistro = '';

    this.apiService
      .obtenerRegistroEntregas(this.tarea.id)
      .subscribe({
        next: (registro) => {
          this.registroEntregas = registro;
          this.cargandoRegistro = false;
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al cargar el registro:',
            error
          );

          this.mensajeRegistro =
            error.error?.error ??
            'No se pudo cargar el registro de entregas.';

          this.tipoMensajeRegistro = 'danger';
          this.cargandoRegistro = false;
        }
      });
  }

  guardarNota(
    registro: RegistroEntrega
  ): void {
    if (
      this.guardandoNotaUsuarioId !== null
    ) {
      return;
    }

    const valorOriginal = registro.nota;

    const nota =
      valorOriginal === '' ||
      valorOriginal === null ||
      valorOriginal === undefined
        ? null
        : Number(valorOriginal);

    if (
      nota !== null &&
      (
        Number.isNaN(nota) ||
        nota < 0 ||
        nota > 10
      )
    ) {
      this.tipoMensajeRegistro = 'danger';
      this.mensajeRegistro =
        'La nota debe estar entre 0 y 10.';

      return;
    }

    this.guardandoNotaUsuarioId =
      registro.usuario_id;

    this.mensajeRegistro = '';

    this.apiService
      .guardarNotaTarea(
        this.tarea.id,
        registro.usuario_id,
        nota
      )
      .subscribe({
        next: () => {
          registro.nota = nota;

          this.guardandoNotaUsuarioId = null;

          this.tipoMensajeRegistro = 'success';
          this.mensajeRegistro =
            `Nota de ${registro.nombre} guardada correctamente.`;
        },
        error: (error: HttpErrorResponse) => {
          console.error(
            'Error al guardar la nota:',
            error
          );

          this.guardandoNotaUsuarioId = null;

          this.tipoMensajeRegistro = 'danger';
          this.mensajeRegistro =
            error.error?.error ??
            'No se pudo guardar la nota.';
        }
      });
  }
}