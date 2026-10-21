import test from 'node:test';
import assert from 'node:assert/strict';
import { userCreate, userPatch } from '../src/validators/user.validator.js';
import { eventActive, eventCreate, eventImages, eventPatch, eventQuery, eventSlug } from '../src/validators/event.validator.js';
import { slugFromTitle } from '../src/services/event.service.js';
import { ticketTypeCreate, ticketTypePatch } from '../src/validators/ticket-type.validator.js';
import { checkTicketType } from '../src/services/ticket-type.service.js';
import { userListQuery, orderListQuery, paymentListQuery, adminTicketListQuery } from '../src/validators/common.js';

test('user email is normalized and empty PATCH is rejected', () => {
  assert.equal(userCreate.parse({ email: 'TEST@EXAMPLE.COM', displayName: 'A', password: 'test-password-123' }).email, 'test@example.com');
  assert.equal(userPatch.safeParse({}).success, false);
});

test('event validation rejects invalid enums, URLs and UUIDs', () => {
  const valid = { venueId: '10000000-0000-4000-8000-000000000001', title: 'Night', eventType: 'CLUB', startsAt: '2026-10-01T21:00:00+02:00', endsAt: '2026-10-02T05:00:00+02:00' };
  assert.equal(eventCreate.safeParse(valid).success, true);
  assert.equal(eventCreate.safeParse({ ...valid, slug: 'custom' }).success, false);
  assert.equal(eventCreate.safeParse({ ...valid, eventType: 'UNKNOWN' }).success, false);
  assert.equal(eventCreate.safeParse({ ...valid, venueId: 'bad' }).success, false);
  assert.equal(eventCreate.safeParse({ ...valid, posterUrl: 'bad' }).success, false);
  assert.equal(eventCreate.safeParse({ ...valid, posterUrl: '/posters/event-01.svg' }).success, true);
  assert.equal(eventCreate.safeParse({ ...valid, posterUrl: '/posters/../secret.svg' }).success, false);
  assert.equal(eventCreate.safeParse({ ...valid, images: [{ url: 'javascript:alert(1)' }] }).success, false);
  assert.equal(eventCreate.safeParse({ ...valid, images: [{ url: 'https://example.com/a.jpg' }, { url: 'https://example.com/a.jpg' }] }).success, false);
  assert.equal(eventCreate.safeParse({ ...valid, images: [{ url: '/posters/event-01.svg' }] }).success, true);
  assert.equal(eventImages.safeParse(Array.from({ length: 101 }, (_, i) => ({ url: `https://example.com/${i}.jpg` }))).success, false);
  assert.equal(eventPatch.safeParse({}).success, false);
  assert.deepEqual(eventPatch.parse({ title: 'Changed' }), { title: 'Changed' });
  assert.equal(eventPatch.safeParse({ deletedAt: '2026-10-01T00:00:00Z' }).success, false);
  assert.equal(eventActive.safeParse({ isActive: true }).success, true);
  assert.equal(eventActive.safeParse({ isActive: 'true' }).success, false);
  assert.equal(eventSlug.safeParse({ slug: 'boiler-room-valencia' }).success, true);
  assert.equal(eventSlug.safeParse({ slug: '../bad' }).success, false);
  assert.equal(slugFromTitle('Böiler Room Valencia'), 'boiler-room-valencia');
  assert.equal(slugFromTitle('Paseo en barca por El Retiro'), 'paseo-en-barca-por-el-retiro');
  assert.equal(slugFromTitle('Paseo por El Retiro'), 'paseo-por-el-retiro');
});

test('ticket type rules reject oversold stock and reversed sales dates', () => {
  const parsed = ticketTypeCreate.parse({ name: 'General', price: 10, quantity: 100 });
  assert.equal(parsed.sold, undefined);
  assert.equal(ticketTypeCreate.safeParse({ name: 'General', price: 10, quantity: 100, sold: 4 }).success, false);
  assert.equal(ticketTypePatch.safeParse({}).success, false);
  assert.equal(ticketTypeCreate.safeParse({ name: 'General', price: 12.345, quantity: 100 }).success, false);
  assert.throws(() => checkTicketType({ ...parsed, sold: 101 }), { status: 422 });
  assert.throws(() => checkTicketType({ ...parsed, salesStart: '2026-10-02T00:00:00Z', salesEnd: '2026-10-01T00:00:00Z' }), { status: 422 });
});

test('event filters validate pagination, prices and date ranges', () => {
  assert.deepEqual(eventQuery.parse({}), { page: 1, limit: 20, sort: 'date' });
  assert.equal(eventQuery.safeParse({ page: '0' }).success, false);
  assert.equal(eventQuery.safeParse({ limit: '101' }).success, false);
  assert.equal(eventQuery.safeParse({ minPrice: '30', maxPrice: '10' }).success, false);
  assert.equal(eventQuery.safeParse({ dateFrom: '2026-10-02T00:00:00Z', dateTo: '2026-10-01T00:00:00Z' }).success, false);
});

test('management filters accept only valid role and resource status', () => {
  assert.equal(userListQuery.parse({ role: 'PROMOTER', search: 'Cris' }).role, 'PROMOTER');
  assert.equal(userListQuery.safeParse({ role: 'OWNER' }).success, false);
  assert.equal(orderListQuery.parse({ status: 'REFUNDED' }).status, 'REFUNDED');
  assert.equal(orderListQuery.safeParse({ status: 'FAILED' }).success, false);
  assert.equal(paymentListQuery.parse({ status: 'FAILED' }).status, 'FAILED');
  assert.equal(adminTicketListQuery.parse({ status: 'USED' }).status, 'USED');
  assert.equal(adminTicketListQuery.safeParse({ status: 'PAID' }).success, false);
});
