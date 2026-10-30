import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthStore } from '../store/auth.store';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const token = auth.accessToken();
  const authorized = token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
  if (request.url.includes('/auth/')) return next(authorized);
  return next(authorized).pipe(catchError((error: unknown) => {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !token)
      return throwError(() => error);
    return from(auth.refresh()).pipe(switchMap((newToken) => {
      if (newToken) return next(request.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }));
      // A public request can carry an expired token too; redirect only for private APIs.
      if (/\/api\/(?:cart|checkout|orders|tickets|dashboard|users|profile|me|payments)(?:\/|$)/.test(request.url)
        && !router.url.startsWith('/error/')) {
        void router.navigate(['/error/401'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    }));
  }));
};
