import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthStore } from '../store/auth.store';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const isApi = /^\/api(?:\/|$)/.test(request.url);
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
  const prepare = (): HttpRequest<unknown> => {
    if (!isApi) return request;
    const csrfToken = isMutation ? auth.csrfToken() : null;
    // Browser-managed HttpOnly cookies; never put Authorization Bearer in JS.
    return request.clone({ withCredentials: true,
      ...(csrfToken ? { setHeaders: { 'X-Nocturno-CSRF': csrfToken } } : {}) });
  };
  if (!isApi || /\/api\/auth\//.test(request.url)) return next(prepare());
  return next(prepare()).pipe(catchError((error: unknown) => {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !auth.user())
      return throwError(() => error);
    return from(auth.refresh()).pipe(switchMap((recovered) => {
      if (recovered) return next(prepare());
      if (/\/api\/(?:cart|checkout|orders|tickets|dashboard|users|profile|me|payments)(?:\/|$)/.test(request.url)
        && !router.url.startsWith('/error/')) {
        void router.navigate(['/error/401'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    }));
  }));
};
