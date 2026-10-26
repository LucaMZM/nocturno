import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Pagination } from '../../../core/models/api.model';
import { User } from '../../../core/models/domain.model';
import { toApiProblem } from '../../../shared/utils/api-error';
import { UsersApiService } from '../services/users-api.service';

export const UsersStore = signalStore(
  withState({ users: [] as User[], loading: false, saving: false, error: null as string | null,
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } as Pagination }),
  withMethods((store, api = inject(UsersApiService)) => ({
    async loadUsers(page = 1, search = '', role = '') {
      patchState(store, { loading: true, error: null });
      try { const response = await api.getUsers(page, search, role);
        patchState(store, { users: response.data, pagination: response.pagination, loading: false }); }
      catch (error) { patchState(store, { users: [], loading: false,
        error: toApiProblem(error, 'No hemos podido cargar los datos.').message }); }
    },
      async saveUser(id: string | null, payload: object) {
        patchState(store, { saving: true, error: null });
        try { const response = id ? await api.updateUser(id, payload) : await api.createUser(payload);
          patchState(store, { saving: false }); return response.data; }
        catch (error) { patchState(store, { saving: false,
          error: toApiProblem(error, 'No hemos podido guardar el usuario.').message }); return null; }
      },
  })),
);
