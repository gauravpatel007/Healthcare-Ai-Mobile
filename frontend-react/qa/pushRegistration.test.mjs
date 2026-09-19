import test from 'node:test';
import assert from 'node:assert/strict';
import { createPushRegistration } from '../src/utils/pushRegistration.js';

test('registers after delayed login and SDK subscription; retries failure and deduplicates success', async () => {
  let authenticated = false, id = null, fail = true, calls = 0;
  const API = { isAuthenticated: () => authenticated, getToken: () => 'account-token',
    put: async (path, body) => {
      calls++;
      assert.equal(path, '/users/me/device-token');
      assert.deepEqual(body, { token: 'phone', timezone: 'Asia/Kolkata' });
      if (fail) throw new Error('offline');
    } };
  const register = createPushRegistration(API, { getIdAsync: async () => id, getOptedInAsync: async () => true }, () => 'Asia/Kolkata');
  assert.equal(await register(), false);
  authenticated = true;
  assert.equal(await register(), false);
  id = 'phone';
  await assert.rejects(register(), /offline/);
  fail = false;
  assert.equal(await register(), true);
  await register();
  assert.equal(calls, 2);
});

test('account switches and changed subscriptions re-register while opt-out is respected', async () => {
  let account = 'a', id = 'phone1', opted = true, calls = 0;
  const API = { isAuthenticated: () => true, getToken: () => account, put: async () => { calls++; } };
  const register = createPushRegistration(API, { getIdAsync: async () => id, getOptedInAsync: async () => opted }, () => 'UTC');
  await register(); account = 'b'; await register(); id = 'phone2'; await register();
  opted = false; id = 'phone3'; assert.equal(await register(), false);
  assert.equal(calls, 3);
});
