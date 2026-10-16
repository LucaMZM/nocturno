import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { User } from '../../../core/models/domain.model';
import { toApiProblem } from '../../../shared/utils/api-error';
import { AuthApiService, AuthSession } from '../services/auth-api.service';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null, accessToken: null, initialized: false, loading: false, error: null
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ user }) => ({ isAuthenticated: computed(() => !!user()) })),
  withMethods((store, api = inject(AuthApiService)) => {
    let refreshInProgress: Promise<string | null> | null = null;
    let sessionVersion = 0;
    function acceptSession(session: AuthSession) {
      patchState(store, { user: session.user, accessToken: session.accessToken,
        initialized: true, loading: false, error: null });
    }
    async function refresh(): Promise<string | null> {
      if (refreshInProgress) return refreshInProgress;
      const requestVersion = sessionVersion;
      refreshInProgress = (async () => {
        try {
          const response = await api.refresh();
          if (requestVersion !== sessionVersion) return null;
          acceptSession(response.data);
          return response.data.accessToken;
        } catch {
          if (requestVersion === sessionVersion)
            patchState(store, { user: null, accessToken: null, initialized: true });
          return null;
        } finally { refreshInProgress = null; }
      })();
      return refreshInProgress;
    }
    return {
      refresh,
      async bootstrap() {
        if (store.initialized()) return;
        await refresh();
      },
      async login(email: string, password: string): Promise<boolean> {
        const requestVersion = ++sessionVersion;
        patchState(store, { loading: true, error: null });
        try { const session = (await api.login(email, password)).data;
          if (requestVersion !== sessionVersion) return false;
          acceptSession(session); return true; }
        catch (error) {
          if (requestVersion !== sessionVersion) return false;
          patchState(store, { loading: false,
            error: toApiProblem(error, 'No hemos podido iniciar sesión. Revisa tus datos.').message });
          return false;
        }
      },
      async register(email: string, password: string, displayName: string): Promise<boolean> {
        const requestVersion = ++sessionVersion;
        patchState(store, { loading: true, error: null });
        try { const session = (await api.register(email, password, displayName)).data;
          if (requestVersion !== sessionVersion) return false;
          acceptSession(session); return true; }
        catch (error) {
          if (requestVersion !== sessionVersion) return false;
          patchState(store, { loading: false,
            error: toApiProblem(error, 'No hemos podido crear la cuenta.').message });
          return false;
        }
      },
      async logout() {
        sessionVersion++;
        patchState(store, { user: null, accessToken: null, initialized: true });
        try { await api.logout(); }
        catch { /* The local session still ends when the API is unavailable. */ }
        finally { patchState(store, { user: null, accessToken: null, initialized: true }); }
      },
      async updateProfile(displayName: string): Promise<boolean> {
        try {
          patchState(store, { user: (await api.updateProfile(displayName)).data, error: null });
          return true;
        } catch (error) {
          patchState(store, { error: toApiProblem(error, 'No hemos podido guardar tu perfil.').message });
          return false;
        }
      },
      clearError() { patchState(store, { error: null }); }
    };
  })
);
