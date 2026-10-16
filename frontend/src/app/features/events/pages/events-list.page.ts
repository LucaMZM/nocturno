import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { Event, EventFilters } from '../../../core/models/domain.model';
import { ActiveFiltersComponent } from '../../../shared/components/active-filters';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingSkeletonComponent,
} from '../../../shared/components/states';
import { EventGridComponent } from '../components/event-grid';
import { EventMapComponent } from '../components/event-map';
import { EventFiltersComponent } from '../components/event-filters';
import { QuickDateFiltersComponent } from '../../../shared/components/quick-date-filters';
import { SearchBarComponent } from '../../../shared/components/search-bar';
import {
  ActiveFilterKey,
  DEFAULT_EVENT_PAGE,
  DEFAULT_EVENT_FILTERS,
  DEFAULT_EVENT_STATUS,
  parseEventFilters,
  sameEventFilters,
  serializeEventFilters,
} from '../../../shared/utils/event-filter-contract';
import { DatePreset, dateRangeFor } from '../../../shared/utils/format';
import { EventsStore } from '../store/events.store';
import { FavoritesStore } from '../../favorites/store/favorites.store';
import { LocationStore } from '../../location/store/location.store';
import { AuthStore } from '../../auth/store/auth.store';
import { EventsApiService } from '../services/events-api.service';
import { toApiProblem } from '../../../shared/utils/api-error';

@Component({
  selector: 'app-events-list-page',
  imports: [
    SearchBarComponent,
    QuickDateFiltersComponent,
    EventFiltersComponent,
    ActiveFiltersComponent,
    EventGridComponent,
    EventMapComponent,
    LoadingSkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    RouterLink,
  ],
  template: `
    <div class="page-width discover-page">
      <section class="discover-hero" aria-label="Descubre la noche">
        <div class="hero-image" aria-hidden="true"></div>
        <div class="hero-copy">
          <p class="eyebrow">
            <span class="red-dot"></span> {{ eventsStore.filters().municipality || 'TU CIUDAD' }} ·
            LA NOCHE EMPIEZA AQUÍ
          </p>
          <h1>¿Qué se cuece<br /><em>esta noche?</em></h1>
          <p>Encuentra fiestas, clubs y directos cerca de ti. Tu próximo plan empieza aquí.</p>
          <app-search-bar
            [initial]="eventsStore.filters().search ?? ''"
            (searched)="onSearchChange($event)"
          />
          <app-quick-date-filters
            [selected]="selectedDatePreset()"
            (chosen)="onDatePresetChange($event)"
          />
        </div>
        <span class="hero-index">NOCTURNO / 001 — DESCUBRIR</span>
      </section>

      <section class="discovery-controls" aria-label="Filtrar eventos">
        <div class="controls-intro">
          <div>
            <span class="eyebrow">EXPLORA LA AGENDA</span>
            <h2>Encuentra tu noche<span>.</span></h2>
          </div>
          <div class="controls-actions">
            <span class="controls-location">{{
              locationStore.mode() === 'automatic' ? 'Cerca de mí' : (eventsStore.filters().municipality || 'Todas las localidades')
            }}</span>
            <button class="button-outline" type="button" [disabled]="locationStore.locating()" (click)="onNearMe()">
              {{ locationStore.locating() ? 'Buscando ubicación…' : '⌖ Cerca de mí' }}
            </button>
            @if (auth.user()?.role === 'ADMIN' || auth.user()?.role === 'PROMOTER') {
              <a class="button-outline" routerLink="/dashboard/events/create">Crear evento <span>＋</span></a>
            }
          </div>
        </div>
        @if (locationStore.geolocationError()) {
          <p class="inline-alert" role="alert">{{ locationStore.geolocationError() }}</p>
        }
        @if (locationStore.mode() === 'automatic') {
          <div class="nearby-controls">
            <label>Radio
              <select [value]="eventsStore.filters().radiusKm ?? 10" #radius (change)="onRadiusChange(radius.value)">
                <option value="2">2 km</option><option value="5">5 km</option><option value="10">10 km</option>
                <option value="25">25 km</option><option value="50">50 km</option>
              </select>
            </label>
            <button class="button-text" type="button" (click)="onStopNearMe()">Desactivar ubicación</button>
          </div>
        }
        <app-event-filters
          [filters]="eventsStore.filters()"
          [nearMe]="locationStore.mode() === 'automatic'"
          [municipalities]="locationStore.municipalities()"
          [provinces]="locationStore.provinces()"
          [total]="eventsStore.totalEvents()"
          [hasActiveFilters]="eventsStore.hasActiveFilters()"
          (filtersChanged)="onFiltersChange($event)"
          (numberFilterChanged)="onNumberFilterChange($event)"
          (dateFilterChanged)="onDateFilterChange($event)"
          (radiusChanged)="onRadiusChange($event)"
          (sortChanged)="onSortChange($event)"
          (allFiltersCleared)="onClearFilters()"
        />
        <app-active-filters
          [filters]="eventsStore.filters()"
          (removed)="onFilterRemoved($event)"
          (cleared)="onClearFilters()"
        />
      </section>

      <section class="results-section" aria-live="polite">
        <div class="results-heading">
          <div>
            <p class="eyebrow">LA AGENDA</p>
            <h2>Planes para salir</h2>
            <p class="results-context">
              {{ eventsStore.totalEvents() }}
              {{ eventsStore.totalEvents() === 1 ? 'evento' : 'eventos' }} en
              {{ eventsStore.filters().municipality || 'todas las localidades' }}
            </p>
          </div>
          <label class="sort-control"
            >Ordenar por
            <select [value]="eventsStore.filters().sort" #sort (change)="onSortChange(sort.value)">
              <option value="date">Próximos</option>
              <option value="price">Menor precio</option>
              <option value="createdAt">Recientes</option>
              @if (locationStore.mode() === 'automatic') { <option value="distance">Más cerca</option> }
            </select></label
          >
          <div class="view-switch" role="group" aria-label="Vista de resultados">
            <button type="button" [class.active]="view() === 'list'" [attr.aria-pressed]="view() === 'list'" (click)="view.set('list')">Lista</button>
            <button type="button" [class.active]="view() === 'map'" [attr.aria-pressed]="view() === 'map'" (click)="view.set('map')">Mapa</button>
          </div>
        </div>
        @if (favoritesStore.message()) {
          <div class="inline-alert" role="alert">
            {{ favoritesStore.message() }}
            <button type="button" (click)="favoritesStore.clearMessage()" aria-label="Cerrar aviso">
              ×
            </button>
          </div>
        }
        @if (view() === 'map') {
          @if (mapLoading()) { <p role="status" class="map-status">Situando eventos en el mapa…</p> }
          @else if (mapError()) { <p class="inline-alert" role="alert">{{ mapError() }} <button type="button" (click)="loadMap()">Reintentar</button></p> }
          @else if (!mapEvents().length) { <app-empty-state (action)="onClearFilters()" /> }
          @else {
            <app-event-map [events]="mapEvents()" [center]="mapCenter()" />
            @if (mapTotal() > mapEvents().length) { <p class="muted">Mostrando los primeros {{ mapEvents().length }} de {{ mapTotal() }} eventos. Afina los filtros para ver más.</p> }
          }
        } @else if (eventsStore.loading()) {
          <app-loading-skeleton />
        } @else if (eventsStore.error()) {
          <app-error-state [message]="eventsStore.error()!" (retry)="eventsStore.refreshEvents()" />
        } @else if (!eventsStore.hasEvents()) {
          <app-empty-state (action)="onClearFilters()" />
        } @else {
          <app-event-grid
            [events]="eventsStore.events()"
            [favoriteIds]="favoritesStore.favoriteIds()"
            [pendingIds]="favoritesStore.pendingIds()"
            (favoriteClicked)="onFavoriteToggle($event)"
          />
          @if (eventsStore.pagination().page < eventsStore.pagination().totalPages) {
            <div class="load-more">
              <p>
                Mostrando {{ eventsStore.events().length }} de
                {{ eventsStore.totalEvents() }} planes
              </p>
              <button
                class="button-outline"
                type="button"
                [disabled]="eventsStore.loadingMore()"
                (click)="onPageChange(eventsStore.pagination().page + 1)"
              >
                {{ eventsStore.loadingMore() ? 'Cargando…' : 'Ver más planes' }} <span>↓</span>
              </button>
            </div>
          }
        }
      </section>
    </div>
  `,
})
export class EventsListPage implements OnInit {
  readonly eventsStore = inject(EventsStore);
  readonly favoritesStore = inject(FavoritesStore);
  readonly locationStore = inject(LocationStore);
  readonly auth = inject(AuthStore);
  private readonly eventsApi = inject(EventsApiService);
  readonly view = signal<'list' | 'map'>('list');
  readonly mapEvents = signal<Event[]>([]);
  readonly mapLoading = signal(false);
  readonly mapError = signal<string | null>(null);
  readonly mapTotal = signal(0);
  readonly mapCenter = computed(() => {
    const latitude = this.locationStore.latitude();
    const longitude = this.locationStore.longitude();
    return this.locationStore.mode() === 'automatic' && latitude !== null && longitude !== null
      ? { latitude, longitude } : null;
  });
  private mapRequest = 0;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly routeQueryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private pendingUrlFilters: EventFilters | null = null;
  readonly selectedDatePreset = computed<DatePreset | null>(() => {
    const { dateFrom, dateTo } = this.eventsStore.filters();
    if (!dateFrom || !dateTo) return null;
    return (
      (['tonight', 'tomorrow', 'weekend'] as DatePreset[]).find((preset) => {
        const range = dateRangeFor(preset);
        return range.dateFrom === dateFrom && range.dateTo === dateTo;
      }) ?? null
    );
  });

  constructor() {
    effect(() => this.syncFiltersFromUrl());
    effect(() => {
      if (this.view() !== 'map') return;
      const filters = this.eventsStore.filters();
      this.locationStore.latitude();
      this.locationStore.longitude();
      void this.loadMap(filters);
    });
  }

  async loadMap(filters = this.eventsStore.filters()) {
    const request = ++this.mapRequest;
    this.mapLoading.set(true);
    this.mapError.set(null);
    try {
      const response = await this.eventsApi.getEvents({ ...filters, page: 1, limit: 100 });
      if (request !== this.mapRequest) return;
      this.mapEvents.set(response.data);
      this.mapTotal.set(response.pagination.total);
    } catch (error) {
      if (request === this.mapRequest) this.mapError.set(toApiProblem(error, 'No hemos podido cargar el mapa.').message);
    } finally {
      if (request === this.mapRequest) this.mapLoading.set(false);
    }
  }

  ngOnInit() {
    void this.favoritesStore.load();
  }
  onSearchChange(searchText: string) {
    this.onFiltersChange({ search: searchText || undefined });
  }
  onDatePresetChange(chosenPreset: DatePreset) {
    const nextPreset = this.selectedDatePreset() === chosenPreset ? null : chosenPreset;
    this.onFiltersChange(
      nextPreset ? dateRangeFor(nextPreset) : { dateFrom: undefined, dateTo: undefined },
    );
  }
  onFiltersChange(filterChanges: Partial<EventFilters>) {
    const currentFilters = this.pendingUrlFilters ?? this.eventsStore.filters();
    const nextFilters = { ...currentFilters, ...filterChanges, page: DEFAULT_EVENT_PAGE };
    this.navigateWithFilters(nextFilters);
  }
  onNumberFilterChange(change: { key: 'minPrice' | 'maxPrice' | 'minimumAge'; value: string }) {
    const numericValue = change.value === '' ? undefined : Number(change.value);
    if (numericValue !== undefined && (!Number.isFinite(numericValue) || numericValue < 0)) return;
    if (
      change.key === 'minimumAge' &&
      numericValue !== undefined &&
      !Number.isInteger(numericValue)
    )
      return;

    const currentFilters = this.pendingUrlFilters ?? this.eventsStore.filters();
    const filterChanges: Partial<EventFilters> = { [change.key]: numericValue };
    if (
      change.key === 'minPrice' &&
      numericValue !== undefined &&
      currentFilters.maxPrice !== undefined &&
      numericValue > currentFilters.maxPrice
    )
      filterChanges.maxPrice = undefined;
    if (
      change.key === 'maxPrice' &&
      numericValue !== undefined &&
      currentFilters.minPrice !== undefined &&
      numericValue < currentFilters.minPrice
    )
      filterChanges.minPrice = undefined;
    this.onFiltersChange(filterChanges);
  }
  onDateFilterChange(change: { key: 'dateFrom' | 'dateTo'; value: string }) {
    if (!change.value) {
      this.onFiltersChange({ [change.key]: undefined });
      return;
    }
    const [year, month, day] = change.value.split('-').map(Number);
    const selectedDate = new Date(
      year,
      month - 1,
      day,
      change.key === 'dateFrom' ? 0 : 23,
      change.key === 'dateFrom' ? 0 : 59,
    );
    if (Number.isNaN(selectedDate.getTime())) return;

    const selectedDateIso = selectedDate.toISOString();
    const currentFilters = this.pendingUrlFilters ?? this.eventsStore.filters();
    const oppositeDateKey = change.key === 'dateFrom' ? 'dateTo' : 'dateFrom';
    const oppositeDate = currentFilters[oppositeDateKey];
    const filterChanges: Partial<EventFilters> = { [change.key]: selectedDateIso };
    if (oppositeDate) {
      const dateRangeIsReversed =
        change.key === 'dateFrom' ? selectedDateIso > oppositeDate : selectedDateIso < oppositeDate;
      if (dateRangeIsReversed) filterChanges[oppositeDateKey] = undefined;
    }
    this.onFiltersChange(filterChanges);
  }
  onFilterRemoved(key: ActiveFilterKey) {
    if (key === 'date') {
      this.onFiltersChange({ dateFrom: undefined, dateTo: undefined });
      return;
    }
    if (key === 'status') {
      this.onFiltersChange({ status: DEFAULT_EVENT_STATUS });
      return;
    }
    if (key === 'sort') {
      this.onFiltersChange({ sort: 'date' });
      return;
    }
    this.onFiltersChange({ [key]: undefined });
  }
  onClearFilters() {
    this.locationStore.clearNearMe();
    this.navigateWithFilters({ ...DEFAULT_EVENT_FILTERS, municipality: undefined });
  }
  onSortChange(value: string) {
    this.onFiltersChange({ sort: value === 'price' || value === 'createdAt' || (value === 'distance' && this.locationStore.mode() === 'automatic') ? value as EventFilters['sort'] : 'date' });
  }
  async onNearMe() {
    if (await this.locationStore.requestNearMe()) {
      this.onFiltersChange({ municipality: undefined, radiusKm: 10, sort: 'distance' });
    }
  }
  onRadiusChange(value: string) {
    const radius = Number(value);
    if ([2, 5, 10, 25, 50].includes(radius)) this.onFiltersChange({ radiusKm: radius as EventFilters['radiusKm'] });
  }
  onStopNearMe() {
    this.locationStore.clearNearMe();
    this.onFiltersChange({ radiusKm: undefined, sort: 'date' });
  }
  onPageChange(page: number) {
    this.navigateWithFilters({ ...(this.pendingUrlFilters ?? this.eventsStore.filters()), page });
  }
  onFavoriteToggle(event: Event) {
    void this.favoritesStore.toggle(event);
  }

  /** The URL owns filter history, so browser back/forward restores the same results. */
  private syncFiltersFromUrl() {
    const queryParams = this.routeQueryParams();
    const parsed = parseEventFilters(queryParams);
    const eventFilters = untracked(() => this.locationStore.mode()) === 'automatic' ? parsed : {
      ...parsed, radiusKm: undefined,
      sort: parsed.sort === 'distance' ? 'date' as const : parsed.sort,
    };
    this.pendingUrlFilters = eventFilters;
    untracked(() => this.locationStore.setMunicipality(eventFilters.municipality || ''));

    const canonicalQueryParams = serializeEventFilters(eventFilters);
    const urlNeedsNormalization =
      queryParams.keys.length !== Object.keys(canonicalQueryParams).length ||
      Object.entries(canonicalQueryParams).some(([key, value]) => queryParams.get(key) !== value);
    if (urlNeedsNormalization) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: canonicalQueryParams,
        replaceUrl: true,
      });
    }
    untracked(() => { void this.eventsStore.replaceFilters(eventFilters); });
  }

  private navigateWithFilters(nextFilters: EventFilters) {
    if (sameEventFilters(nextFilters, this.pendingUrlFilters ?? this.eventsStore.filters())) return;
    this.pendingUrlFilters = nextFilters;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: serializeEventFilters(nextFilters),
    }).then((navigated) => {
      if (navigated) window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}
