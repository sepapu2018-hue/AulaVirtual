import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonSpinner
} from '@ionic/angular/standalone';

import { Tarea } from '../../services/api.service';

export interface TareaFormularioDatos {
  titulo: string;
  descripcion: string;
  prioridad: 'alta' | 'media' | 'baja';
  fecha_limite: string | null;
}

@Component({
  selector: 'app-tarea-form',
  standalone: true,
  templateUrl: './tarea-form.component.html',
  styleUrls: ['./tarea-form.component.scss'],
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
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonSpinner
  ]
})
export class TareaFormComponent {

  @Input()
  guardando = false;

  private tareaActual: Tarea | null = null;

  @Input()
  set tarea(valor: Tarea | null) {
    this.tareaActual = valor;

    if (valor) {
      this.titulo = valor.titulo;
      this.descripcion = valor.descripcion ?? '';
      this.prioridad = valor.prioridad ?? 'media';

      this.fechaLimite = valor.fecha_limite
        ? valor.fecha_limite.split('T')[0]
        : '';
    } else {
      this.titulo = '';
      this.descripcion = '';
      this.prioridad = 'media';
      this.fechaLimite = '';
    }

    this.mensajeError = '';
  }

  get editando(): boolean {
    return this.tareaActual !== null;
  }

  @Output()
  cancelarFormulario = new EventEmitter<void>();

  @Output()
  enviarFormulario =
    new EventEmitter<TareaFormularioDatos>();

  titulo = '';
  descripcion = '';

  prioridad: 'alta' | 'media' | 'baja' =
    'media';

  fechaLimite = '';
  mensajeError = '';

  cancelar(): void {
    this.cancelarFormulario.emit();
  }

  guardar(): void {
    if (this.guardando) {
      return;
    }
    
    const tituloLimpio = this.titulo.trim();

    if (!tituloLimpio) {
      this.mensajeError =
        'El título de la tarea es obligatorio.';

      return;
    }

    this.mensajeError = '';

    this.enviarFormulario.emit({
      titulo: tituloLimpio,
      descripcion: this.descripcion.trim(),
      prioridad: this.prioridad,
      fecha_limite: this.fechaLimite || null
    });
  }
}