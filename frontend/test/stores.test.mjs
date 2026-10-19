import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import '@angular/compiler';
import { createEnvironmentInjector } from '@angular/core';
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
    updateProfile: () => profile.promise,
    logout: async () => {},
  };
  const injector = createEnvironmentInjector([{ provide: AuthApiService, useValue: api }, AuthStore]);
  try {
    const store = injector.get(AuthStore);
    assert.equal(await store.login('demo@example.test', 'demo'), true);
    const updating = store.updateProfile('Nuevo');
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
