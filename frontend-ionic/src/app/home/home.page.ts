import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import {
  IonContent,
  IonItem,
  IonInput,
  IonButton,
  IonText,
  IonSpinner
} from '@ionic/angular/standalone';

import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    FormsModule,
    IonContent,
    IonItem,
    IonInput,
    IonButton,
    IonText,
    IonSpinner
  ]
})
export class HomePage {

  correo = '';
  password = '';

  cargando = false;
  mensaje = '';
  tipoMensaje: 'success' | 'danger' = 'danger';

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  iniciarSesion(): void {
    this.mensaje = '';

    const correoLimpio = this.correo.trim();

    if (!correoLimpio || !this.password) {
      this.tipoMensaje = 'danger';
      this.mensaje = 'Ingresa el correo y la contraseña.';
      return;
    }

    this.cargando = true;

    this.apiService
      .iniciarSesion(correoLimpio, this.password)
      .subscribe({
        next: (respuesta) => {
          this.apiService.guardarSesion(respuesta);
          this.cargando = false;

          this.router.navigateByUrl('/materias', {
            replaceUrl: true
          });
        },
        error: (error: HttpErrorResponse) => {
          console.error('Error al iniciar sesión:', error);

          this.tipoMensaje = 'danger';
          this.mensaje =
            error.error?.error ??
            'No se pudo conectar con el servidor.';

          this.cargando = false;
        }
      });
  }
}