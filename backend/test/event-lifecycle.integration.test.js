import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getPool, closePool } from '../src/config/db.js';
import { hashPassword } from '../src/utils/password.js';
import { seedGalleryIfUntouched } from '../src/db/seed.js';
import { eventRepository } from '../src/repositories/event.repository.js';

// Uses only its own fixtures. The final SQL cleanup removes these rows and their test relations.
test('event lifecycle keeps UUID relations and public slug visibility', { skip: !env.DATABASE_URL }, async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const ids = [];
  const venueId = randomUUID();
  const userId = randomUUID();
  let accessToken = null;
  const call = async (path, method = 'GET', payload) => {
    const response = await fetch(origin + path, {
      method, headers: { 'content-type': 'application/json', ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) })
    });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  };
  try {
    await getPool().query(`INSERT INTO venues (id, name, slug, type, province, municipality, address)
      VALUES ($1, 'Lifecycle fixture', $2, 'CLUB', 'Valencia', 'Valencia', 'Fixture street')`,
      [venueId, `lifecycle-${venueId}`]);
    const email = `lifecycle-${userId}@example.com`;
    await getPool().query(`INSERT INTO users (id, email, display_name, role, password_hash)
      VALUES ($1, $2, 'Lifecycle fixture', 'ADMIN', $3)`, [userId, email, await hashPassword('fixture-password-123')]);
    const login = await call('/api/auth/login', 'POST', { email, password: 'fixture-password-123' });
    assert.equal(login.status, 200);
    accessToken = login.body.data.accessToken;
    const name = `Lifecycle test ${randomUUID().slice(0, 8)}`;
    const payload = { venueId, title: name,
      eventType: 'CLUB', startsAt: '2027-01-01T21:00:00+01:00', endsAt: '2027-01-02T05:00:00+01:00', status: 'PUBLISHED',
      sourceUrl: 'https://example.com/event', imageSourceUrl: 'https://example.com/image' };
    const paseo = await call('/api/events', 'POST', { ...payload, title: 'Paseo en barca por El Retiro' });
    assert.equal(paseo.status, 201);
    ids.push(paseo.body.data.id);
    assert.equal(paseo.body.data.slug, 'paseo-en-barca-por-el-retiro');
    const renamedPaseo = await call(`/api/events/${paseo.body.data.id}`, 'PATCH',
      { title: 'Paseo por El Retiro' });
    assert.equal(renamedPaseo.status, 200);
    assert.equal(renamedPaseo.body.data.slug, 'paseo-por-el-retiro');
    const first = await call('/api/events', 'POST', payload);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const event = first.body.data; ids.push(event.id);
    assert.equal(event.sourceUrl, payload.sourceUrl);
    assert.equal(event.imageSourceUrl, payload.imageSourceUrl);
    assert.equal(event.updatedAt, null);
    assert.equal(event.isActive, true);
    assert.deepEqual(event.images, []);
    const oneImage = await call(`/api/events/${event.id}`, 'PATCH', {
      images: [{ url: 'https://example.com/one.jpg', altText: 'Primera foto' }],
    });
    assert.equal(oneImage.status, 200, JSON.stringify(oneImage.body));
    assert.equal(oneImage.body.data.posterUrl, 'https://example.com/one.jpg');
    assert.deepEqual(oneImage.body.data.images.map((image) => image.url), ['https://example.com/one.jpg']);
    const threeImages = [1, 2, 3].map((number) => ({ url: `https://example.com/${number}.jpg`, altText: `Foto ${number}` }));
    const galleryUpdate = await call(`/api/events/${event.id}`, 'PATCH', { images: threeImages });
    assert.equal(galleryUpdate.status, 200, JSON.stringify(galleryUpdate.body));
    assert.deepEqual(galleryUpdate.body.data.images.map((image) => image.position), [0, 1, 2]);
    const fiveImages = [5, 4, 3, 2, 1].map((number) => ({ url: `https://example.com/${number}.jpg` }));
    assert.equal((await call(`/api/events/${event.id}`, 'PATCH', { images: fiveImages })).status, 200);
    const reordered = await call(`/api/events/${event.id}`, 'PATCH', { images: fiveImages.slice(1, 4) });
    assert.equal(reordered.status, 200);
    assert.deepEqual(reordered.body.data.images.map((image) => image.url),
      fiveImages.slice(1, 4).map((image) => image.url));
    const persistedGallery = await getPool().query(
      'SELECT url, position FROM event_images WHERE event_id=$1 ORDER BY position', [event.id]);
    assert.deepEqual(persistedGallery.rows.map((row) => row.position), [0, 1, 2]);
    assert.equal((await call(`/api/events/${event.id}`, 'PATCH', {
      images: [{ url: 'https://example.com/repeated.jpg' }, { url: 'https://example.com/repeated.jpg' }],
    })).status, 400);
    assert.deepEqual((await getPool().query(
      'SELECT url FROM event_images WHERE event_id=$1 ORDER BY position', [event.id])).rows.map((row) => row.url),
      fiveImages.slice(1, 4).map((image) => image.url));
    const galleryOnly = await eventRepository.update(event.id, { images: [
      { url: 'https://example.com/gallery-only.jpg', altText: 'Cambio aislado' },
    ] });
    assert.equal(galleryOnly.title, event.title);
    assert.deepEqual(galleryOnly.images.map((image) => image.url), ['https://example.com/gallery-only.jpg']);
    assert.ok(galleryOnly.updatedAt);
    await assert.rejects(eventRepository.update(event.id, { images: [
      { url: 'https://example.com/duplicate.jpg' }, { url: 'https://example.com/duplicate.jpg' },
    ] }), { code: '23505' });
    assert.deepEqual((await eventRepository.findById(event.id)).images.map((image) => image.url),
      ['https://example.com/gallery-only.jpg']);
    const emptied = await call(`/api/events/${event.id}`, 'PATCH', { images: [] });
    assert.equal(emptied.status, 200);
    assert.equal(emptied.body.data.posterUrl, null);
    assert.deepEqual(emptied.body.data.images, []);
    const edited = await getPool().query('SELECT gallery_user_edited FROM events WHERE id=$1', [event.id]);
    assert.equal(edited.rows[0].gallery_user_edited, true);
    await seedGalleryIfUntouched(getPool(), event.id, [{ url: 'https://example.com/seed.jpg', altText: 'Seed' }]);
    assert.equal((await getPool().query('SELECT count(*)::integer AS total FROM event_images WHERE event_id=$1', [event.id])).rows[0].total, 0);
    const second = await call('/api/events', 'POST', payload);
    assert.equal(second.status, 201); ids.push(second.body.data.id);
    assert.notEqual(second.body.data.slug, event.slug);
    assert.equal((await call(`/api/events/${event.id}`)).status, 200);
    assert.equal((await call('/api/events/not-a-uuid')).status, 400);
    assert.equal((await call(`/api/events/slug/${event.slug}`)).status, 200);
    assert.equal((await call(`/api/events/${second.body.data.id}`, 'PATCH', { status: 'SOLD_OUT' })).status, 200);
    assert.equal((await call(`/api/events/slug/${second.body.data.slug}`)).status, 200);
    assert.equal((await call('/api/events/slug/does-not-exist-lifecycle-test')).status, 404);
    const collision = await call(`/api/events/${second.body.data.id}`, 'PATCH', { title: name });
    assert.equal(collision.status, 200);
    assert.notEqual(collision.body.data.slug, event.slug);
    const changed = await call(`/api/events/${event.id}`, 'PATCH', { title: `${name} edited` });
    assert.equal(changed.status, 200);
    assert.notEqual(changed.body.data.slug, event.slug);
    assert.equal((await call(`/api/events/slug/${event.slug}`)).status, 404);
    const newSlug = changed.body.data.slug;
    assert.ok(changed.body.data.updatedAt);
    assert.equal((await call(`/api/events/${event.id}/active`, 'PATCH', { isActive: false })).body.data.isActive, false);
    assert.equal((await call(`/api/events/slug/${newSlug}`)).status, 404);
    const list = await call(`/api/events?search=${encodeURIComponent(name)}`);
    assert.equal(list.body.data.some((item) => item.id === event.id), false);
    assert.equal(list.body.data.some((item) => item.id === second.body.data.id), true);
    assert.equal((await call(`/api/events/${event.id}/active`, 'PATCH', { isActive: true })).body.data.isActive, true);
    assert.equal((await call(`/api/events/slug/${newSlug}`)).status, 200);
    assert.equal((await call(`/api/events/${event.id}/ticket-types`, 'POST', { name: 'Fixture', price: 1, quantity: 1 })).status, 201);
    assert.equal((await call(`/api/users/${userId}/favorites/${event.id}`, 'POST')).status, 201);
    const deleted = await call(`/api/events/${event.id}/soft-delete`, 'PATCH');
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.data.isActive, false);
    assert.ok(deleted.body.data.deletedAt);
    assert.ok(deleted.body.data.updatedAt);
    assert.equal((await call(`/api/events/slug/${newSlug}`)).status, 404);
    assert.equal((await call(`/api/events/${event.id}`)).status, 200);
    assert.equal((await call(`/api/events/${event.id}/active`, 'PATCH', { isActive: true })).status, 409);
    assert.equal((await call(`/api/users/${userId}/favorites`)).body.data.some((item) => item.id === event.id), false);
    const relations = await getPool().query(`SELECT (SELECT count(*) FROM ticket_types WHERE event_id = $1) AS tickets,
      (SELECT count(*) FROM favorites WHERE event_id = $1) AS favorites`, [event.id]);
    assert.equal(Number(relations.rows[0].tickets), 1);
    assert.equal(Number(relations.rows[0].favorites), 1);
  } finally {
    for (const id of ids) await getPool().query('DELETE FROM events WHERE id = $1', [id]);
    await getPool().query('DELETE FROM users WHERE id = $1', [userId]);
    await getPool().query('DELETE FROM venues WHERE id = $1', [venueId]);
    await new Promise((resolve) => server.close(resolve));
    await closePool();
  }
});
