import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonButton
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-tarea-form',
  standalone: true,
  templateUrl: './tarea-form.component.html',
  styleUrls: ['./tarea-form.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonButton
  ]
})
export class TareaFormComponent {

  titulo = '';

  descripcion = '';

  prioridad = 'media';

  fechaLimite = '';

  guardar() {
    console.log({
      titulo: this.titulo,
      descripcion: this.descripcion,
      prioridad: this.prioridad,
      fechaLimite: this.fechaLimite
    });
  }

}