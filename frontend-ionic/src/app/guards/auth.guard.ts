import { inject } from '@angular/core';

import {
  CanActivateFn,
  Router
} from '@angular/router';

import {
  ApiService
} from '../services/api.service';

export const authGuard: CanActivateFn = () => {
  const apiService = inject(ApiService);
  const router = inject(Router);

  const token = apiService.obtenerToken();
  const usuario = apiService.obtenerUsuario();

  if (!token || !usuario) {
    apiService.cerrarSesion();

    return router.createUrlTree([
      '/home'
    ]);
  }

  return true;
};

export const adminGuard: CanActivateFn = () => {
  const apiService = inject(ApiService);
  const router = inject(Router);

  const usuario = apiService.obtenerUsuario();

  if (!usuario || usuario.rol !== 'admin') {
    return router.createUrlTree([
      '/materias'
    ]);
  }

  return true;
};

export const guestGuard: CanActivateFn = () => {
  const apiService = inject(ApiService);
  const router = inject(Router);

  const token = apiService.obtenerToken();
  const usuario = apiService.obtenerUsuario();

  if (token && usuario) {
    return router.createUrlTree([
      '/materias'
    ]);
  }

  return true;
};