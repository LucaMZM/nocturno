import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Pagination } from '../../../core/models/api.model';
import { Promoter } from '../../../core/models/domain.model';
import { PublicPromoterProfile, PromotersApiService } from '../../../core/services/promoters-api.service';
import { toApiProblem } from '../../../shared/utils/api-error';

interface PromoterState { promoters: Promoter[]; selected: Promoter | null; publicProfile: PublicPromoterProfile | null; pagination: Pagination;
  loading: boolean; saving: boolean; error: string | null; }
const initialState: PromoterState = { promoters: [], selected: null, publicProfile: null,
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }, loading: false, saving: false, error: null };
export const PromotersStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(PromotersApiService)) => ({
    async load(page = 1) {
      patchState(store, { loading: true, error: null });
      try { const response = await api.getPromoters(page, 20);
        patchState(store, { promoters: response.data, pagination: response.pagination, loading: false }); }
      catch (error) { patchState(store, { loading: false,
        error: toApiProblem(error, 'No hemos podido cargar los promotores.').message }); }
    },
    async loadOne(id: string) {
      patchState(store, { loading: true, error: null, selected: null });
      try { patchState(store, { selected: (await api.getPromoter(id)).data, loading: false }); }
      catch (error) { patchState(store, { loading: false,
        error: toApiProblem(error, 'No hemos podido cargar el promotor.').message }); }
    },
    async loadPublicProfile(slug: string) {
      patchState(store, { loading: true, error: null, publicProfile: null });
      try { patchState(store, { publicProfile: (await api.getPublicProfile(slug)).data, loading: false }); }
      catch (error) { patchState(store, { loading: false,
        error: toApiProblem(error, 'No hemos podido cargar este promotor.').message }); }
    },
    async save(id: string | null, payload: object): Promise<Promoter | null> {
      patchState(store, { saving: true, error: null });
      try { const response = id ? await api.updatePromoter(id, payload) : await api.createPromoter(payload);
        patchState(store, { selected: response.data, saving: false }); return response.data; }
      catch (error) { patchState(store, { saving: false,
        error: toApiProblem(error, 'No hemos podido guardar el promotor.').message }); return null; }
    },
    async remove(id: string): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try { await api.removePromoter(id); patchState(store, { saving: false }); return true; }
      catch (error) { patchState(store, { saving: false,
        error: toApiProblem(error, 'No se puede eliminar un promotor con eventos relacionados.').message }); return false; }
    }
  }))
);
