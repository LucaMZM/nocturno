import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const output = '../docs/screenshots/assistant';
await mkdir(output, { recursive: true });
try {
  if (process.argv.includes('--live')) {
    const context = await browser.newContext({
      baseURL: 'http://localhost:4200',
      viewport: { width: 390, height: 844 },
      locale: 'es-ES',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.getByRole('button', { name: 'Rechazar opcionales', exact: true }).click();
    await page.getByRole('button', { name: 'Hablar con Yomogan' }).click();
    await page.getByLabel('Cuéntame tu plan').fill('Techno en Valencia por menos de 20 euros');
    const response = page.waitForResponse(
      (res) => res.url().endsWith('/api/yomogan/chat') && res.request().method() === 'POST',
      { timeout: 240000 },
    );
    await page.getByRole('button', { name: 'Enviar mensaje a Yomogan' }).click();
    const { data } = await (await response).json();
    assert.equal(data.mode, 'assistant');
    assert.equal(data.retrieval, 'hybrid');
    await page.getByText('IA · contexto del catálogo', { exact: true }).waitFor();
    assert.ok(data.events.length >= 1 && data.events.length <= 3);
    await page.locator('.yomogan-event').first().waitFor();
    assert.equal(await page.locator('.yomogan-event').count(), data.events.length);
    for (const event of data.events) {
      assert.equal(event.municipality, 'Valencia');
      assert.ok(event.minPrice < 20);
      assert.ok(event.availability > 0);
      assert.ok(event.genres.includes('TECHNO'));
      assert.equal(
        await page.locator('.yomogan-event').filter({ hasText: event.title }).getAttribute('href'),
        event.href,
      );
    }
    await page.screenshot({ path: output + '/yomogan-real-ai-mobile.png' });
    console.log(
      'REAL_BROWSER_AI_VERIFIED: Angular → HTTP → Express → hybrid RAG → real Ollama → verified event cards.',
    );
    await context.close();
  } else {
    const context = await browser.newContext({
      baseURL: 'http://localhost:4200',
      viewport: { width: 1280, height: 900 },
      locale: 'es-ES',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    const banner = page.locator('.cookie-banner');
    await banner.waitFor();
    await page.getByRole('button', { name: 'Configurar', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Tú eliges el ritmo.' });
    await dialog.waitFor();
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    assert.equal(await page.getByRole('switch', { name: /necesarias/ }).isDisabled(), true);
    await page.getByRole('switch', { name: 'Preferencias', exact: true }).click();
    await page.screenshot({ path: `${output}/cookie-desktop.png` });
    await page.getByRole('button', { name: 'Guardar preferencias' }).click();
    await banner.waitFor({ state: 'detached' });
    await page.reload();
    assert.equal(await banner.count(), 0);
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('nocturno_cookie_demo_v1')),
    );
    assert.equal(stored.preferences, true);
    assert.equal(stored.analytics, false);
    assert.equal(stored.marketing, false);
    const reopen = page.getByRole('button', { name: 'Preferencias de cookies', exact: true });
    await reopen.click();
    await dialog.waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await reopen.evaluate((button) => button === document.activeElement), true);
    for (const [name, expected] of [
      ['Aceptar todas', true],
      ['Rechazar opcionales', false],
    ]) {
      await page.evaluate(() => localStorage.removeItem('nocturno_cookie_demo_v1'));
      await page.reload();
      await page.getByRole('button', { name, exact: true }).click();
      const choice = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('nocturno_cookie_demo_v1')),
      );
      assert.equal(choice.necessary, true);
      assert.equal(choice.analytics, expected);
      assert.equal(choice.marketing, expected);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await banner.waitFor();
    await page.screenshot({ path: `${output}/cookie-mobile.png` });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.getByRole('button', { name: 'Configurar', exact: true }).click();
    await dialog.waitFor();
    await page.keyboard.press('Shift+Tab');
    assert.equal(
      await page
        .getByRole('button', { name: 'Guardar preferencias' })
        .evaluate((button) => button === document.activeElement),
      true,
    );
    await page.keyboard.press('Tab');
    assert.equal(
      await page
        .getByRole('button', { name: 'Cerrar preferencias de cookies' })
        .evaluate((button) => button === document.activeElement),
      true,
    );
    await page.screenshot({ path: `${output}/cookie-preferences-mobile.png` });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Rechazar opcionales', exact: true }).click();
    await page.getByRole('button', { name: 'Hablar con Yomogan' }).click();
    const chat = page.getByRole('dialog', { name: 'Yomogan.' });
    await chat.waitFor();
    await page.getByLabel('Cuéntame tu plan').fill('Techno en Valencia menos de 20 euros');
    await page.getByRole('button', { name: 'Enviar mensaje a Yomogan' }).click();
    await page
      .getByText('Búsqueda · sin respuesta IA', { exact: true })
      .waitFor({ timeout: 30000 });
    assert.ok((await page.locator('.yomogan-event').count()) > 0);

    const avatarResponse = await page.request.get('/yomogan/avatar.png');
    assert.equal(avatarResponse.status(), 200);
    assert.match(avatarResponse.headers()['content-type'], /image\/png/);
    const avatarBytes = await readFile('public/yomogan/avatar.png');
    assert.deepEqual(await avatarResponse.body(), avatarBytes);
    for (const selector of [
      '.yomogan-launcher img',
      '.yomogan-panel header img',
      '.yomogan-message-label img',
    ]) {
      const image = page.locator(selector).first();
      await image.waitFor();
      await image.evaluate((img) => img.decode());
      assert.equal(await image.getAttribute('src'), '/yomogan/avatar.png');
      const actual = await image.evaluate((img) => ({
        width: img.naturalWidth, height: img.naturalHeight,
        fit: getComputedStyle(img).objectFit,
      }));
      assert.equal(actual.width, avatarBytes.readUInt32BE(16));
      assert.equal(actual.height, avatarBytes.readUInt32BE(20));
      assert.equal(actual.fit, 'contain');
    }
    console.log('YOMOGAN_AVATAR_VERIFIED: original PNG bytes, launcher, header and assistant message; loaded with original proportions.');

    const link = page.locator('.yomogan-event').first();
    assert.match(await link.getAttribute('href'), /^\/events\/[a-z0-9-]+$/);
    await page.screenshot({ path: output + '/yomogan-search-mobile.png' });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.getByLabel('Cuéntame tu plan').fill('¿Y en Madrid?');
    await page.getByRole('button', { name: 'Enviar mensaje a Yomogan' }).click();
    await page.waitForFunction(
      () => document.querySelectorAll('.yomogan-message:not(.is-user)').length === 2,
    );
    const lastLinks = page
      .locator('.yomogan-message:not(.is-user)')
      .last()
      .locator('.yomogan-event');
    for (const text of await lastLinks.allTextContents()) assert.match(text, /Madrid/);
    await page.getByRole('button', { name: 'Nueva conversación' }).click();
    await page.locator('.yomogan-message').first().waitFor({ state: 'detached' });
    assert.equal(await page.locator('.yomogan-message').count(), 0);
    await page.route('**/api/yomogan/chat', (route) => route.abort());
    await page.getByLabel('Cuéntame tu plan').fill('Valencia');
    await page.getByRole('button', { name: 'Enviar mensaje a Yomogan' }).click();
    await chat.getByRole('alert').waitFor();
    await page.unroute('**/api/yomogan/chat');
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await page
      .getByText('Búsqueda · sin respuesta IA', { exact: true })
      .waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: 'Nueva conversación' }).click();
    await page.getByLabel('Cuéntame tu plan').fill('Valencia menos de 0 euros');
    await page.getByRole('button', { name: 'Enviar mensaje a Yomogan' }).click();
    await page.getByText(/No hay coincidencias/).waitFor();
    assert.equal(await page.locator('.yomogan-event').count(), 0);
    await page.getByRole('button', { name: 'Cerrar Yomogan' }).click();
    await chat.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Hablar con Yomogan' }).click();
    await chat.waitFor();
    await page.keyboard.press('Escape');
    await chat.waitFor({ state: 'detached' });
    for (const width of [768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole('button', { name: 'Hablar con Yomogan' }).click();
      await chat.waitFor();
      const box = await chat.boundingBox();
      assert.ok(
        box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 900,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.screenshot({ path: output + '/yomogan-' + width + '.png' });
      await page.getByRole('button', { name: 'Cerrar Yomogan' }).click();
      await chat.waitFor({ state: 'detached' });
    }
    console.log(
      'Yomogan UI: open/close, real search fallback, follow-up, links, reset, no-results, network error and retry passed.',
    );
    assert.deepEqual(errors, []);
    console.log(
      'Cookie demo: first visit, accept, reject, configure, save, reload, reopen, keyboard and 390px passed.',
    );
    await context.close();
  }
} finally {
  await browser.close();
}
