import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthStore } from './store/auth.store';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthStore);
  const token = auth.accessToken();
  const authorized = token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
  if (request.url.includes('/auth/')) return next(authorized);
  return next(authorized).pipe(catchError((error: unknown) => {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !token)
      return throwError(() => error);
    return from(auth.refresh()).pipe(switchMap((newToken) =>
      newToken
        ? next(request.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }))
        : throwError(() => error)));
  }));
};
