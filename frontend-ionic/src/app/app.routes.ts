import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'home',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./home/home.page'
    ).then(
        (modulo) => modulo.HomePage
      )
  },
  {
    path: 'materias',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/materias/materias.page').then(
        (modulo) => modulo.MateriasPage
      )
  },
  {
    path: 'materias/:materiaId/tareas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/tareas/tareas.page').then(
        (modulo) => modulo.TareasPage
      )
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  }
];