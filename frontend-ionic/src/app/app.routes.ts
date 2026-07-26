import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () =>
      import('./home/home.page').then(
        (m) => m.HomePage
      )
  },
  {
    path: 'materias',
    loadComponent: () =>
      import('./pages/materias/materias.page').then(
        (m) => m.MateriasPage
      )
  },
  {
    path: 'materias/:materiaId/tareas',
    loadComponent: () =>
      import('./pages/tareas/tareas.page').then(
        (m) => m.TareasPage
      )
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  }
];