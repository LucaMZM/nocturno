import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Pagination } from '../../../core/models/api.model';
import { Event, EventFilters } from '../../../core/models/domain.model';
import { EventsApiService } from '../services/events-api.service';
import { toApiProblem } from '../../../shared/utils/api-error';
import {
  DEFAULT_EVENT_PAGE,
  DEFAULT_EVENT_FILTERS,
  DEFAULT_EVENT_STATUS,
  sameEventFilters,
} from '../../../shared/utils/event-filter-contract';

// STATE: one source for list filters, pagination and the selected public event.
interface EventsState {
  events: Event[];
  selectedEvent: Event | null;
  filters: EventFilters;
  pagination: Pagination;
  loading: boolean;
  loadingMore: boolean;
  detailLoading: boolean;
  error: string | null;
  detailError: string | null;
  initialized: boolean;
}
const initialState: EventsState = {
  events: [],
  selectedEvent: null,
  filters: DEFAULT_EVENT_FILTERS,
  pagination: {
    page: DEFAULT_EVENT_PAGE,
    limit: DEFAULT_EVENT_FILTERS.limit,
    total: 0,
    totalPages: 0,
  },
  loading: false,
  loadingMore: false,
  detailLoading: false,
  error: null,
  detailError: null,
  initialized: false,
};

export const EventsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  // COMPUTED: labels and empty states derive from the current signals.
  withComputed(({ events, filters, pagination }) => ({
    hasEvents: computed(() => events().length > 0),
    totalEvents: computed(() => pagination().total),
    hasActiveFilters: computed(() => {
      const { page: _page, limit: _limit, status, sort, ...active } = filters();
      return (
        sort !== 'date' ||
        status !== DEFAULT_EVENT_STATUS ||
        Object.values(active).some((value) => value !== undefined && value !== '')
      );
    }),
  })),
  // METHODS: load, filter, pagination and detail actions keep HTTP inside the API service.
  withMethods((store, eventsApiService = inject(EventsApiService)) => {
    let latestListRequestId = 0;
    let latestDetailRequestId = 0;

    /** Only the latest response may update the list after rapid filter changes. */
    async function loadEvents() {
      const requestId = ++latestListRequestId;
      const eventFilters = store.filters();
      const appendPage = eventFilters.page > DEFAULT_EVENT_PAGE;
      patchState(store, {
        loading: !appendPage,
        loadingMore: appendPage,
        error: null,
        initialized: true,
      });
      try {
        const eventsResponse = await eventsApiService.getEvents(eventFilters);
        if (requestId !== latestListRequestId) return;
        patchState(store, {
          events: appendPage ? [...store.events(), ...eventsResponse.data] : eventsResponse.data,
          pagination: eventsResponse.pagination,
          loading: false,
          loadingMore: false,
        });
      } catch (error) {
        if (requestId !== latestListRequestId) return;
        patchState(store, {
          error: toApiProblem(error, 'No hemos podido cargar los eventos.').message,
          loading: false,
          loadingMore: false,
        });
      }
    }
    return {
      // LOAD
      loadEvents,

      // FILTERS
      async replaceFilters(filters: EventFilters) {
        if (store.initialized() && sameEventFilters(store.filters(), filters)) return;
        patchState(store, { filters });
        await loadEvents();
      },
      async setFilters(filters: Partial<EventFilters>) {
        patchState(store, {
          filters: { ...store.filters(), ...filters, page: DEFAULT_EVENT_PAGE },
        });
        await loadEvents();
      },
      async updateFilter<K extends keyof EventFilters>(key: K, value: EventFilters[K]) {
        patchState(store, {
          filters: { ...store.filters(), [key]: value, page: DEFAULT_EVENT_PAGE },
        });
        await loadEvents();
      },
      async clearFilters() {
        patchState(store, { filters: { ...DEFAULT_EVENT_FILTERS, municipality: undefined } });
        await loadEvents();
      },
      async removeFilter(key: keyof EventFilters) {
        const value = key === 'status' ? DEFAULT_EVENT_STATUS : key === 'sort' ? 'date' : undefined;
        patchState(store, {
          filters: { ...store.filters(), [key]: value, page: DEFAULT_EVENT_PAGE },
        });
        await loadEvents();
      },

      // PAGINATION AND ORDER
      async setPage(page: number) {
        if (
          page < DEFAULT_EVENT_PAGE ||
          page > store.pagination().totalPages ||
          store.loading() ||
          store.loadingMore()
        )
          return;
        patchState(store, { filters: { ...store.filters(), page } });
        await loadEvents();
      },
      async setSort(sort: EventFilters['sort']) {
        patchState(store, { filters: { ...store.filters(), sort, page: DEFAULT_EVENT_PAGE } });
        await loadEvents();
      },

      // DETAIL
      /** Ignore an older detail response when the user navigates to a new slug. */
      async loadEventBySlug(eventSlug: string) {
        const requestId = ++latestDetailRequestId;
        patchState(store, { selectedEvent: null, detailLoading: true, detailError: null });
        try {
          const eventResponse = await eventsApiService.getEventBySlug(eventSlug);
          if (requestId === latestDetailRequestId)
            patchState(store, { selectedEvent: eventResponse.data, detailLoading: false });
        } catch (error) {
          if (requestId === latestDetailRequestId)
            patchState(store, {
              detailError: toApiProblem(error, 'No hemos podido cargar este evento.').message,
              detailLoading: false,
            });
        }
      },

      // ACTIONS
      async refreshEvents() {
        await loadEvents();
      },
    };
  }),
);
