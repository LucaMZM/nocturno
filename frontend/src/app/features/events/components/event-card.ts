import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Event } from '../../../core/models/domain.model';
import { eventDate, eventTime, euro, readableTag, formatDistance } from '../../../shared/utils/format';

@Component({
  selector: 'app-event-card',
  imports: [RouterLink],
  template: `
    <article class="event-card">
      <div class="poster-frame">
        <a
          [routerLink]="['/events', event().slug]"
          [attr.aria-label]="'Ver ' + event().title"
          class="poster-link"
        >
          @if (coverUrl(); as imageUrl) {
            <img [src]="imageUrl" [alt]="coverAlt()" loading="lazy" />
          } @else {
            <div
              class="poster-placeholder"
              [class.poster-warm]="
                event().eventType === 'ROOFTOP' || event().eventType === 'BEACH_CLUB'
              "
              [class.poster-earth]="
                event().eventType === 'CONCERT' || event().eventType === 'JAZZ_CLUB'
              "
            >
              <span class="poster-top">NOCTURNO.</span>
              <strong class="poster-art">{{ posterWord(event().eventType) }}</strong>
              <span class="poster-bottom"
                >{{ event().municipality || 'EN DIRECTO' }} /
                {{ event().eventType.replaceAll('_', ' ') }}</span
              >
            </div>
          }
        </a>
        @if (event().isDemo) { <span class="poster-demo-badge">DEMO · NOCTURNO</span> }
        @if (event().status === 'SOLD_OUT') {
          <span class="poster-badge sold">AGOTADO</span>
        } @else if (event().ticketAvailability === 0 && event().minPrice !== null && event().minPrice !== undefined) {
          <span class="poster-badge sold">SIN ENTRADAS</span>
        } @else if (isToday(event().startsAt)) {
          <span class="poster-badge">HOY</span>
        }
        <button
          class="favorite-button"
          [class.is-favorite]="isFavorite()"
          type="button"
          [disabled]="favoritePending()"
          [attr.aria-label]="isFavorite() ? 'Quitar de favoritos' : 'Guardar en favoritos'"
          [attr.aria-pressed]="isFavorite()"
          (click)="favoriteClicked.emit(event())"
        >
          {{ isFavorite() ? '♥' : '♡' }}
        </button>
      </div>
      <div class="event-card-body">
        <p class="event-card-date">
          {{ date(event().startsAt) }} <span>·</span> {{ time(event().startsAt) }}
        </p>
        <h3>
          <a [routerLink]="['/events', event().slug]">{{ event().title }}</a>
        </h3>
        <p class="event-card-location">
          {{ event().venueName || 'Local por descubrir' }} <span>·</span>
          {{ event().municipality || event().province || 'Ver ubicación' }}
          @if (event().distanceKm !== null && event().distanceKm !== undefined) {
            <span>·</span> A {{ distance(event().distanceKm!) }}
          }
        </p>
        <p class="event-card-genres">
          @for (genre of event().musicGenres.slice(0, 3); track genre; let last = $last) {
            {{ label(genre) }}
            @if (!last) {
              <span>·</span>
            }
          }
        </p>
        <div class="event-card-footer">
          <div class="event-price">
            @if (event().minPrice !== undefined && event().minPrice !== null) {
              <span>Desde</span><strong>{{ price(event().minPrice!) }}</strong>
            } @else {
              <strong>{{ event().ticketAvailability === 0 ? 'Ver detalles' : 'Ver entradas' }}</strong>
            }
          </div>
          @if (
            event().ticketAvailability !== undefined &&
            event().ticketAvailability! > 0 &&
            event().ticketAvailability! <= 20
          ) {
            <span class="availability">ÚLTIMAS ENTRADAS</span>
          }
          <a
            [routerLink]="['/events', event().slug]"
            class="card-arrow"
            [attr.aria-label]="'Ver detalles de ' + event().title"
            >↗</a
          >
        </div>
      </div>
    </article>
  `,
})
export class EventCardComponent {
  readonly event = input.required<Event>();
  readonly coverImage = computed(() => this.event().images?.[0] ?? null);
  readonly coverUrl = computed(() => this.coverImage()?.url ?? this.event().posterUrl);
  readonly coverAlt = computed(() => this.coverImage()?.altText || 'Imagen de ' + this.event().title);
  readonly isFavorite = input(false);
  readonly favoritePending = input(false);
  readonly favoriteClicked = output<Event>();
  readonly date = eventDate;
  readonly time = eventTime;
  readonly price = euro;
  readonly label = readableTag;
  readonly distance = formatDistance;
  posterWord(type: string) {
    return type.replaceAll('_', ' ');
  }
  isToday(value: string) {
    return new Date(value).toDateString() === new Date().toDateString();
  }
}
