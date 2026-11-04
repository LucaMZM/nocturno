import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthStore } from '../store/auth.store';
import { environment } from '../../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  // Never attach credentials or CSRF headers to third-party requests.
  const api = environment.apiUrl.replace(/\/$/, '');
  if (request.url !== api && !request.url.startsWith(api + '/')) return next(request);
  const auth = inject(AuthStore);
  const router = inject(Router);
  const version = auth.getSessionVersion();
  const authorized = request.clone({ withCredentials: true,
    ...(!['GET', 'HEAD', 'OPTIONS'].includes(request.method) ? { setHeaders: { 'X-Nocturno-CSRF': '1' } } : {}) });
  if (/\/auth\/(login|register|refresh|logout)(?:\?|$)/.test(request.url)) return next(authorized);
  return next(authorized).pipe(catchError((error: unknown) => {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401 || version !== auth.getSessionVersion())
      return throwError(() => error);
    return from(auth.refresh()).pipe(switchMap((restored) => {
      if (version !== auth.getSessionVersion()) return throwError(() => error);
      // next(), not HttpClient: the retry cannot re-enter this interceptor.
      if (restored) return next(authorized);
      if (/\/api\/(?:cart|checkout|orders|tickets|dashboard|users|profile|me|payments)(?:\/|$)/.test(request.url)
        && !router.url.startsWith('/error/')) {
        void router.navigate(['/error/401'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    }));
  }));
};
