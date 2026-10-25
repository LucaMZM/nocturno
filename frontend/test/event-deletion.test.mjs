import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import '@angular/compiler';
import { createEnvironmentInjector, ElementRef, runInInjectionContext } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { build } from 'esbuild';
const dir = join(process.cwd(), 'node_modules/.cache/nocturno-deletion-tests');
const file = join(dir, `store-${process.pid}.mjs`);
await mkdir(dir, { recursive: true });
await build({
  stdin: { contents: `export { DashboardStore } from './src/app/features/dashboard/store/dashboard.store.ts';
    export { DashboardApiService } from './src/app/features/dashboard/services/dashboard-api.service.ts';
    export { EventsApiService } from './src/app/features/events/services/events-api.service.ts';
    export { TicketsApiService } from './src/app/features/tickets/services/tickets-api.service.ts';
    export { EventDeletionDialogComponent } from './src/app/features/events/components/event-deletion-dialog/event-deletion-dialog.component.ts';`,
    resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, packages: 'external', platform: 'node', format: 'esm', outfile: file,
});
after(() => rm(file, { force: true }));
const { DashboardStore, DashboardApiService, EventsApiService, TicketsApiService, EventDeletionDialogComponent } = await import(pathToFileURL(file).href);
const impact = { eventId: 'event-a', title: 'Pulso', analysisToken: 'fresh-analysis', operation: 'delete',
  recoverable: false, relations: [], blockers: [], warnings: [] };
function setup(eventsApi) {
  const injector = createEnvironmentInjector([
    { provide: DashboardApiService, useValue: {} },
    { provide: EventsApiService, useValue: eventsApi },
    { provide: TicketsApiService, useValue: {} }, DashboardStore,
  ]);
  return { store: injector.get(DashboardStore), close: () => injector.destroy() };
}

test('deletion preview loads, cancellation discards late responses and never mutates an event', async () => {
  let resolve;
  let mutations = 0;
  const { store, close } = setup({ getDeletionImpact: () => new Promise((yes) => { resolve = yes; }),
    deleteWithImpact: async () => { mutations++; } });
  try {
    const pending = store.analyzeEventDeletion('event-a', 'Pulso');
    assert.equal(store.deletionLoading(), true);
    assert.equal(store.deletionImpact(), null);
    assert.equal(await store.confirmEventDeletion(), false);
    store.closeEventDeletion();
    resolve({ data: impact });
    await pending;
    assert.equal(store.deletionEventId(), null);
    assert.equal(store.deletionImpact(), null);
    assert.equal(mutations, 0);
  } finally { close(); }
});

test('deletion confirmation blocks duplicates and keeps a stable request ID after a recoverable error', async () => {
  const requests = [];
  let resolve;
  const api = { getDeletionImpact: async () => ({ data: impact }),
    deleteWithImpact: async (_id, payload) => { requests.push(payload); throw Error('network'); } };
  const { store, close } = setup(api);
  try {
    await store.analyzeEventDeletion('event-a', 'Pulso');
    assert.equal(await store.confirmEventDeletion(), false);
    assert.ok(store.deletionError());
    api.deleteWithImpact = (_id, payload) => { requests.push(payload); return new Promise((yes) => { resolve = yes; }); };
    const confirm = store.confirmEventDeletion();
    assert.equal(store.deletionSaving(), true);
    assert.equal(await store.confirmEventDeletion(), false);
    store.closeEventDeletion();
    assert.equal(store.deletionEventId(), 'event-a');
    assert.equal(requests.length, 2);
    assert.equal(requests[0].requestId, requests[1].requestId);
    assert.equal(requests[0].analysisToken, impact.analysisToken);
    resolve({ data: { eventId: 'event-a', operation: 'delete' } });
    assert.equal(await confirm, true);
    assert.equal(store.deletionResult().operation, 'delete');
    assert.equal(await store.confirmEventDeletion(), false);
    store.closeEventDeletion();
    assert.equal(store.deletionResult(), null);
  } finally { close(); }
});

test('stale analysis requires a fresh preview and blocked impacts cannot be confirmed', async () => {
  let previews = 0, mutations = 0;
  const api = { getDeletionImpact: async () => { previews++; return { data: impact }; },
    deleteWithImpact: async () => { mutations++; throw new HttpErrorResponse({ status: 409, error: { error: { code: 'IMPACT_STALE' } } }); } };
  const { store, close } = setup(api);
  try {
    await store.analyzeEventDeletion('event-a', 'Pulso');
    assert.equal(await store.confirmEventDeletion(), false);
    assert.equal(store.deletionStale(), true);
    assert.match(store.deletionError(), /dependencias han cambiado/);
    assert.equal(await store.confirmEventDeletion(), false);
    assert.equal(mutations, 1);
    api.getDeletionImpact = async () => ({ data: { ...impact, operation: 'blocked', blockers: ['Stock inconsistente'] } });
    await store.analyzeEventDeletion('event-a', 'Pulso');
    assert.equal(store.deletionStale(), false);
    assert.equal(await store.confirmEventDeletion(), false);
    assert.equal(mutations, 1);
    assert.equal(previews, 1);
  } finally { close(); }
});

test('server error in preview is recoverable and archive preserves the backend-selected operation', async () => {
  let fail = true;
  const api = { getDeletionImpact: async () => { if (fail) throw Error('offline'); return { data: { ...impact, operation: 'archive', recoverable: true } }; },
    deleteWithImpact: async (_id, payload) => ({ data: { eventId: 'event-a', operation: payload.operation, deletedAt: '2026-10-25T10:00:00Z' } }) };
  const { store, close } = setup(api);
  try {
    await store.analyzeEventDeletion('event-a', 'Pulso');
    assert.equal(store.deletionLoading(), false);
    assert.ok(store.deletionError());
    fail = false;
    await store.analyzeEventDeletion('event-a', 'Pulso');
    assert.equal(store.deletionError(), null);
    assert.equal(await store.confirmEventDeletion(), true);
    assert.equal(store.deletionResult().operation, 'archive');
  } finally { close(); }
});


test('modal restores focus and scroll, traps Tab and disables dismissal while executing', () => {
  let previousFocused = false, firstFocused = false, lastFocused = false, dismissed = 0;
  const previous = { focus: () => { previousFocused = true; } };
  const first = { focus: () => { firstFocused = true; } };
  const last = { focus: () => { lastFocused = true; } };
  const document = { activeElement: previous, body: { style: { overflow: 'auto' } } };
  const injector = createEnvironmentInjector([{ provide: DOCUMENT, useValue: document }]);
  try {
    const component = runInInjectionContext(injector, () => new EventDeletionDialogComponent());
    let opened = false;
    component.dialog = new ElementRef({ showModal: () => { opened = true; }, close: () => { opened = false; },
      querySelector: () => first, querySelectorAll: () => [first, last] });
    component.dismiss.subscribe(() => { dismissed++; });
    component.ngAfterViewInit();
    assert.equal(opened, true);
    assert.equal(document.body.style.overflow, 'hidden');
    assert.equal(firstFocused, true);
    let prevented = false;
    document.activeElement = first;
    component.trapFocus({ key: 'Tab', shiftKey: true, preventDefault: () => { prevented = true; } });
    assert.equal(lastFocused, true);
    assert.equal(prevented, true);
    component.saving = () => true;
    component.cancel({ preventDefault() {} });
    assert.equal(dismissed, 0);
    component.saving = () => false;
    component.cancel({ preventDefault() {} });
    assert.equal(dismissed, 1);
    component.ngOnDestroy();
    assert.equal(opened, false);
    assert.equal(document.body.style.overflow, 'auto');
    assert.equal(previousFocused, true);
  } finally { injector.destroy(); }
});

test('a dependency appearing at confirmation requires reanalysis instead of an endless retry', async () => {
  const { store, close } = setup({ getDeletionImpact: async () => ({ data: impact }),
    deleteWithImpact: async () => { throw new HttpErrorResponse({ status: 409,
      error: { error: { code: 'EVENT_DELETION_BLOCKED' } } }); } });
  try {
    await store.analyzeEventDeletion('event-a', 'Pulso');
    assert.equal(await store.confirmEventDeletion(), false);
    assert.equal(store.deletionStale(), true);
    assert.equal(await store.confirmEventDeletion(), false);
  } finally { close(); }
});
