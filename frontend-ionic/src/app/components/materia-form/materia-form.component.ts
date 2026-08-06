import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

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
  IonSelect,
  IonSelectOption,
  IonSpinner
} from '@ionic/angular/standalone';

import {
  Materia,
  Profesor
} from '../../services/api.service';

export interface MateriaFormularioDatos {
  nombre: string;
  profesor_id: number;
}

@Component({
  selector: 'app-materia-form',
  standalone: true,
  templateUrl: './materia-form.component.html',
  styleUrls: ['./materia-form.component.scss'],
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
    IonSelect,
    IonSelectOption,
    IonSpinner
  ]
})
export class MateriaFormComponent {

  @Input()
  guardando = false;

  @Input()
  profesores: Profesor[] = [];

  private materiaActual: Materia | null = null;

  @Input()
  set materia(valor: Materia | null) {
    this.materiaActual = valor;

    if (valor) {
      this.nombre = valor.nombre;
      this.profesorId = valor.profesor_id;
    } else {
      this.nombre = '';
      this.profesorId = null;
    }

    this.mensajeError = '';
  }

  @Output()
  cancelarFormulario = new EventEmitter<void>();

  @Output()
  enviarFormulario =
    new EventEmitter<MateriaFormularioDatos>();

  nombre = '';
  profesorId: number | null = null;
  mensajeError = '';

  get editando(): boolean {
    return this.materiaActual !== null;
  }

  cancelar(): void {
    if (this.guardando) {
      return;
    }

    this.cancelarFormulario.emit();
  }

  guardar(): void {
    if (this.guardando) {
      return;
    }

    const nombreLimpio = this.nombre.trim();

    if (!nombreLimpio) {
      this.mensajeError =
        'El nombre de la materia es obligatorio.';

      return;
    }

    if (!this.profesorId) {
      this.mensajeError =
        'Selecciona el profesor de la materia.';

      return;
    }

    this.mensajeError = '';

    this.enviarFormulario.emit({
      nombre: nombreLimpio,
      profesor_id: this.profesorId
    });
  }
}
