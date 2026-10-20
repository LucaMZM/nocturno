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
  templateUrl: './events-list.page.html',
})
export class EventsListPage implements OnInit {
  // State exposed to the template: the list store owns results; map data stays local to this page.
  readonly eventsStore = inject(EventsStore);
  readonly favoritesStore = inject(FavoritesStore);
  readonly locationStore = inject(LocationStore);
  readonly auth = inject(AuthStore);
  private readonly eventsApi = inject(EventsApiService);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly urlQueryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  // Holds the next filter set while Router has not emitted the new query params yet.
  private filtersAwaitingNavigation: EventFilters | null = null;

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
  private latestMapRequestId = 0;
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
    // The URL drives list filters, including browser back and forward navigation.
    effect(() => this.syncFiltersFromUrl());
    // Map uses the same filters as the list and reloads when position changes.
    effect(() => {
      if (this.view() !== 'map') return;
      const filters = this.eventsStore.filters();
      this.locationStore.latitude();
      this.locationStore.longitude();
      void this.loadMap(filters);
    });
  }

  ngOnInit() {
    void this.favoritesStore.load();
  }

  // Search, quick dates and modal controls all converge on the same URL update.
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
    const currentFilters = this.filtersAwaitingNavigation ?? this.eventsStore.filters();
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

    const currentFilters = this.filtersAwaitingNavigation ?? this.eventsStore.filters();
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
    const currentFilters = this.filtersAwaitingNavigation ?? this.eventsStore.filters();
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
    const validSort =
      value === 'price' ||
      value === 'createdAt' ||
      (value === 'distance' && this.locationStore.mode() === 'automatic');
    this.onFiltersChange({ sort: validSort ? (value as EventFilters['sort']) : 'date' });
  }

  // Position is requested only after the user chooses "Cerca de mí".
  async onNearMe() {
    if (await this.locationStore.requestNearMe()) {
      this.onFiltersChange({ municipality: undefined, radiusKm: 10, sort: 'distance' });
    }
  }

  onRadiusChange(value: string) {
    const radius = Number(value);
    if ([2, 5, 10, 25, 50].includes(radius)) {
      this.onFiltersChange({ radiusKm: radius as EventFilters['radiusKm'] });
    }
  }

  onStopNearMe() {
    this.locationStore.clearNearMe();
    this.onFiltersChange({ radiusKm: undefined, sort: 'date' });
  }

  // Map requests mirror list filters but fetch up to 100 results for markers.
  async loadMap(filters = this.eventsStore.filters()) {
    const requestId = ++this.latestMapRequestId;
    this.mapLoading.set(true);
    this.mapError.set(null);
    try {
      const response = await this.eventsApi.getEvents({ ...filters, page: 1, limit: 100 });
      if (requestId !== this.latestMapRequestId) return;
      this.mapEvents.set(response.data);
      this.mapTotal.set(response.pagination.total);
    } catch (error) {
      if (requestId === this.latestMapRequestId) {
        this.mapError.set(toApiProblem(error, 'No hemos podido cargar el mapa.').message);
      }
    } finally {
      if (requestId === this.latestMapRequestId) this.mapLoading.set(false);
    }
  }

  // Pagination and favorites complete the list interactions.
  onPageChange(page: number) {
    this.navigateWithFilters({
      ...(this.filtersAwaitingNavigation ?? this.eventsStore.filters()),
      page,
    });
  }

  onFavoriteToggle(event: Event) {
    void this.favoritesStore.toggle(event);
  }

  /** Parse and normalize the URL, then give the list store its filter set. */
  private syncFiltersFromUrl() {
    const queryParams = this.urlQueryParams();
    const parsedFilters = parseEventFilters(queryParams);
    // Location mode must not retrigger this URL effect: only query params are its input.
    const eventFilters = untracked(() => this.locationStore.mode()) === 'automatic'
      ? parsedFilters
      : {
          ...parsedFilters,
          radiusKm: undefined,
          sort: parsedFilters.sort === 'distance' ? 'date' as const : parsedFilters.sort,
        };
    this.filtersAwaitingNavigation = eventFilters;
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
    // Store updates read signals internally; untracked keeps them out of this URL effect.
    untracked(() => { void this.eventsStore.replaceFilters(eventFilters); });
  }

  private navigateWithFilters(nextFilters: EventFilters) {
    if (sameEventFilters(nextFilters, this.filtersAwaitingNavigation ?? this.eventsStore.filters())) {
      return;
    }
    this.filtersAwaitingNavigation = nextFilters;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: serializeEventFilters(nextFilters),
    }).then((navigated) => {
      if (navigated) window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}
