import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { AuthStore } from '../../auth/store/auth.store';
import { ProfileApiService } from '../services/profile-api.service';
import { toApiProblem } from '../../../shared/utils/api-error';

export const ProfileStore = signalStore(
  withState({ loading: false, saving: false, saved: false, error: null as string | null }),
  withComputed((_store, auth = inject(AuthStore)) => ({ user: computed(() => auth.user()) })),
  withMethods((store, api = inject(ProfileApiService), auth = inject(AuthStore)) => {
    let version = 0;
    return {
      clearFeedback() { patchState(store, { saved: false, error: null }); },
      async load(): Promise<boolean> {
        const request = ++version, session = auth.getSessionVersion();
        patchState(store, { loading: true, saved: false, error: null });
        try {
          const user = (await api.getMine()).data;
          if (request !== version || !auth.updateSessionUser(user, session)) return false;
          return true;
        } catch (error) {
          if (request === version && session === auth.getSessionVersion())
            patchState(store, { error: toApiProblem(error, 'No hemos podido cargar tu perfil.').message });
          return false;
        } finally { if (request === version) patchState(store, { loading: false }); }
      },
      async save(displayName: string): Promise<boolean> {
        if (store.loading() || store.saving() || !auth.user()) return false;
        const request = ++version, session = auth.getSessionVersion();
        patchState(store, { saving: true, saved: false, error: null });
        try {
          const user = (await api.updateMine(displayName)).data;
          if (request !== version || !auth.updateSessionUser(user, session)) return false;
          patchState(store, { saved: true });
          return true;
        } catch (error) {
          if (request === version && session === auth.getSessionVersion())
            patchState(store, { error: toApiProblem(error, 'No hemos podido guardar tu perfil.').message });
          return false;
        } finally { if (request === version) patchState(store, { saving: false }); }
      },
    };
  }),
);
