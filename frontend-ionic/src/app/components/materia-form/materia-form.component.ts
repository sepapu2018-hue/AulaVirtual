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
  IonSpinner
} from '@ionic/angular/standalone';

import {
  Materia
} from '../../services/api.service';

export interface MateriaFormularioDatos {
  nombre: string;
  profesor: string;
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
    IonSpinner
  ]
})
export class MateriaFormComponent {

  @Input()
  guardando = false;

  private materiaActual: Materia | null = null;

  @Input()
  set materia(valor: Materia | null) {
    this.materiaActual = valor;

    if (valor) {
      this.nombre = valor.nombre;
      this.profesor = valor.profesor ?? '';
    } else {
      this.nombre = '';
      this.profesor = '';
    }

    this.mensajeError = '';
  }

  @Output()
  cancelarFormulario = new EventEmitter<void>();

  @Output()
  enviarFormulario =
    new EventEmitter<MateriaFormularioDatos>();

  nombre = '';
  profesor = '';
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
    const profesorLimpio = this.profesor.trim();

    if (!nombreLimpio) {
      this.mensajeError =
        'El nombre de la materia es obligatorio.';

      return;
    }

    this.mensajeError = '';

    this.enviarFormulario.emit({
      nombre: nombreLimpio,
      profesor: profesorLimpio
    });
  }
}