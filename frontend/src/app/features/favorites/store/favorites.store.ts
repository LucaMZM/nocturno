import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Event } from '../../../core/models/domain.model';
import { FavoritesApiService } from '../../../core/services/favorites-api.service';
import { toApiProblem } from '../../../shared/utils/api-error';
import { AuthStore } from '../../auth/store/auth.store';

interface FavoritesState {
  events: Event[];
  loading: boolean;
  error: string | null;
  message: string | null;
  pendingIds: string[];
}
const initialState: FavoritesState = {
  events: [],
  loading: false,
  error: null,
  message: null,
  pendingIds: [],
};

export const FavoritesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ events }) => ({
    favoriteIds: computed(() => new Set(events().map((event) => event.id))),
  })),
  withMethods(
    (
      store,
      api = inject(FavoritesApiService),
      auth = inject(AuthStore),
    ) => {
      let version = 0;
      return {
      async load() {
        if (!auth.user()) { patchState(store, { events: [], loading: false }); return; }
        if (store.loading()) return;
        const requestVersion = version;
        const userId = auth.user()!.id;
        patchState(store, { loading: true, error: null });
        try {
          const all: Event[] = [];
          let page = 1;
          let totalPages = 1;
          do {
            const result = await api.getFavorites(page);
            all.push(...result.data);
            totalPages = result.pagination.totalPages;
            page++;
          } while (page <= totalPages);
          if (requestVersion === version && auth.user()?.id === userId)
            patchState(store, { events: all, loading: false });
        } catch (error) {
          if (requestVersion !== version) return;
          patchState(store, {
            error: toApiProblem(error, 'No hemos podido cargar tus favoritos.').message,
            loading: false,
          });
        }
      },
      async toggle(event: Event) {
        if (!auth.user()) {
          patchState(store, { message: 'Inicia sesión para guardar eventos.' });
          return;
        }
        if (store.pendingIds().includes(event.id)) return;
        const requestVersion = version;
        const wasFavorite = store.favoriteIds().has(event.id);
        patchState(store, { pendingIds: [...store.pendingIds(), event.id], message: null });
        try {
          if (wasFavorite) {
            await api.removeFavorite(event.id);
            if (requestVersion === version)
              patchState(store, { events: store.events().filter((item) => item.id !== event.id) });
          } else {
            await api.addFavorite(event.id);
            if (requestVersion === version) patchState(store, { events: [event, ...store.events()] });
          }
        } catch (error) {
          if (requestVersion !== version) return;
          const problem = toApiProblem(error, 'No hemos podido actualizar este favorito.');
          if (problem.code === 'DUPLICATE_FAVORITE')
            patchState(store, {
              events: [event, ...store.events().filter((item) => item.id !== event.id)],
            });
          else patchState(store, { message: problem.message });
        } finally {
          if (requestVersion === version)
            patchState(store, { pendingIds: store.pendingIds().filter((id) => id !== event.id) });
        }
      },
      clearMessage() {
        patchState(store, { message: null });
      },
      reset() { version++; patchState(store, initialState); },
    };
    },
  ),
);
