import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent
} from '@ionic/angular/standalone';

import {
  Tarea
} from '../../services/api.service';

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
    IonContent
  ]
})
export class TareaDetalleComponent {

  @Input({ required: true })
  tarea!: Tarea;

  @Output()
  cerrarDetalle = new EventEmitter<void>();

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
}