import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonSearchbar,
  IonSpinner,
  IonText
} from '@ionic/angular/standalone';

import {
  ApiService,
  NotaMateriaEstudiante,
  ResumenNotasMateria
} from '../../services/api.service';

@Component({
  selector: 'app-notas-materia',
  standalone: true,
  templateUrl: './notas-materia.component.html',
  styleUrls: ['./notas-materia.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonSearchbar,
    IonSpinner,
    IonText
  ]
})
export class NotasMateriaComponent implements OnInit {

  @Input({ required: true })
  materiaId!: number;

  @Input()
  materiaNombre = 'Materia';

  @Output()
  cerrarModal = new EventEmitter<void>();

  resumen: ResumenNotasMateria | null = null;
  misNotas: NotaMateriaEstudiante | null = null;

  busqueda = '';

  cargando = true;
  mensajeError = '';

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.cargarNotas();
  }

  get esDocente(): boolean {
    const rol = this.apiService.obtenerUsuario()?.rol;
    return rol === 'admin' || rol === 'profesor';
  }

  get estudiantesFiltrados(): NotaMateriaEstudiante[] {
    const estudiantes = this.resumen?.estudiantes ?? [];
    const texto = this.busqueda.trim().toLowerCase();

    if (!texto) {
      return estudiantes;
    }

    return estudiantes.filter(
      (estudiante) =>
        estudiante.nombre.toLowerCase().includes(texto) ||
        estudiante.correo.toLowerCase().includes(texto)
    );
  }

  cargarNotas(): void {
    this.cargando = true;
    this.mensajeError = '';

    const alTerminar = (): void => {
      this.cargando = false;
    };

    const alFallar = (error: HttpErrorResponse): void => {
      console.error('Error al cargar las notas:', error);

      this.mensajeError =
        error.error?.error ?? 'No se pudieron cargar las notas.';

      this.cargando = false;
    };

    if (this.esDocente) {
      this.apiService.obtenerNotasMateria(this.materiaId).subscribe({
        next: (resumen) => {
          this.resumen = resumen;
          alTerminar();
        },
        error: alFallar
      });
    } else {
      this.apiService.obtenerMisNotas(this.materiaId).subscribe({
        next: (misNotas) => {
          this.misNotas = misNotas;
          alTerminar();
        },
        error: alFallar
      });
    }
  }

  obtenerIniciales(nombre: string): string {
    return nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte.charAt(0))
      .join('')
      .toUpperCase();
  }

  cerrar(): void {
    this.cerrarModal.emit();
  }
}
