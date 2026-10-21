import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorBody, ApiProblem } from '../../core/models/api.model';

export function toApiProblem(error: unknown, fallback: string): ApiProblem {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as Partial<ApiErrorBody> | null;
    const code = body?.error?.code ?? 'HTTP_ERROR';
    if (error.status === 0) return { code: 'NETWORK_ERROR', message: 'No podemos conectar con el servidor. Comprueba que el backend esté en marcha.' };
    if (error.status === 401) return { code, message: 'Tu sesión ha caducado. Inicia sesión de nuevo.' };
    if (error.status === 403) return { code, message: 'No tienes permiso para realizar esta acción.' };
    if (error.status === 503) return { code, message: 'El servicio no está disponible ahora. Inténtalo más tarde.' };
    if (error.status >= 500) return { code, message: 'Ha ocurrido un error inesperado. Inténtalo más tarde.' };
    if (code === 'USER_NOT_FOUND') return { code, message: 'No encontramos el usuario de demostración. Ejecuta el seed del backend.' };
    if (code === 'EVENT_NOT_FOUND') return { code, message: 'Este evento ya no está disponible.' };
    if (code === 'DUPLICATE_FAVORITE') return { code, message: 'Este evento ya está guardado.' };
    return { code, message: fallback };
  }
  return { code: 'UNKNOWN_ERROR', message: fallback };
}
