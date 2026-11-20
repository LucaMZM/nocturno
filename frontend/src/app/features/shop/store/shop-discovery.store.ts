import { inject } from '@angular/core';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { ShopApiService, ShopEntry } from '../services/shop-api.service';

export const ShopDiscoveryStore = signalStore(
  withState({ categories: [] as ShopEntry[], hosts: [] as ShopEntry[], locations: [] as ShopEntry[],
    loading: false, error: false }),
  withMethods((store, api = inject(ShopApiService)) => ({
    async load() {
      if (store.loading()) return;
      patchState(store, { loading: true, error: false });
      try {
        const [categories, hosts, locations] = await Promise.all([
          api.getCategories(), api.getHosts(), api.getLocations(),
        ]);
        patchState(store, { categories: categories.data, hosts: hosts.data, locations: locations.data });
      } catch { patchState(store, { error: true }); }
      finally { patchState(store, { loading: false }); }
    },
  })),
);
