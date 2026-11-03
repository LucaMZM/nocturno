import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { User } from '../../../core/models/domain.model';
import { toApiProblem } from '../../../shared/utils/api-error';
import { AuthApiService, AuthSession } from '../services/auth-api.service';

interface AuthState {
  user: User | null;
  csrfToken: string | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
}
const initialState: AuthState = {
  user: null, csrfToken: null, initialized: false, loading: false, error: null
};

// Auth credentials live only in HttpOnly cookies. This store contains display
// state and the per-session CSRF proof, never a JWT or refresh/session secret.
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ user }) => ({ isAuthenticated: computed(() => !!user()) })),
  withMethods((store, api = inject(AuthApiService)) => {
    let refreshInProgress: Promise<boolean> | null = null;
    let sessionVersion = 0;
    function acceptSession(session: AuthSession) {
      patchState(store, { user: session.user, csrfToken: session.csrfToken,
        initialized: true, loading: false, error: null });
    }
    function endLocalSession() {
      patchState(store, { user: null, csrfToken: null, initialized: true, loading: false });
    }
    async function refresh(): Promise<boolean> {
      if (refreshInProgress) return refreshInProgress;
      const requestVersion = sessionVersion;
      refreshInProgress = (async () => {
        try {
          const response = await api.refresh();
          if (requestVersion !== sessionVersion) return false;
          acceptSession(response.data);
          return true;
        } catch {
          if (requestVersion === sessionVersion) endLocalSession();
          return false;
        } finally { refreshInProgress = null; }
      })();
      return refreshInProgress;
    }
    return {
      refresh,
      async bootstrap() {
        if (store.initialized()) return;
        const version = sessionVersion;
        try {
          const response = await api.session();
          if (version === sessionVersion) acceptSession(response.data);
        } catch {
          if (version === sessionVersion) await refresh();
        }
      },
      async login(email: string, password: string): Promise<boolean> {
        const version = ++sessionVersion;
        patchState(store, { loading: true, error: null });
        try {
          const session = (await api.login(email, password)).data;
          if (version !== sessionVersion) return false;
          acceptSession(session);
          return true;
        } catch (error) {
          if (version !== sessionVersion) return false;
          patchState(store, { loading: false,
            error: toApiProblem(error, 'No hemos podido iniciar sesión. Revisa tus datos.').message });
          return false;
        }
      },
      async register(email: string, password: string, displayName: string): Promise<boolean> {
        const version = ++sessionVersion;
        patchState(store, { loading: true, error: null });
        try {
          const session = (await api.register(email, password, displayName)).data;
          if (version !== sessionVersion) return false;
          acceptSession(session);
          return true;
        } catch (error) {
          if (version !== sessionVersion) return false;
          patchState(store, { loading: false,
            error: toApiProblem(error, 'No hemos podido crear la cuenta.').message });
          return false;
        }
      },
      async logout(): Promise<boolean> {
        if (!store.user()) return true;
        const csrf = store.csrfToken();
        const version = ++sessionVersion;
        patchState(store, { loading: true, error: null });
        try {
          await api.logout(csrf);
          if (version === sessionVersion) endLocalSession();
          return true;
        } catch {
          if (version === sessionVersion)
            patchState(store, { loading: false,
              error: 'No se ha podido cerrar la sesión en el servidor. Inténtalo de nuevo.' });
          // Never tell the user they logged out while HttpOnly cookies might still be valid.
          return false;
        }
      },
      getSessionVersion: () => sessionVersion,
      updateSessionUser(user: User, expectedVersion: number): boolean {
        if (expectedVersion !== sessionVersion || !store.user() ||
            user.id !== store.user()?.id) return false;
        patchState(store, { user });
        return true;
      },
      clearError() { patchState(store, { error: null }); }
    };
  })
);
