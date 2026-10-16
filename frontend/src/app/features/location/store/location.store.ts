import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { VenuesApiService } from '../../../core/services/venues-api.service';
import { toApiProblem } from '../../../shared/utils/api-error';
import { DEFAULT_EVENT_MUNICIPALITY } from '../../../shared/utils/event-filter-contract';
import { geolocationMessage, locateUser } from '../utils/geolocation';

interface LocationState {
  municipality: string;
  municipalities: string[];
  provinces: string[];
  mode: 'manual' | 'automatic';
  radiusKm: number | null;
  latitude: number | null;
  longitude: number | null;
  locating: boolean;
  geolocationError: string | null;
  loading: boolean;
  error: string | null;
  loaded: boolean;
}

const initialState: LocationState = {
  municipality: DEFAULT_EVENT_MUNICIPALITY,
  municipalities: [DEFAULT_EVENT_MUNICIPALITY],
  provinces: [],
  mode: 'manual',
  radiusKm: null,
  latitude: null,
  longitude: null,
  locating: false,
  geolocationError: null,
  loading: false,
  error: null,
  loaded: false,
};

export const LocationStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ municipality }) => ({
    locationLabel: computed(() => municipality() || 'Todas las localidades'),
  })),
  withMethods((store, venuesApi = inject(VenuesApiService)) => ({
    setMunicipality(municipality: string) {
      if (store.municipality() === municipality) return;
      patchState(store, { municipality, mode: 'manual', latitude: null, longitude: null, geolocationError: null });
    },
    clearNearMe() {
      patchState(store, { mode: 'manual', latitude: null, longitude: null, radiusKm: null, geolocationError: null });
    },
    async requestNearMe(): Promise<boolean> {
      patchState(store, { locating: true, geolocationError: null });
      try {
        const position = await locateUser(typeof navigator === 'undefined' ? undefined : navigator.geolocation);
        patchState(store, {
          municipality: '', mode: 'automatic',
          latitude: position.latitude, longitude: position.longitude,
          radiusKm: 10, locating: false,
        });
        return true;
      } catch (error) {
        patchState(store, {
          locating: false,
          geolocationError: geolocationMessage(error),
        });
        return false;
      }
    },
    async loadMunicipalities() {
      if (store.loaded() || store.loading()) return;
      patchState(store, { loading: true, error: null });
      try {
        const names = new Set<string>();
        const provinces = new Set<string>();
        let page = 1;
        let totalPages = 1;
        do {
          const result = await venuesApi.getVenues(page);
          result.data.forEach((venue) => {
            names.add(venue.municipality);
            provinces.add(venue.province);
          });
          totalPages = result.pagination.totalPages;
          page++;
        } while (page <= totalPages);
        if (store.municipality()) names.add(store.municipality());
        patchState(store, {
          municipalities: [...names].sort((a, b) => a.localeCompare(b, 'es')),
          provinces: [...provinces].sort((a, b) => a.localeCompare(b, 'es')),
          loading: false,
          loaded: true,
        });
      } catch (error) {
        patchState(store, {
          error: toApiProblem(error, 'No se pudieron cargar las localidades.').message,
          loading: false,
        });
      }
    },
  })),
);
