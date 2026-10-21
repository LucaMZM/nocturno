import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// This script runs only in the isolated GitHub Actions runner with a freshly seeded database.
const origin = 'http://localhost:4200';
const output = path.resolve('..', 'docs', 'screenshots');
const sampleEventId = 'd0000000-0000-4000-8000-000000000001';
const sampleTicketId = '90000000-0000-4000-8000-000000000100';
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const contextOptions = {
  baseURL: origin,
  locale: 'es-ES',
  timezoneId: 'Europe/Madrid',
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: 'dark',
};

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(750);
}

async function capture(page, name) {
  await settle(page);
  await page.screenshot({ path: path.join(output, name), animations: 'disabled' });
  console.log(`Captured ${name}: ${page.url()}`);
}

async function login(page, email, password) {
  await page.goto('/auth/login');
  await page.locator('input[formcontrolname="email"]').fill(email);
  await page.locator('input[formcontrolname="password"]').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'));
  await assertNoAppError(page);
}

async function assertNoAppError(page) {
  const alerts = await page.locator('[role="alert"]').allTextContents();
  assert.deepEqual(alerts.map((value) => value.trim()).filter(Boolean), []);
}

try {
  const publicContext = await browser.newContext(contextOptions);
  const page = await publicContext.newPage();
  page.on('pageerror', (error) => console.error('Browser error:', error.message));
  page.on('console', (message) => { if (message.type() === 'error') console.error('Browser console:', message.text()); });
  await page.goto('/');
  await page.locator('.event-card').first().waitFor({ timeout: 20000 });
  await capture(page, '01-home.png');

  await page.goto('/this-page-does-not-exist');
  await page.getByText('404', { exact: true }).waitFor();
  assert.equal(await page.locator('.full-error-illustration').evaluate((image) => image.complete && image.naturalWidth > 0), true);
  await page.goto('/dashboard');
  await page.waitForURL((url) => url.pathname === '/error/401');
  await page.getByRole('link', { name: /Iniciar sesión/ }).waitFor();

  await page.goto('/?municipality=Valencia');
  await page.locator('.event-card').first().waitFor({ timeout: 20000 });
  await page.evaluate(() => window.scrollTo(0, 560));
  await capture(page, '02-discover.png');

  await page.getByRole('button', { name: 'Mapa', exact: true }).click();
  await page.waitForTimeout(2500);
  console.log('Map diagnostics:', await page.evaluate(() => ({
    map: document.querySelectorAll('.event-map').length,
    markers: document.querySelectorAll('.nocturno-map-pin').length,
    tiles: document.querySelectorAll('.leaflet-tile-loaded').length,
    alerts: [...document.querySelectorAll('[role="alert"]')].map((node) => node.textContent?.trim()),
    status: document.querySelector('.map-status')?.textContent?.trim(),
  })));
  await page.locator('.nocturno-map-pin').first().waitFor({ state: 'attached', timeout: 20000 });
  await page.locator('.leaflet-tile-loaded').first().waitFor({ timeout: 20000 });
  await page.evaluate(() => window.scrollTo(0, 560));
  await capture(page, '03-discover-map.png');

  const eventsResponse = await page.request.get('/api/events?municipality=Valencia&limit=100');
  assert.equal(eventsResponse.status(), 200, 'Valencia events API must work');
  const events = (await eventsResponse.json()).data;
  const sampleEvent = events.find((event) => event.id === sampleEventId);
  assert.ok(sampleEvent, 'Seeded Nocturno event must appear in public Discover');
  await page.goto(`/events/${sampleEvent.slug}`);
  await page.locator('.detail-sidebar h1').getByText(sampleEvent.title).waitFor({ timeout: 20000 });
  await page.locator('app-ticket-type-card').first().waitFor({ timeout: 20000 });
  assert.equal(sampleEvent.images.length, 3, 'Seeded sample has a three-image gallery');
  await page.getByRole('button', { name: 'Imagen siguiente' }).click();
  await page.locator('.carousel-count').getByText('2 / 3').waitFor();
  await page.locator('.event-carousel').focus();
  await page.keyboard.press('ArrowLeft');
  await page.locator('.carousel-count').getByText('1 / 3').waitFor();
  await capture(page, '04-event-detail.png');

  const general = page.locator('app-ticket-type-card').filter({ hasText: 'General' });
  await general.getByRole('button', { name: 'Añadir una entrada' }).click();
  await page.locator('#entradas').evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 130));
  await general.locator('.ticket-price-equation').getByText('× 2').waitFor();
  await capture(page, '05-ticket-selection.png');

  await login(page, process.env.DEMO_USER_EMAIL, process.env.DEMO_USER_PASSWORD);
  await page.goto('/dashboard');
  await page.waitForURL((url) => url.pathname === '/error/403');
  await page.getByText('403', { exact: true }).waitFor();
  await page.goto(`/events/${sampleEvent.slug}`);
  const buyerGeneral = page.locator('app-ticket-type-card').filter({ hasText: 'General' });
  await buyerGeneral.waitFor({ timeout: 20000 });
  await buyerGeneral.getByRole('button', { name: 'Añadir una entrada' }).click();
  await buyerGeneral.getByRole('button', { name: /Añadir 2 entradas/ }).click();
  await page.getByText('Entrada añadida al carrito.').waitFor({ timeout: 15000 });
  await page.goto('/cart');
  await page.locator('.commerce-row').first().waitFor({ timeout: 15000 });
  await page.locator('.commerce-row-actions strong').getByText(/28/).waitFor();
  await capture(page, '06-cart.png');

  await page.goto('/account/tickets');
  await page.locator('.commerce-row').first().waitFor({ timeout: 15000 });
  await capture(page, '07-account-ticket.png');

  await page.goto(`/account/tickets/${sampleTicketId}`);
  await page.locator('.ticket-qr').waitFor({ timeout: 15000 });
  const ticketCode = (await page.locator('.ticket-pass-code code').textContent())?.trim();
  assert.match(ticketCode, /^[0-9a-f-]{36}$/i, 'QR contains only an opaque ticket code');
  await capture(page, '08-ticket-qr.png');

  const adminContext = await browser.newContext(contextOptions);
  const admin = await adminContext.newPage();
  await login(admin, process.env.DEMO_ADMIN_EMAIL, process.env.DEMO_ADMIN_PASSWORD);
  await admin.goto('/dashboard');
  await admin.locator('.metric-grid article').first().waitFor({ timeout: 15000 });
  await admin.getByText('Top eventos').waitFor();
  await capture(admin, '09-dashboard.png');

  await admin.goto(`/dashboard/events/${sampleEventId}/check-in`);
  await admin.locator('.checkin-hero').waitFor({ timeout: 15000 });
  await admin.locator('input[name="code"]').fill(ticketCode);
  await admin.getByRole('button', { name: 'Validar entrada' }).click();
  await admin.getByText('ACCESO CONCEDIDO').waitFor({ timeout: 15000 });
  await capture(admin, '10-checkin.png');

  // The published QR screenshot must never represent a usable access code.
  await admin.locator('input[name="code"]').fill(ticketCode);
  await admin.getByRole('button', { name: 'Validar entrada' }).click();
  await admin.getByText('ACCESO NO CONCEDIDO').waitFor({ timeout: 15000 });
  console.log('Published demo QR was invalidated; duplicate check-in rejected.');

  await admin.goto(`/dashboard/events/${sampleEventId}/edit`);
  const gallery = admin.locator('app-event-gallery-editor');
  await gallery.waitFor({ timeout: 15000 });
  await admin.waitForFunction((cover) =>
    document.querySelector('app-event-gallery-editor .gallery-editor-row input')?.value === cover,
  sampleEvent.images[0].url);
  assert.equal(await gallery.locator('.gallery-editor-row').count(), 3);
  await gallery.getByRole('button', { name: '+ Añadir imagen' }).click();
  await gallery.locator('.gallery-editor-row').nth(3).waitFor();
  const missingImage = '/posters/nocturno-missing-image.svg';
  await gallery.locator('.gallery-editor-row').last().locator('input').first().fill(missingImage);
  await gallery.getByRole('button', { name: 'Subir imagen 4' }).click();
  await admin.waitForFunction((url) =>
    document.querySelectorAll('app-event-gallery-editor .gallery-editor-row')[2]?.querySelector('input')?.value === url,
  missingImage);
  await gallery.getByRole('button', { name: 'Eliminar imagen 4' }).click();
  await gallery.locator('.gallery-editor-row').nth(3).waitFor({ state: 'detached' });
  await admin.getByRole('button', { name: /Guardar cambios/ }).click();
  await admin.getByText('Evento guardado correctamente.').waitFor({ timeout: 15000 });
  await admin.reload();
  await gallery.waitFor({ timeout: 15000 });
  await admin.waitForFunction((url) =>
    document.querySelectorAll('app-event-gallery-editor .gallery-editor-row')[2]?.querySelector('input')?.value === url,
  missingImage);
  await admin.goto(`/events/${sampleEvent.slug}`);
  await admin.getByRole('button', { name: 'Mostrar imagen 3' }).click();
  await admin.getByText('IMAGEN NO DISPONIBLE').waitFor({ timeout: 15000 });
  console.log('Gallery editor add, move, remove and save persisted; carousel image fallback rendered.');
  await adminContext.close();
  await publicContext.close();
} finally {
  await browser.close();
}
