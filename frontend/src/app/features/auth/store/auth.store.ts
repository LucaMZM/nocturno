import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { User } from '../../../core/models/domain.model';
import { toApiProblem } from '../../../shared/utils/api-error';
import { AuthApiService, AuthSession } from '../services/auth-api.service';

interface AuthState {
  user: User | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null, initialized: false, loading: false, error: null
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ user }) => ({ isAuthenticated: computed(() => !!user()) })),
  withMethods((store, api = inject(AuthApiService)) => {
    let refreshInProgress: Promise<boolean> | null = null;
    let sessionVersion = 0;
    let loggedOut = false;
    // Serialize cookie-writing responses, not just state updates. Logout waits for a
    // pending refresh/login before clearing cookies, and a new login waits for logout.
    let authQueue: Promise<unknown> = Promise.resolve();
    function serialize<T>(operation: () => Promise<T>): Promise<T> {
      const pending = authQueue.then(operation, operation);
      authQueue = pending.catch(() => {});
      return pending;
    }
    function acceptSession(session: AuthSession) {
      patchState(store, { user: session.user,
        initialized: true, loading: false, error: null });
    }
    async function refresh(): Promise<boolean> {
      if (loggedOut) return false;
      if (refreshInProgress) return refreshInProgress;
      const requestVersion = sessionVersion;
      refreshInProgress = (async () => {
        try {
          const response = await serialize(() => api.refresh());
          if (requestVersion !== sessionVersion) return false;
          acceptSession(response.data);
          return true;
        } catch (error) {
          if (requestVersion === sessionVersion)
            patchState(store, { user: null, initialized: true,
              error: (error as { status?: number })?.status === 401 ? null : 'No hemos podido comprobar la sesión. Inténtalo de nuevo.' });
          return false;
        } finally { refreshInProgress = null; }
      })();
      return refreshInProgress;
    }
    return {
      refresh,
      async retrySession() {
        if (loggedOut) {
          const requestVersion = sessionVersion;
          try { await serialize(() => api.logout());
            if (requestVersion === sessionVersion) patchState(store, { error: null });
          } catch { /* Keep the explicit logout failure visible. */ }
        } else await refresh();
      },
      async bootstrap() {
        if (store.initialized()) return;
        await refresh();
      },
      async login(email: string, password: string): Promise<boolean> {
        const requestVersion = ++sessionVersion;
        patchState(store, { loading: true, error: null });
        try { const session = (await serialize(() => api.login(email, password))).data;
          if (requestVersion !== sessionVersion) return false;
          loggedOut = false; acceptSession(session); return true; }
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
        try { const session = (await serialize(() => api.register(email, password, displayName))).data;
          if (requestVersion !== sessionVersion) return false;
          loggedOut = false; acceptSession(session); return true; }
        catch (error) {
          if (requestVersion !== sessionVersion) return false;
          patchState(store, { loading: false,
            error: toApiProblem(error, 'No hemos podido crear la cuenta.').message });
          return false;
        }
      },
      async logout() {
        const requestVersion = ++sessionVersion;
        loggedOut = true;
        patchState(store, { user: null, initialized: true, loading: true, error: null });
        try { await serialize(() => api.logout()); }
        catch {
          if (requestVersion === sessionVersion)
            patchState(store, { error: 'No se ha podido cerrar la sesión en el servidor. Reintenta al recuperar la conexión.' });
        } finally {
          if (requestVersion === sessionVersion) patchState(store, { user: null, initialized: true, loading: false });
        }
      },
      getSessionVersion: () => sessionVersion,
      updateSessionUser(user: User, expectedVersion: number): boolean {
        if (expectedVersion !== sessionVersion || !store.user() || user.id !== store.user()?.id) return false;
        patchState(store, { user });
        return true;
      },
      clearError() { patchState(store, { error: null }); }
    };
  })
);
