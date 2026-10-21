import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const directory = join(process.cwd(), 'node_modules/.cache/nocturno-cookie-tests');
const output = join(directory, `choice-${process.pid}.mjs`);
await mkdir(directory, { recursive: true });
await build({ entryPoints: ['src/app/features/cookies/utils/cookie-choice.ts'],
  bundle: true, format: 'esm', platform: 'node', outfile: output });
after(() => rm(output, { force: true }));
const { readCookieChoice, cookieChoice } = await import(pathToFileURL(output).href);
test('visual preferences round-trip and necessary remains active', () => {
  for (const optional of [true, false]) {
    const choice = cookieChoice(optional);
    assert.deepEqual(readCookieChoice({ getItem: () => JSON.stringify(choice) }), choice);
    assert.equal(choice.necessary, true);
  }
});
test('invalid or unavailable storage starts with no remembered choice', () => {
  for (const value of ['bad json', 'null', '{}', '{"version":2}', '{"version":1,"necessary":false}'])
    assert.equal(readCookieChoice({ getItem: () => value }), null);
  assert.equal(readCookieChoice(null), null);
  assert.equal(readCookieChoice({ getItem: () => { throw Error('blocked'); } }), null);
});
