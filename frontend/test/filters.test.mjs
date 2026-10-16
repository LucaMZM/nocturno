import test from 'node:test';
import assert from 'node:assert/strict';
import { eventFilterEntries } from '../src/app/shared/utils/event-filter-entries.ts';
import { dateRangeFor, formatDistance } from '../src/app/shared/utils/format.ts';
import { parseEventFilters, serializeEventFilters, activeFilterChips } from '../src/app/shared/utils/event-filter-contract.ts';
import { createEventIcs } from '../src/app/shared/utils/calendar.ts';

test('event queries combine filters without empty values', () => {
  const entries = eventFilterEntries({ municipality: 'Valencia', genre: 'TECHNO', maxPrice: 0, search: '', status: undefined, page: 2, limit: 12, sort: 'price' });
  assert.deepEqual(entries, [['municipality', 'Valencia'], ['genre', 'TECHNO'], ['maxPrice', '0'], ['page', '2'], ['limit', '12'], ['sort', 'price']]);
});

test('date presets cover local evening through next morning', () => {
  const now = new Date(2026, 8, 29, 12, 0, 0);
  const tonight = dateRangeFor('tonight', now);
  const tomorrow = dateRangeFor('tomorrow', now);
  const start = new Date(tonight.dateFrom);
  const end = new Date(tonight.dateTo);
  assert.equal(start.getHours(), 18);
  assert.equal(end.getHours(), 6);
  assert.equal(new Date(tomorrow.dateFrom).getDate(), 30);
  assert.equal(dateRangeFor('weekend', now).dateFrom < dateRangeFor('weekend', now).dateTo, true);
});

test('URL filters restore combined state and reject invalid values', () => {
  const parsed = parseEventFilters(new URLSearchParams('municipality=Valencia&genre=TECHNO&maxPrice=20&search=club&sort=price&minimumAge=-2&eventType=INVALID'));
  assert.equal(parsed.municipality, 'Valencia');
  assert.equal(parsed.genre, 'TECHNO');
  assert.equal(parsed.maxPrice, 20);
  assert.equal(parsed.search, 'club');
  assert.equal(parsed.minimumAge, undefined);
  assert.equal(parsed.eventType, undefined);
  assert.deepEqual(serializeEventFilters(parsed), { municipality: 'Valencia', genre: 'TECHNO', maxPrice: '20', search: 'club', sort: 'price' });
  assert.deepEqual(activeFilterChips(parsed).map(({ key }) => key), ['municipality', 'genre', 'maxPrice', 'search', 'sort']);
});

test('all municipalities and zero price survive a URL round trip', () => {
  const parsed = parseEventFilters(new URLSearchParams('municipality=all&maxPrice=0&status=all'));
  assert.equal(parsed.municipality, undefined);
  assert.equal(parsed.maxPrice, 0);
  assert.equal(parsed.status, undefined);
  assert.deepEqual(serializeEventFilters(parsed), { municipality: 'all', maxPrice: '0' });
});

test('atmosphere filter survives the URL and can be removed', () => {
  const parsed = parseEventFilters(new URLSearchParams('municipality=all&atmosphere=UNDERGROUND'));
  assert.equal(parsed.atmosphere, 'UNDERGROUND');
  assert.equal(serializeEventFilters(parsed).atmosphere, 'UNDERGROUND');
  assert.ok(activeFilterChips(parsed).some((chip) => chip.key === 'atmosphere'));
  assert.equal(parseEventFilters(new URLSearchParams('atmosphere=INVALID')).atmosphere, undefined);
});

test('dress code stays reproducible in the URL and appears in active filters', () => {
  const parsed = parseEventFilters(new URLSearchParams('municipality=Madrid&dressCode=SMART_CASUAL'));
  assert.equal(parsed.dressCode, 'SMART_CASUAL');
  assert.equal(serializeEventFilters(parsed).dressCode, 'SMART_CASUAL');
  assert.ok(activeFilterChips(parsed).some((chip) => chip.key === 'dressCode'));
  assert.equal(parseEventFilters(new URLSearchParams('dressCode=INVALID')).dressCode, undefined);
});

test('nearby radius and distance order survive URL history without exact coordinates', () => {
  const parsed = parseEventFilters(new URLSearchParams('municipality=all&radiusKm=10&sort=distance&genre=TECHNO'));
  assert.equal(parsed.radiusKm, 10);
  assert.equal(parsed.sort, 'distance');
  assert.equal(parsed.municipality, undefined);
  assert.deepEqual(serializeEventFilters(parsed), { municipality: 'all', genre: 'TECHNO', radiusKm: '10', sort: 'distance' });
  assert.equal(serializeEventFilters(parsed).latitude, undefined);
  assert.equal(parseEventFilters(new URLSearchParams('radiusKm=999')).radiusKm, undefined);
  assert.equal(formatDistance(0.8), '800 m');
  assert.equal(formatDistance(1.8), '1,8 km');
  assert.equal(formatDistance(12), '12 km');
});

test('map and list share the URL filter contract, including idealFor and location', () => {
  const parsed = parseEventFilters(new URLSearchParams(
    'municipality=Madrid&genre=HOUSE&idealFor=DANCING&radiusKm=25&sort=distance&maxPrice=30'));
  assert.equal(parsed.idealFor, 'DANCING');
  assert.deepEqual(serializeEventFilters(parsed), {
    municipality: 'Madrid', genre: 'HOUSE', idealFor: 'DANCING', maxPrice: '30', radiusKm: '25', sort: 'distance'
  });
  assert.ok(activeFilterChips(parsed).some(({ key }) => key === 'idealFor'));
  assert.equal(parseEventFilters(new URLSearchParams('idealFor=INVALID')).idealFor, undefined);
});

test('calendar invite escapes text, includes place and UTC event times', () => {
  const ics = createEventIcs({ id: 'event-1', title: 'Noche, Música; Live', description: 'Línea 1\nLínea 2',
    startsAt: '2026-10-10T22:00:00+02:00', endsAt: '2026-10-11T03:00:00+02:00',
    venueName: 'Sala A', address: 'Calle B, 1', url: 'https://example.com/events/event-1' },
    new Date('2026-10-01T00:00:00Z'));
  assert.match(ics, /DTSTART:20261010T200000Z/);
  assert.match(ics, /DTEND:20261011T010000Z/);
  assert.match(ics, /SUMMARY:Noche\\, Música\\; Live/);
  assert.match(ics, /DESCRIPTION:Línea 1\\nLínea 2/);
  assert.match(ics, /LOCATION:Sala A\\, Calle B\\, 1/);
  assert.ok(ics.endsWith('\r\n'));
});
