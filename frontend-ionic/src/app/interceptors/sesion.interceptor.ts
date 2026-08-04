import {
  HttpErrorResponse,
  HttpInterceptorFn
} from '@angular/common/http';

import { inject } from '@angular/core';
import { Router } from '@angular/router';

import {
  catchError,
  throwError
} from 'rxjs';

export const sesionInterceptor:
  HttpInterceptorFn = (
    request,
    next
  ) => {
    const router = inject(Router);

    return next(request).pipe(
      catchError(
        (error: HttpErrorResponse) => {
          const esInicioSesion =
            request.url.includes(
              '/auth/login'
            );

          if (
            error.status === 401 &&
            !esInicioSesion
          ) {
            localStorage.removeItem(
              'gt_token'
            );

            localStorage.removeItem(
              'gt_usuario'
            );

            sessionStorage.removeItem(
              'gt_modo_aula'
            );

            void router.navigate(
              ['/home'],
              {
                replaceUrl: true
              }
            );
          }

          return throwError(
            () => error
          );
        }
      )
    );
  };