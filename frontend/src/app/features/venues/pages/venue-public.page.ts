import { Component, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { EventGridComponent } from '../../events/components/event-grid';
import { EventMapComponent } from '../../events/components/event-map';
import { FavoritesStore } from '../../favorites/store/favorites.store';
import { VenuesStore } from '../store/venues.store';
import type { Event } from '../../../core/models/domain.model';
import { ErrorStateComponent } from '../../../shared/components/states';

@Component({
  selector: 'app-venue-public-page',
  providers: [VenuesStore],
  imports: [RouterLink, EventGridComponent, EventMapComponent, ErrorStateComponent],
  template: `
    <div class="page-width public-profile">
      <a class="back-link" routerLink="/">← Descubrir eventos</a>
      @if (store.loading()) { <p role="status">Cargando local…</p> }
      @else if (store.error()) { <app-error-state [message]="store.error()!" [code]="store.errorCode() === 'NETWORK_ERROR' || store.errorCode() === 'DATABASE_UNAVAILABLE' ? '503' : '500'" (retry)="loadProfile(slug())" /> }
      @else if (store.publicProfile(); as profile) {
        <header class="public-profile-hero">
          <div><p class="eyebrow">NOCTURNO. / {{ profile.venue.isDemo ? 'LOCAL DE PRUEBA' : 'LOCAL REAL' }}</p><h1>{{ profile.venue.name }}</h1>
            <p class="public-profile-lead">{{ profile.venue.description || profile.venue.type.replaceAll('_', ' ') }}</p>
            <p>{{ profile.venue.address }} · {{ profile.venue.municipality }}, {{ profile.venue.province }}</p>
            @if (profile.venue.websiteUrl) { <a [href]="profile.venue.websiteUrl" target="_blank" rel="noopener noreferrer">Web del local ↗</a> }
            @if (!profile.venue.isDemo && profile.venue.sourceUrl) { <p class="muted">Datos del local: <a [href]="profile.venue.sourceUrl" target="_blank" rel="noopener noreferrer">fuente ↗</a>. Los eventos de Nocturno son simulados y no implican colaboración.</p> }
          </div>
          @if (profile.venue.imageUrl) { <img [src]="profile.venue.imageUrl" [alt]="profile.venue.name" /> }
          @else { <div class="public-profile-art" aria-hidden="true">NOCTURNO.</div> }
        </header>
        @if (profile.venue.latitude !== null && profile.venue.longitude !== null) {
          <section class="public-profile-section"><p class="eyebrow">DÓNDE ESTÁ</p><h2>Encuentra el local.</h2>
            <app-event-map [events]="[]" [place]="{ name: profile.venue.name, latitude: profile.venue.latitude!, longitude: profile.venue.longitude! }" />
            <a class="map-link" [href]="mapUrl(profile.venue.latitude!, profile.venue.longitude!)" target="_blank" rel="noopener noreferrer">
              Abrir ubicación exacta en OpenStreetMap ↗
            </a>
          </section>
        }
        <section class="public-profile-section"><p class="eyebrow">PRÓXIMAMENTE</p><h2>{{ hasDemoEvents(profile.upcomingEvents) ? 'Sesiones demo de Nocturno en ' : 'La agenda de ' }}{{ profile.venue.name }}.</h2>
          @if (profile.upcomingEvents.length) {
            <app-event-grid [events]="profile.upcomingEvents" [favoriteIds]="favorites.favoriteIds()"
              [pendingIds]="favorites.pendingIds()" (favoriteClicked)="favorites.toggle($event)" />
          } @else { <p class="muted">Todavía no hay próximos eventos publicados para este local.</p> }
        </section>
      }
    </div>
  `
})
export class VenuePublicPage {
  readonly slug = input<string>('');
  readonly store = inject(VenuesStore);
  readonly favorites = inject(FavoritesStore);
  private readonly router = inject(Router);
  constructor() {
    effect(() => { if (this.slug()) void this.loadProfile(this.slug()); });
    void this.favorites.load();
  }
  async loadProfile(slug: string) {
    await this.store.loadPublicProfile(slug);
    if (this.store.errorCode() === 'VENUE_NOT_FOUND') {
      void this.router.navigate(['/error/404'], { replaceUrl: true });
    }
  }
  mapUrl(latitude: number, longitude: number) {
    return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
  }
  hasDemoEvents(events: Event[]) { return events.some((event) => event.isDemo); }
}
