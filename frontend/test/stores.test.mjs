import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import '@angular/compiler';
import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { build } from 'esbuild';

// Angular's existing build dependency compiles the real stores for Node tests.
// The services are provided as fakes; no browser, HTTP server or new package is needed.
const bundleDirectory = join(process.cwd(), 'node_modules', '.cache', 'nocturno-store-tests');
const bundlePath = join(bundleDirectory, `stores-${process.pid}.mjs`);
await mkdir(bundleDirectory, { recursive: true });
await build({
  stdin: {
    contents: `
      export { EventsStore } from './src/app/features/events/store/events.store.ts';
      export { EventsApiService } from './src/app/features/events/services/events-api.service.ts';
      export { EventDetailStore } from './src/app/features/events/store/event-detail.store.ts';
      export { VenuesApiService } from './src/app/core/services/venues-api.service.ts';
      export { PromotersApiService } from './src/app/core/services/promoters-api.service.ts';
      export { TicketTypesApiService } from './src/app/core/services/ticket-types-api.service.ts';
      export { AuthStore } from './src/app/features/auth/store/auth.store.ts';
      export { AuthApiService } from './src/app/features/auth/services/auth-api.service.ts';
      export { ProfileStore } from './src/app/features/profile/store/profile.store.ts';
      export { ProfileApiService } from './src/app/features/profile/services/profile-api.service.ts';
      export { UsersStore } from './src/app/features/users/store/users.store.ts';
      export { UsersApiService } from './src/app/features/users/services/users-api.service.ts';
      export { CartStore } from './src/app/features/cart/store/cart.store.ts';
      export { CartApiService } from './src/app/features/cart/services/cart-api.service.ts';
      export { authInterceptor } from './src/app/features/auth/auth.interceptor.ts';
    `,
    resolveDir: process.cwd(),
    sourcefile: 'store-harness.ts',
    loader: 'ts',
  },
  bundle: true,
  packages: 'external',
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
});
after(() => rm(bundlePath, { force: true }));

const {
  EventsStore, EventsApiService, EventDetailStore, VenuesApiService,
  PromotersApiService, TicketTypesApiService, AuthStore, AuthApiService,
  ProfileStore, ProfileApiService, UsersStore, UsersApiService, authInterceptor, CartStore, CartApiService,
} = await import(pathToFileURL(bundlePath).href);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function listResponse(id, totalPages = 1) {
  return { data: [{ id }], pagination: { page: 1, limit: 12, total: totalPages, totalPages } };
}

test('rapid filters keep only the newest response and finish loading', async () => {
  const requests = [];
  const api = { getEvents(filters) {
    const result = deferred();
    requests.push({ filters, result });
    return result.promise;
  } };
  const injector = createEnvironmentInjector([{ provide: EventsApiService, useValue: api }, EventsStore]);
  try {
    const store = injector.get(EventsStore);
    const first = store.setFilters({ search: 'primero' });
    const second = store.setFilters({ search: 'último' });
    assert.equal(store.loading(), true);
    assert.deepEqual(requests.map(({ filters }) => filters.search), ['primero', 'último']);
    requests[1].result.resolve(listResponse('último'));
    await second;
    requests[0].result.resolve(listResponse('obsoleto'));
    await first;
    assert.equal(store.events()[0].id, 'último');
    assert.equal(store.filters().search, 'último');
    assert.equal(store.loading(), false);
    assert.equal(store.error(), null);
  } finally { injector.destroy(); }
});

test('a new filter blocks pagination until its first page finishes', async () => {
  const pending = deferred();
  let calls = 0;
  const api = { getEvents() {
    calls++;
    return calls === 1 ? Promise.resolve(listResponse('original', 3)) : pending.promise;
  } };
  const injector = createEnvironmentInjector([{ provide: EventsApiService, useValue: api }, EventsStore]);
  try {
    const store = injector.get(EventsStore);
    await store.loadEvents();
    const reloading = store.setFilters({ genre: 'TECHNO' });
    assert.equal(store.loading(), true);
    await store.setPage(2);
    assert.equal(calls, 2);
    assert.equal(store.filters().page, 1);
    pending.resolve(listResponse('filtrado', 2));
    await reloading;
    assert.equal(store.events()[0].id, 'filtrado');
    assert.equal(store.loading(), false);
  } finally { injector.destroy(); }
});

test('event loading exposes errors and ignores an older detail response', async () => {
  const first = deferred();
  const second = deferred();
  const api = {
    getEvents: () => Promise.reject(new Error('API unavailable')),
    getEventBySlug: (slug) => slug === 'first' ? first.promise : second.promise,
  };
  const injector = createEnvironmentInjector([{ provide: EventsApiService, useValue: api }, EventsStore]);
  try {
    const store = injector.get(EventsStore);
    const loading = store.loadEvents();
    assert.equal(store.loading(), true);
    await loading;
    assert.equal(store.loading(), false);
    assert.equal(store.error(), 'No hemos podido cargar los eventos.');

    const older = store.loadEventBySlug('first');
    const latest = store.loadEventBySlug('latest');
    assert.equal(store.detailLoading(), true);
    second.resolve({ data: { id: 'latest', slug: 'latest' } });
    await latest;
    first.resolve({ data: { id: 'first', slug: 'first' } });
    await older;
    assert.equal(store.selectedEvent().slug, 'latest');
    assert.equal(store.detailLoading(), false);
  } finally { injector.destroy(); }
});

test('an old profile response cannot restore a logged-out user', async () => {
  const profile = deferred();
  const user = { id: 'user-1', displayName: 'Original', role: 'USER' };
  const api = {
    login: async () => ({ data: { user, accessToken: 'demo-token' } }),
    logout: async () => {},
  };
  const injector = createEnvironmentInjector([{ provide: AuthApiService, useValue: api },
    { provide: ProfileApiService, useValue: { updateMine: () => profile.promise } }, AuthStore, ProfileStore]);
  try {
    const store = injector.get(AuthStore);
    assert.equal(await store.login('demo@example.test', 'demo'), true);
    const updating = injector.get(ProfileStore).save('Nuevo');
    await store.logout();
    profile.resolve({ data: { ...user, displayName: 'Nuevo' } });
    assert.equal(await updating, false);
    assert.equal(store.user(), null);
    assert.equal(store.accessToken(), null);
  } finally { injector.destroy(); }
});

test('a waitlist response from another event does not update the current detail', async () => {
  const waitlist = deferred();
  let joins = 0;
  const eventApi = { joinWaitlist() { joins++; return waitlist.promise; } };
  const venues = { getVenue: async (id) => ({ data: { id } }) };
  const ticketTypes = { getByEvent: async () => ({ data: [] }) };
  const injector = createEnvironmentInjector([
    { provide: EventsApiService, useValue: eventApi },
    { provide: VenuesApiService, useValue: venues },
    { provide: PromotersApiService, useValue: {} },
    { provide: TicketTypesApiService, useValue: ticketTypes },
    { provide: AuthApiService, useValue: {} },
    AuthStore, EventDetailStore,
  ]);
  try {
    const store = injector.get(EventDetailStore);
    await store.loadEventRelations({ id: 'event-a', venueId: 'venue-a', promoterId: null });
    const joining = store.joinWaitlist('event-a');
    await store.joinWaitlist('event-a');
    assert.equal(joins, 1);
    assert.equal(store.waitlistPending(), true);
    await store.loadEventRelations({ id: 'event-b', venueId: 'venue-b', promoterId: null });
    assert.equal(store.waitlistPending(), false);
    waitlist.resolve({ data: { joined: true } });
    await joining;
    assert.equal(store.venue().id, 'venue-b');
    assert.equal(store.joinedWaitlist(), false);
    assert.equal(store.waitlistMessage(), null);
  } finally { injector.destroy(); }
});

test('Profile owns load/save state while session consumers share the updated user', async () => {
  const user = { id: 'profile-user', displayName: 'Original', role: 'USER' };
  const pending = deferred(); let saves = 0;
  const injector = createEnvironmentInjector([
    { provide: AuthApiService, useValue: { login: async () => ({ data: { user, accessToken: 'memory-token' } }) } },
    { provide: ProfileApiService, useValue: { getMine: async () => ({ data: { ...user, displayName: 'Loaded' } }),
      updateMine: () => { saves++; return pending.promise; } } }, AuthStore, ProfileStore,
  ]);
  try {
    const auth = injector.get(AuthStore), profile = injector.get(ProfileStore);
    await auth.login('fixture@example.test', 'password');
    assert.equal(await profile.load(), true);
    assert.equal(auth.user().displayName, 'Loaded');
    const saving = profile.save('Updated');
    assert.equal(profile.saving(), true);
    assert.equal(await profile.save('Duplicate'), false);
    pending.resolve({ data: { ...user, displayName: 'Updated' } });
    assert.equal(await saving, true);
    assert.equal(saves, 1);
    assert.equal(profile.saved(), true);
    assert.equal(auth.user(), profile.user());
    assert.equal(auth.user().displayName, 'Updated');
    assert.equal(auth.accessToken(), 'memory-token');
    assert.equal(auth.error(), null);
  } finally { injector.destroy(); }
});

test('Profile errors and late responses cannot pollute Auth or a later login of the same user', async () => {
  const user = { id: 'profile-user', displayName: 'Original', role: 'USER' }, pending = deferred();
  const api = { updateMine: async () => { throw new HttpErrorResponse({ status: 400 }); } };
  const injector = createEnvironmentInjector([
    { provide: AuthApiService, useValue: { login: async () => ({ data: { user, accessToken: 'memory-token' } }), logout: async () => {} } },
    { provide: ProfileApiService, useValue: api }, AuthStore, ProfileStore,
  ]);
  try {
    const auth = injector.get(AuthStore), profile = injector.get(ProfileStore);
    await auth.login('fixture@example.test', 'password');
    assert.equal(await profile.save('Bad'), false);
    assert.ok(profile.error()); assert.equal(auth.error(), null);
    api.updateMine = () => pending.promise;
    const saving = profile.save('Old response');
    await auth.logout(); await auth.login('fixture@example.test', 'password');
    pending.resolve({ data: { ...user, displayName: 'Old response' } });
    assert.equal(await saving, false);
    assert.equal(auth.user().displayName, 'Original'); assert.equal(profile.saved(), false);
  } finally { injector.destroy(); }
});

test('Profile HTTP sends Bearer and retries after access-token expiry using existing refresh', async () => {
  const user = { id: 'profile-user', displayName: 'Original', role: 'USER' }, requests = [];
  let refreshes = 0;
  const injector = createEnvironmentInjector([
    { provide: AuthApiService, useValue: {
      login: async () => ({ data: { user, accessToken: 'expired-token' } }),
      refresh: async () => { refreshes++; return { data: { user, accessToken: 'fresh-token' } }; },
    } }, { provide: Router, useValue: { url: '/account', navigate() { throw Error('Unexpected redirect'); } } }, AuthStore,
  ]);
  try {
    const auth = injector.get(AuthStore); await auth.login('fixture@example.test', 'password');
    const response = await runInInjectionContext(injector, () => firstValueFrom(authInterceptor(
      new HttpRequest('PATCH', '/api/profile/me', { displayName: 'Updated' }), request => {
        requests.push(request.headers.get('Authorization'));
        return requests.length === 1 ? throwError(() => new HttpErrorResponse({ status: 401 })) : of(new HttpResponse({ status: 200 }));
      },
    )));
    assert.equal(response.status, 200);
    assert.deepEqual(requests, ['Bearer expired-token', 'Bearer fresh-token']); assert.equal(refreshes, 1);
  } finally { injector.destroy(); }
});

test('Users administration delegates listing and writes to UsersApiService', async () => {
  const calls = [], user = { id: 'user-fixture', role: 'USER', displayName: 'User' };
  const injector = createEnvironmentInjector([
    { provide: UsersApiService, useValue: {
      getUsers: async (...args) => { calls.push(args); return { data: [user], pagination: { page: 2, totalPages: 2, total: 21, limit: 20 } }; },
      createUser: async payload => ({ data: { ...user, ...payload } }),
      updateUser: async (id, payload) => ({ data: { ...user, id, ...payload } }),
    } }, UsersStore,
  ]);
  try {
    const users = injector.get(UsersStore); await users.loadUsers(2, 'User', 'USER');
    assert.deepEqual(calls, [[2, 'User', 'USER']]); assert.equal(users.users()[0], user);
    assert.equal(users.pagination().page, 2);
    assert.equal((await users.saveUser(null, { displayName: 'Created' })).displayName, 'Created');
    assert.equal((await users.saveUser(user.id, { isActive: false })).isActive, false);
  } finally { injector.destroy(); }
});


test('cart count, mutations and checkout eligibility use server data; normal loads are deduplicated', async () => {
  let reads = 0;
  const response = (quantity, purchasable = true) => ({ data: { id: 'cart', totalCents: 1400 * quantity,
    items: quantity ? [{ id: 'item', quantity, unitPriceCents: 1400, purchasable }] : [] } });
  const waiting = deferred();
  const api = { getCart: () => { reads++; return waiting.promise; },
    addItem: async () => response(2), updateItem: async (_id, quantity) => response(quantity),
    removeItem: async () => response(0), clear: async () => response(0) };
  const injector = createEnvironmentInjector([{ provide: CartApiService, useValue: api }, CartStore]);
  try {
    const store = injector.get(CartStore);
    const load = store.load(); await store.load(); assert.equal(reads, 1);
    await store.addItem('type', 2);
    waiting.resolve(response(1)); await load;
    assert.equal(store.itemCount(), 2, 'old initial GET cannot replace an add');
    assert.equal(store.canCheckout(), true);
    await store.load(); assert.equal(reads, 1, 'loaded navbar does not refetch on navigation');
    await store.updateItem('item', 3); assert.equal(store.itemCount(), 3);
    await store.removeItem('item'); assert.equal(store.itemCount(), 0); assert.equal(store.canCheckout(), false);
    api.getCart = async () => response(2, false);
    await store.load(true); assert.equal(store.canCheckout(), false);
    store.reset(); assert.equal(store.itemCount(), 0); assert.equal(store.cart(), null);
  } finally { injector.destroy(); }
});

test('cart resets at session boundary and ignores late load and mutation responses', async () => {
  const load = deferred(), add = deferred();
  const injector = createEnvironmentInjector([{ provide: CartApiService, useValue: {
    getCart: () => load.promise, addItem: () => add.promise,
  } }, CartStore]);
  try {
    const store = injector.get(CartStore);
    const loading = store.load(), adding = store.addItem('old-session-type');
    store.reset();
    const old = { data: { id: 'private-cart', items: [{ quantity: 4, purchasable: true }], totalCents: 5600 } };
    load.resolve(old); add.resolve(old); await Promise.all([loading, adding]);
    assert.equal(store.cart(), null); assert.equal(store.itemCount(), 0);
    assert.equal(store.pending(), false); assert.equal(store.loading(), false);
  } finally { injector.destroy(); }
});
