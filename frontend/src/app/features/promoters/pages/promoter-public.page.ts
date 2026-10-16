import { Component, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventGridComponent } from '../../events/components/event-grid';
import { FavoritesStore } from '../../favorites/store/favorites.store';
import { PromotersStore } from '../store/promoters.store';
import type { Event } from '../../../core/models/domain.model';

@Component({
  selector: 'app-promoter-public-page',
  providers: [PromotersStore],
  imports: [RouterLink, EventGridComponent],
  template: `
    <div class="page-width public-profile">
      <a class="back-link" routerLink="/">← Descubrir eventos</a>
      @if (store.loading()) { <p role="status">Cargando organizador…</p> }
      @else if (store.error()) { <p class="inline-alert" role="alert">{{ store.error() }}</p> }
      @else if (store.publicProfile(); as profile) {
        <header class="public-profile-hero">
          <div><p class="eyebrow">NOCTURNO. / {{ hasDemoEvents(profile.upcomingEvents) ? 'PROMOTOR DEMO' : 'ORGANIZA' }}</p><h1>{{ profile.promoter.name }}</h1>
            <p class="public-profile-lead">{{ profile.promoter.description || 'Descubre las próximas fechas de este organizador.' }}</p>
            @if (hasDemoEvents(profile.upcomingEvents)) { <p class="muted">Perfil y eventos simulados de Nocturno. Los locales citados no colaboran ni avalan estas sesiones.</p> }
            @if (profile.promoter.websiteUrl) { <a [href]="profile.promoter.websiteUrl" target="_blank" rel="noopener noreferrer">Web oficial ↗</a> }
          </div>
          <div class="public-profile-art" aria-hidden="true">{{ profile.promoter.name.slice(0, 1) }}</div>
        </header>
        @if (usualVenues(profile.upcomingEvents).length) {
          <div class="profile-venues"><span class="eyebrow">{{ hasDemoEvents(profile.upcomingEvents) ? 'LOCALES DE LA SIMULACIÓN' : 'ESPACIOS' }}</span>
            @for (venue of usualVenues(profile.upcomingEvents); track venue) { <span>{{ venue }}</span> }
          </div>
        }
        <section class="public-profile-section"><p class="eyebrow">PRÓXIMAMENTE</p><h2>{{ hasDemoEvents(profile.upcomingEvents) ? 'Próximas sesiones demo.' : 'Sus próximas noches.' }}</h2>
          @if (profile.upcomingEvents.length) {
            <app-event-grid [events]="profile.upcomingEvents" [favoriteIds]="favorites.favoriteIds()"
              [pendingIds]="favorites.pendingIds()" (favoriteClicked)="favorites.toggle($event)" />
          } @else { <p class="muted">Todavía no hay próximos eventos publicados por este organizador.</p> }
        </section>
      }
    </div>
  `
})
export class PromoterPublicPage {
  readonly slug = input<string>('');
  readonly store = inject(PromotersStore);
  readonly favorites = inject(FavoritesStore);
  constructor() {
    effect(() => { if (this.slug()) void this.store.loadPublicProfile(this.slug()); });
    void this.favorites.load();
  }
  usualVenues(events: { venueName?: string }[]) {
    return [...new Set(events.map((event) => event.venueName).filter((name): name is string => !!name))];
  }
  hasDemoEvents(events: Event[]) { return events.some((event) => event.isDemo); }
}
