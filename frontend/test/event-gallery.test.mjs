import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const directory = join(process.cwd(), 'node_modules', '.cache', 'nocturno-gallery-tests');
const output = join(directory, `gallery-${process.pid}.mjs`);
await mkdir(directory, { recursive: true });
await build({ entryPoints: ['src/app/features/events/utils/event-form.mapper.ts'],
  bundle: true, format: 'esm', platform: 'node', outfile: output });
after(() => rm(output, { force: true }));
const { isSafeEventImageUrl, mapEventFormToPayload, prepareEventImages } =
  await import(pathToFileURL(output).href);

test('one, three and five images keep their order and the first becomes the cover', () => {
  const values = { title: '  Sesión Nocturno  ', eventType: 'CLUB', venueId: 'venue',
    promoterId: '', startsAt: '2027-02-01T22:00', endsAt: '2027-02-02T04:00',
    status: 'PUBLISHED', isActive: true, minimumAge: '', description: '', dressCode: '',
    musicGenres: ['HOUSE'], atmosphere: [], idealFor: [] };
  for (const count of [1, 3, 5]) {
    const draft = Array.from({ length: count }, (_, i) => ({ url: `https://example.com/${i}.jpg`, altText: `Foto ${i}` }));
    const prepared = prepareEventImages(draft, 24);
    assert.equal(prepared.error, null);
    assert.deepEqual(prepared.images.map((image) => image.url), draft.map((image) => image.url));
    const payload = mapEventFormToPayload(values, prepared.images);
    assert.equal(payload.posterUrl, draft[0].url);
    assert.equal(payload.images.length, count);
    assert.equal(payload.title, 'Sesión Nocturno');
  }
});

test('empty fields are ignored; reordered or removed entries become the saved gallery', () => {
  const draft = [{ url: '' }, { url: 'https://example.com/b.jpg' },
    { url: 'https://example.com/a.jpg' }];
  assert.deepEqual(prepareEventImages(draft, 24).images.map((image) => image.url),
    ['https://example.com/b.jpg', 'https://example.com/a.jpg']);
  assert.deepEqual(prepareEventImages([draft[2]], 24).images.map((image) => image.url),
    ['https://example.com/a.jpg']);
});

test('gallery rejects duplicates, unsafe protocols and excessive images', () => {
  assert.equal(isSafeEventImageUrl('/posters/event-01.svg'), true);
  assert.equal(isSafeEventImageUrl('javascript:alert(1)'), false);
  assert.ok(prepareEventImages([{ url: 'https://example.com/a' }, { url: 'https://example.com/a' }], 24).error);
  assert.ok(prepareEventImages([{ url: 'data:image/svg+xml,evil' }], 24).error);
  assert.ok(prepareEventImages([{ url: 'https://example.com/1' }, { url: 'https://example.com/2' }], 1).error);
});
