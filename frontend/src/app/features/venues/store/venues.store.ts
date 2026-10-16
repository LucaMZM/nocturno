import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Pagination } from '../../../core/models/api.model';
import { Venue } from '../../../core/models/domain.model';
import { PublicVenueProfile, VenuesApiService } from '../../../core/services/venues-api.service';
import { toApiProblem } from '../../../shared/utils/api-error';

interface VenueState { venues: Venue[]; selected: Venue | null; publicProfile: PublicVenueProfile | null; pagination: Pagination;
  loading: boolean; saving: boolean; error: string | null; }
const initialState: VenueState = { venues: [], selected: null, publicProfile: null,
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }, loading: false, saving: false, error: null };
export const VenuesStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(VenuesApiService)) => ({
    async load(page = 1) {
      patchState(store, { loading: true, error: null });
      try { const response = await api.getVenues(page, 20);
        patchState(store, { venues: response.data, pagination: response.pagination, loading: false }); }
      catch (error) { patchState(store, { loading: false,
        error: toApiProblem(error, 'No hemos podido cargar los locales.').message }); }
    },
    async loadOne(id: string) {
      patchState(store, { loading: true, error: null, selected: null });
      try { patchState(store, { selected: (await api.getVenue(id)).data, loading: false }); }
      catch (error) { patchState(store, { loading: false,
        error: toApiProblem(error, 'No hemos podido cargar el local.').message }); }
    },
    async loadPublicProfile(slug: string) {
      patchState(store, { loading: true, error: null, publicProfile: null });
      try { patchState(store, { publicProfile: (await api.getPublicProfile(slug)).data, loading: false }); }
      catch (error) { patchState(store, { loading: false,
        error: toApiProblem(error, 'No hemos podido cargar este local.').message }); }
    },
    async save(id: string | null, payload: object): Promise<Venue | null> {
      patchState(store, { saving: true, error: null });
      try { const response = id ? await api.updateVenue(id, payload) : await api.createVenue(payload);
        patchState(store, { selected: response.data, saving: false }); return response.data; }
      catch (error) { patchState(store, { saving: false,
        error: toApiProblem(error, 'No hemos podido guardar el local.').message }); return null; }
    },
    async remove(id: string): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try { await api.removeVenue(id); patchState(store, { saving: false }); return true; }
      catch (error) { patchState(store, { saving: false,
        error: toApiProblem(error, 'No se puede eliminar un local con eventos relacionados.').message }); return false; }
    }
  }))
);
