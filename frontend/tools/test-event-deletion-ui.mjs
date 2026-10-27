import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

// Use only an isolated, freshly seeded development/test database. Never a production URL.
const { chromium, request } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.DELETION_UI_ORIGIN ?? 'http://localhost:4200';
const output = '../docs/screenshots/integrity';
await mkdir(output, { recursive: true });
const api = await request.newContext({ baseURL: origin });
async function call(path, method, data, token) {
  const response = await api.fetch('/api' + path, { method, data,
    headers: token ? { authorization: 'Bearer ' + token } : {} });
  assert.ok(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`);
  return response.status() === 204 ? null : (await response.json()).data;
}
const admin = await call('/auth/login', 'POST', { email: 'admin@nocturno.test', password: 'AdminDemo!2026' });
const venues = await call('/venues?limit=1', 'GET', undefined, admin.accessToken);
const venueId = venues[0].id;
const stamp = randomUUID().slice(0, 8);
async function fixture(title) {
  return call('/events', 'POST', { title: `${title} · ${stamp}`, venueId, eventType: 'CLUB',
    startsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    endsAt: new Date(Date.now() + 3 * 86400000).toISOString(), status: 'PUBLISHED',
    musicGenres: ['TECHNO'], atmosphere: ['UNDERGROUND'] }, admin.accessToken);
}
const clean = await fixture('Sesión de prueba sin ventas');
const historic = await fixture('Sesión con entradas emitidas');
const type = await call(`/events/${historic.id}/ticket-types`, 'POST', {
  name: 'Invitación de prueba', price: 0, quantity: 5,
}, admin.accessToken);
const user = await call('/auth/login', 'POST', { email: 'user@nocturno.test', password: 'UserDemo!2026' });
await call('/cart/items', 'DELETE', undefined, user.accessToken);
await call('/cart/items', 'POST', { ticketTypeId: type.id, quantity: 1 }, user.accessToken);
const orderResponse = await api.post('/api/checkout', { headers: {
  authorization: 'Bearer ' + user.accessToken, 'Idempotency-Key': randomUUID(),
} });
assert.equal(orderResponse.status(), 200, await orderResponse.text());
assert.equal((await orderResponse.json()).data.order.status, 'PAID');
const browser = await chromium.launch({ headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}),
});
try {
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 1280, height: 900 }, locale: 'es-ES' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Solo esta visita', exact: true }).click();
  await page.locator('input[formcontrolname="email"]').fill('admin@nocturno.test');
  await page.locator('input[formcontrolname="password"]').fill('AdminDemo!2026');
  await page.getByRole('button', { name: /Entrar/ }).click();
  await page.waitForURL(url => !url.pathname.startsWith('/auth/login'));
  // Client navigation preserves auth/refresh lifecycle, as the application normally does.
  await page.getByRole('navigation', { name: 'Panel de gestión' }).getByRole('link', { name: 'Eventos', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /¿Eliminar|¿Archivar|Operación completada/ });
  async function select(event) {
    await page.getByPlaceholder('Título del evento').fill(event.title);
    await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
    const row = page.locator('tbody tr').filter({ hasText: event.title });
    try { await row.waitFor(); } catch (error) {
      console.log('UI_SELECTION_DIAGNOSTIC', JSON.stringify({url:page.url(),search:await page.getByPlaceholder('Título del evento').inputValue(),rows:await page.locator('tbody tr').allTextContents(),alerts:await page.getByRole('alert').allTextContents()}));
      await page.screenshot({path:output+'/diagnostic.png'});
      throw error;
    }
    return row;
  }
  const cleanRow = await select(clean);
  let release;
  await page.route(`**/events/${clean.id}/deletion-impact`, async route => {
    await new Promise(resolve => { release = resolve; });
    // Cancelling the modal aborts its HTTP subscription; Playwright may already have released it.
    await route.continue().catch(error => {
      if (!error.message.includes('already handled')) throw error;
    });
  });
  await cleanRow.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await dialog.getByText(/Consultando dependencias/).waitFor();
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  release();
  await page.unroute(`**/events/${clean.id}/deletion-impact`);
  await cleanRow.getByRole('button', { name: 'Eliminar', exact: true }).click();
  const remove = dialog.getByRole('button', { name: 'Eliminar definitivamente', exact: true });
  await remove.waitFor();
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await remove.evaluate(button => button === document.activeElement), true);
  await page.keyboard.press('Tab');
  assert.equal(await dialog.getByRole('button', { name: 'Cerrar análisis de eliminación' }).evaluate(button => button === document.activeElement), true);
  await page.screenshot({ path: output + '/01-delete-impact-desktop.png' });
  // A genuine dependency change invalidates the preview, including unchanged operation kind.
  await call(`/me/favorites/${clean.id}`, 'POST', undefined, user.accessToken);
  await remove.click();
  await dialog.getByText(/Las dependencias han cambiado/).waitFor();
  await dialog.getByRole('button', { name: 'Actualizar análisis' }).click();
  await remove.waitFor();
  await remove.click();
  await dialog.getByText(/Evento eliminado definitivamente junto/).waitFor();
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  await cleanRow.waitFor({ state: 'detached' });

  const historicRow = await select(historic);
  await page.route(`**/events/${historic.id}/deletion-impact`, route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TEST_UNAVAILABLE', message: 'Unavailable' } }),
  }));
  await historicRow.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await dialog.getByRole('alert').waitFor();
  assert.equal(await dialog.getByRole('button', { name: 'Archivar evento' }).count(), 0);
  await page.unroute(`**/events/${historic.id}/deletion-impact`);
  await dialog.getByRole('button', { name: 'Actualizar análisis' }).click();
  const archive = dialog.getByRole('button', { name: 'Archivar evento', exact: true });
  await archive.waitFor();
  await dialog.getByText('Entradas emitidas', { exact: true }).waitFor();
  await page.screenshot({ path: output + '/02-archive-impact-desktop.png' });
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const box = await dialog.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 844);
    const action = await archive.boundingBox();
    assert.ok(action.y >= 0 && action.y + action.height <= 844, 'Confirmation stays visible while dependencies scroll');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (width === 390) await page.screenshot({ path: output + '/03-archive-impact-mobile.png' });
  }
  await archive.click();
  await dialog.getByText(/Evento archivado. Su historial comercial se conserva/).waitFor();
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  await historicRow.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  assert.deepEqual(errors, []);
  console.log('EVENT_DELETION_UI_VERIFIED: real delete/archive, preserved free-order history, loading/cancel, keyboard focus, stale preview, server error/retry, list refresh, 390/768/1280px; isolated headless browser.');
  await context.close();
} finally {
  await browser.close();
  await api.dispose();
}
