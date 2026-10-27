import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EventsStore } from '../store/events.store';
import { EventDetailStore } from '../store/event-detail.store';
import { FavoritesStore } from '../../favorites/store/favorites.store';
import { ErrorStateComponent } from '../../../shared/components/states';
import { TicketTypeCardComponent } from '../../../shared/components/ticket-type-card';
import { eventTime, fullEventDate, readableTag, formatDistance } from '../../../shared/utils/format';
import { distanceBetweenKm } from '../../../shared/utils/geo';
import { createEventIcs } from '../../../shared/utils/calendar';
import { serializeEventFilters } from '../../../shared/utils/event-filter-contract';
import { AuthStore } from '../../auth/store/auth.store';
import { CartStore } from '../../cart/store/cart.store';
import { LocationStore } from '../../location/store/location.store';
import { EventImageCarouselComponent } from '../components/event-image-carousel.component';

@Component({
  selector: 'app-event-detail-page',
  imports: [RouterLink, TicketTypeCardComponent, ErrorStateComponent, EventImageCarouselComponent],
  providers: [EventDetailStore],
  template: `
    <div class="page-width detail-page">
      <a routerLink="/" [queryParams]="backToListQueryParams()" class="back-link"
        >← Volver a descubrir</a
      >
      @if (eventsStore.detailLoading()) {
        <div class="detail-loading">
          <div class="detail-poster-skeleton shimmer"></div>
          <div>
            <div class="skeleton-line shimmer"></div>
            <div class="skeleton-line short shimmer"></div>
          </div>
        </div>
      } @else if (eventsStore.detailError()) {
        <app-error-state [message]="eventsStore.detailError()!"
          [code]="eventsStore.detailErrorCode() === 'NETWORK_ERROR' || eventsStore.detailErrorCode() === 'DATABASE_UNAVAILABLE' ? '503' : '500'"
          (retry)="loadPageForSlug(slug())" />
      } @else if (eventsStore.selectedEvent(); as event) {
        <div class="detail-layout">
          <div class="detail-main">
            <app-event-image-carousel [event]="event" />
            <div class="detail-description">
              <p class="eyebrow">SOBRE EL EVENTO</p>
              <h2>La noche, en detalle.</h2>
              @if (event.isDemo) {
                <p class="demo-disclosure">Propuesta independiente de Nocturno. Esta sesión es ficticia y sus entradas no son oficiales; el local no la organiza ni la avala.</p>
              }
              <p>
                {{
                  (event.description?.startsWith('Evento ficticio creado por Nocturno para demostrar')
                    ? 'Una propuesta de ' + event.musicGenres.map(label).join(', ') + ' para descubrir la noche a tu manera.'
                    : event.description) ||
                    'Una propuesta para salir y descubrir la noche. Consulta la información del local y las entradas disponibles.'
                }}
              </p>
              @if (event.sourceUrl) {
                <p class="muted">Programación publicada por el local o la organización.
                  <a [href]="event.sourceUrl" target="_blank" rel="noopener noreferrer">Ver fuente oficial ↗</a>
                </p>
              }
              @if (event.musicGenres.length) {
                <div class="detail-tags">
                  @for (genre of event.musicGenres; track genre) {
                    <span>{{ label(genre) }}</span>
                  }
                </div>
              }
              <div class="detail-facts">
                @if (event.minimumAge !== null || eventDetailStore.venue()?.minimumAge != null) {
                  <div>
                    <span>EDAD MÍNIMA</span
                    ><strong
                      >{{ event.minimumAge ?? eventDetailStore.venue()?.minimumAge }} años</strong
                    >
                  </div>
                }
                @if (event.dressCode) {
                  <div>
                    <span>CÓDIGO DE VESTIMENTA</span><strong>{{ label(event.dressCode) }}</strong>
                  </div>
                }
                @if (event.atmosphere.length) {
                  <div>
                    <span>AMBIENTE</span><strong>{{ formatLabels(event.atmosphere) }}</strong>
                  </div>
                }
                @if (event.idealFor.length) {
                  <div>
                    <span>IDEAL PARA</span><strong>{{ formatLabels(event.idealFor) }}</strong>
                  </div>
                }
              </div>
            </div>
            <section class="tickets-section" id="entradas">
              <p class="eyebrow">ELIGE TU EXPERIENCIA</p>
              <h2>Entradas</h2>
              @if (eventDetailStore.loading()) {
                <p class="muted">Cargando entradas…</p>
              } @else if (eventDetailStore.error()) {
                <p class="inline-alert" role="alert">
                  {{ eventDetailStore.error() }}
                  <button type="button" (click)="eventDetailStore.loadEventRelations(event)">
                    Reintentar
                  </button>
                </p>
              } @else if (eventDetailStore.tickets().length) {
                <div class="ticket-list">
                  @for (ticket of eventDetailStore.tickets(); track ticket.id) {
                    <app-ticket-type-card [ticket]="ticket" [canBuy]="event.status === 'PUBLISHED'"
                      [pending]="cart.pending()" (add)="addToCart($event.ticketTypeId, $event.quantity)" />
                  }
                </div>
              } @else if (event.sourceUrl) {
                <p class="muted">Ficha informativa. Nocturno no vende entradas de este evento.
                  Consulta la disponibilidad con la organización.
                  <a [href]="event.sourceUrl" target="_blank" rel="noopener noreferrer">Ir a la fuente oficial ↗</a>
                </p>
              } @else {
                <p class="muted">Todavía no hay entradas publicadas para este evento.</p>
              }
              @if (soldOut(event) && eventDetailStore.tickets().length) {
                <div class="waitlist-callout"><strong>ENTRADAS AGOTADAS</strong>
                  <p>Apúntate para guardar tu interés si vuelven a aparecer entradas.</p>
                  @if (eventDetailStore.joinedWaitlist()) { <span role="status">✓ Ya estás en la lista de espera</span> }
                  @else { <button class="button-outline" type="button" [disabled]="eventDetailStore.waitlistPending()"
                    (click)="joinWaitlist(event.id)">{{ eventDetailStore.waitlistPending() ? 'Guardando…' : 'Avísame si hay entradas' }}</button> }
                  @if (eventDetailStore.waitlistMessage()) { <p role="status">{{ eventDetailStore.waitlistMessage() }}</p> }
                </div>
              }
              @if (cart.message()) { <p class="inline-alert" role="status">{{ cart.message() }}</p> }
              @if (cart.error()) { <p class="inline-alert" role="alert">{{ cart.error() }}</p> }
            </section>
          </div>
          <aside class="detail-sidebar">
            <p class="eyebrow">
              {{ label(event.eventType) }} <span>·</span>
              {{ event.status === 'SOLD_OUT' ? 'AGOTADO' : 'EVENTO' }}
            </p>
            <h1>{{ event.title }}</h1>
            <p class="detail-date">{{ date(event.startsAt) }}</p>
            <div class="sidebar-facts">
              <div>
                <span>HORARIO</span
                ><strong>{{ time(event.startsAt) }} — {{ time(event.endsAt) }}</strong>
              </div>
              <div>
                <span>LUGAR</span>
                @if (event.venueSlug) {
                  <strong><a [routerLink]="['/venues', event.venueSlug]">{{ event.venueName || eventDetailStore.venue()?.name }} ↗</a></strong>
                } @else { <strong>{{ event.venueName || eventDetailStore.venue()?.name || 'Local por confirmar' }}</strong> }
                <small>{{ eventDetailStore.venue()?.zone ? eventDetailStore.venue()?.zone + ' · ' : ''
                  }}{{ event.municipality || eventDetailStore.venue()?.municipality }}</small>
              </div>
              @if (eventDetailStore.venue()?.address; as address) {
                <div>
                  <span>DIRECCIÓN</span><strong>{{ address }}</strong>
                </div>
              }
              @if (eventDetailStore.promoter(); as promoter) {
                <div>
                  <span>ORGANIZA</span><strong><a [routerLink]="['/promoters', promoter.slug]">{{ promoter.name }} ↗</a></strong>
                </div>
              }
              @if (distanceTo(event); as distance) {
                <div><span>DESDE TI</span><strong>A {{ formatDistance(distance) }}</strong></div>
              }
            </div>
            <div class="sidebar-actions">
              @if (event.minPrice !== null && event.minPrice !== undefined) {
                <button class="button-primary" type="button" (click)="scrollToTickets()">
                  Ver entradas <span>↗</span>
                </button>
              }
              <button
                class="button-outline"
                type="button"
                [disabled]="favoritesStore.pendingIds().includes(event.id)"
                (click)="favoritesStore.toggle(event)"
              >
                {{ favoritesStore.favoriteIds().has(event.id) ? '♥ Guardado' : '♡ Guardar evento' }}
              </button>
              <div class="detail-share-actions">
                <button class="button-outline" type="button" (click)="shareEvent(event)">Compartir ↗</button>
                <button class="button-outline" type="button" (click)="downloadCalendar(event)">Añadir a calendario +</button>
              </div>
              @if (shareMessage()) { <p class="inline-alert" role="status">{{ shareMessage() }}</p> }
              @if (canManage(event.promoterId)) {
                <a class="button-outline" [routerLink]="['/dashboard/events', event.id, 'edit']">Editar evento <span>↗</span></a>
              }
              @if (favoritesStore.message()) {
                <p class="inline-alert" role="alert">{{ favoritesStore.message() }}</p>
              }
            </div>
          </aside>
        </div>
      }
    </div>
  `,
})
export class EventDetailPage {
  readonly slug = input<string>('');
  readonly eventsStore = inject(EventsStore);
  readonly eventDetailStore = inject(EventDetailStore);
  readonly favoritesStore = inject(FavoritesStore);
  readonly auth = inject(AuthStore);
  readonly cart = inject(CartStore);
  readonly location = inject(LocationStore);
  readonly shareMessage = signal<string | null>(null);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly backToListQueryParams = computed(() =>
    serializeEventFilters(this.eventsStore.filters()),
  );
  readonly date = fullEventDate;
  readonly time = eventTime;
  readonly label = readableTag;
  readonly formatDistance = formatDistance;
  formatLabels(values: string[]) {
    return values.map(readableTag).join(' · ');
  }

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug) void this.loadPageForSlug(slug);
    });
    void this.favoritesStore.load();
  }
  async loadPageForSlug(slug: string) {
    this.cart.clearMessage();
    this.shareMessage.set(null);
    await this.eventsStore.loadEventBySlug(slug);
    if (this.eventsStore.detailErrorCode() === 'EVENT_NOT_FOUND') {
      void this.router.navigate(['/error/404'], { replaceUrl: true });
      return;
    }
    const event = this.eventsStore.selectedEvent();
    if (event?.slug === slug) {
      await this.eventDetailStore.loadEventRelations(event);
      const requested = this.route.snapshot.queryParamMap.get('addTicket');
      const quantity = Number(this.route.snapshot.queryParamMap.get('qty'));
      if (this.auth.user() && requested && this.eventDetailStore.tickets().some((ticket) => ticket.id === requested)
        && Number.isInteger(quantity) && quantity >= 1 && quantity <= 10) {
        await this.cart.addItem(requested, quantity);
        await this.router.navigate([], { relativeTo: this.route,
          queryParams: { addTicket: null, qty: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    }
  }
  canManage(promoterId: string | null) {
    const user = this.auth.user();
    return user?.role === 'ADMIN' || (user?.role === 'PROMOTER' && !!user.promoterId && user.promoterId === promoterId);
  }
  async addToCart(ticketTypeId: string, quantity: number) {
    if (!this.auth.user()) {
      const returnUrl = `/events/${this.slug()}?addTicket=${encodeURIComponent(ticketTypeId)}&qty=${quantity}`;
      await this.router.navigate(['/auth/login'], { queryParams: { returnUrl } });
      return;
    }
    await this.cart.addItem(ticketTypeId, quantity);
  }
  scrollToTickets() {
    document.getElementById('entradas')?.scrollIntoView({ behavior: 'smooth' });
  }
  soldOut(event: { status: string }) {
    const tickets = this.eventDetailStore.tickets();
    return event.status === 'SOLD_OUT' || (tickets.length > 0 && tickets.every((ticket) =>
      ticket.quantity - ticket.sold - ticket.reserved <= 0));
  }
  distanceTo(event: { venueLatitude?: number | null; venueLongitude?: number | null }) {
    const latitude = this.location.latitude();
    const longitude = this.location.longitude();
    if (latitude === null || longitude === null || event.venueLatitude == null || event.venueLongitude == null) return null;
    return distanceBetweenKm(latitude, longitude, event.venueLatitude, event.venueLongitude);
  }
  async joinWaitlist(eventId: string) {
    if (!this.auth.user()) {
      await this.router.navigate(['/auth/login'], { queryParams: { returnUrl: `/events/${this.slug()}` } });
      return;
    }
    await this.eventDetailStore.joinWaitlist(eventId);
  }
  async shareEvent(event: { slug: string; title: string }) {
    const url = `${window.location.origin}/events/${encodeURIComponent(event.slug)}`;
    try {
      if (navigator.share) await navigator.share({ title: event.title, url });
      else { await navigator.clipboard.writeText(url); this.shareMessage.set('Enlace copiado.'); }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      try { await navigator.clipboard.writeText(url); this.shareMessage.set('Enlace copiado.'); }
      catch { this.shareMessage.set('No se pudo copiar el enlace.'); }
    }
  }
  downloadCalendar(event: { id: string; slug: string; title: string; description: string | null; startsAt: string; endsAt: string; venueName?: string }) {
    const venue = this.eventDetailStore.venue();
    const ics = createEventIcs({ id: event.id, title: event.title, description: event.description,
      startsAt: event.startsAt, endsAt: event.endsAt,
      venueName: event.venueName || venue?.name || '', address: venue?.address || '',
      url: `${window.location.origin}/events/${encodeURIComponent(event.slug)}` });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `${event.slug}.ics`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
