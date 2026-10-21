import { Component, computed, inject, input } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

const errors = {
  '401': { title: 'Inicia sesión para continuar.', message: 'Tu sesión no está disponible. Accede a tu cuenta para seguir.', action: 'Iniciar sesión' },
  '403': { title: 'Esta puerta no se abre con tu cuenta.', message: 'No tienes permiso para entrar en esta sección.', action: 'Volver al inicio' },
  '404': { title: 'Este lugar no existe.', message: 'La página o el evento que buscas no está disponible.', action: 'Volver al inicio' },
  '500': { title: 'La noche se ha detenido un momento.', message: 'Ha ocurrido un error inesperado. Puedes intentarlo de nuevo.', action: 'Reintentar' },
  '503': { title: 'Volvemos en unos instantes.', message: 'El servicio no está disponible ahora mismo. Inténtalo más tarde.', action: 'Reintentar' },
} as const;

type ErrorCode = keyof typeof errors;

@Component({
  selector: 'app-error-page',
  imports: [RouterLink],
  template: `
    <main class="page-width full-error-page">
      <div class="full-error-copy">
        <p class="eyebrow">NOCTURNO / INCIDENCIA</p>
        <strong class="full-error-code">{{ safeCode() }}</strong>
        <h1>{{ content().title }}</h1>
        <p>{{ content().message }}</p>
        <div class="full-error-actions">
          @if (safeCode() === '401') {
            <a class="button-primary" routerLink="/auth/login" [queryParams]="loginQuery()">{{ content().action }} ↗</a>
          } @else if (safeCode() === '500' || safeCode() === '503') {
            <button class="button-primary" type="button" (click)="retry()">{{ content().action }} ↗</button>
          }
          <a class="button-outline" routerLink="/">Volver al inicio ↗</a>
        </div>
      </div>
      <img class="full-error-illustration" [src]="'/errors/' + safeCode() + '.svg'"
        [alt]="'Ilustración del error ' + safeCode()" />
    </main>
  `,
})
export class ErrorPage {
  readonly code = input<string>('404');
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly safeCode = computed<ErrorCode>(() => this.code() in errors ? this.code() as ErrorCode : '404');
  readonly content = computed(() => errors[this.safeCode()]);
  readonly loginQuery = computed(() => ({ returnUrl: this.route.snapshot.queryParamMap.get('returnUrl') || '/' }));

  retry() {
    const target = this.route.snapshot.queryParamMap.get('returnUrl');
    void this.router.navigateByUrl(target?.startsWith('/') && !target.startsWith('//') ? target : '/');
  }
}
