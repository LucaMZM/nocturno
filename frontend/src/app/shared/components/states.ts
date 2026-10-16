import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-loading-skeleton',
  template: `<div class="event-grid" aria-label="Cargando eventos" aria-busy="true">@for (item of items; track item) { <div class="skeleton-card"><div class="skeleton-poster shimmer"></div><div class="skeleton-line shimmer"></div><div class="skeleton-line short shimmer"></div></div> }</div>`
})
export class LoadingSkeletonComponent { readonly items = [1, 2, 3, 4, 5, 6]; }

@Component({
  selector: 'app-empty-state',
  template: `<div class="state-panel"><span class="state-symbol" aria-hidden="true">◇</span><p class="eyebrow">SIN PLANES A LA VISTA</p><h2>{{ title() }}</h2><p>{{ message() }}</p><button class="button-outline" type="button" (click)="action.emit()">{{ actionLabel() }} <span>↗</span></button></div>`
})
export class EmptyStateComponent {
  readonly title = input('No hemos encontrado planes con estos filtros.');
  readonly message = input('Prueba otra localidad o cambia los filtros para seguir explorando.');
  readonly actionLabel = input('Limpiar filtros');
  readonly action = output<void>();
}

@Component({
  selector: 'app-error-state',
  template: `<div class="state-panel error-panel" role="alert"><span class="state-symbol" aria-hidden="true">!</span><p class="eyebrow">ALGO HA FALLADO</p><h2>{{ message() }}</h2><p>Vuelve a intentarlo en un momento.</p><button class="button-outline" type="button" (click)="retry.emit()">Reintentar <span>↗</span></button></div>`
})
export class ErrorStateComponent { readonly message = input.required<string>(); readonly retry = output<void>(); }
