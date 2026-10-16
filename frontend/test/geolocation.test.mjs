import test from 'node:test';
import assert from 'node:assert/strict';
import { locateUser, geolocationMessage } from '../src/app/features/location/utils/geolocation.ts';

test('near-me asks for position only when invoked and uses valid coordinates', async () => {
  let calls = 0;
  const fake = { getCurrentPosition(success, _failure, options) {
    calls++;
    assert.equal(options.timeout, 10000);
    success({ coords: { latitude: 39.47, longitude: -0.37 } });
  } };
  assert.equal(calls, 0);
  assert.deepEqual(await locateUser(fake), { latitude: 39.47, longitude: -0.37 });
  assert.equal(calls, 1);
});

test('near-me explains denied, timeout and unavailable location', async () => {
  for (const [code, phrase] of [[1, 'bloqueado'], [3, 'tardó demasiado'], [2, 'No hemos podido']]) {
    const fake = { getCurrentPosition(_success, failure) { failure({ code }); } };
    await assert.rejects(locateUser(fake), (error) => {
      assert.match(geolocationMessage(error), new RegExp(phrase));
      return true;
    });
  }
  await assert.rejects(locateUser(undefined), (error) => {
    assert.match(geolocationMessage(error), /no ofrece localización/);
    return true;
  });
});
