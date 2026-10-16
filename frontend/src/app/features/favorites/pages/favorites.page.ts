import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Event } from '../../../core/models/domain.model';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '../../../shared/components/states';
import { EventGridComponent } from '../../events/components/event-grid';
import { FavoritesStore } from '../store/favorites.store';

@Component({
  selector: 'app-favorites-page',
  imports: [EventGridComponent, LoadingSkeletonComponent, EmptyStateComponent, ErrorStateComponent],
  template: `
    <div class="page-width favorites-page">
      <div class="page-heading">
        <p class="eyebrow">TU SELECCIÓN</p>
        <h1>Favoritos<span>.</span></h1>
        <p>
          {{ favorites.events().length }}
          {{ favorites.events().length === 1 ? 'plan guardado' : 'planes guardados' }} para volver a
          la noche que elegiste.
        </p>
      </div>
      @if (favorites.message()) {
        <div class="inline-alert" role="alert">
          {{ favorites.message() }}
          <button type="button" (click)="favorites.clearMessage()" aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      }
      @if (favorites.loading()) {
        <app-loading-skeleton />
      } @else if (favorites.error()) {
        <app-error-state [message]="favorites.error()!" (retry)="favorites.load()" />
      } @else if (!favorites.events().length) {
        <app-empty-state
          title="Aún no has guardado ningún plan."
          message="Explora eventos y toca el corazón para crear tu selección."
          actionLabel="Descubrir eventos"
          (action)="goDiscover()"
        />
      } @else {
        <div class="results-heading">
          <div>
            <p class="eyebrow">GUARDADOS</p>
            <h2>{{ favorites.events().length }} planes para ti</h2>
          </div>
        </div>
        <app-event-grid
          [events]="favorites.events()"
          [favoriteIds]="favorites.favoriteIds()"
          [pendingIds]="favorites.pendingIds()"
          (favoriteClicked)="toggle($event)"
        />
      }
    </div>
  `,
})
export class FavoritesPage implements OnInit {
  readonly favorites = inject(FavoritesStore);
  private readonly router = inject(Router);
  ngOnInit() {
    void this.favorites.load();
  }
  toggle(event: Event) {
    void this.favorites.toggle(event);
  }
  goDiscover() {
    void this.router.navigateByUrl('/');
  }
}
