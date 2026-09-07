import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateMobileApiUrl } from '../src/utils/apiConfig.js';

// Load the actual API client with browser/build dependencies stubbed for Node.
const source = (await readFile(new URL('../src/utils/api.js', import.meta.url), 'utf8'))
  .replace("import { Capacitor } from '@capacitor/core';", 'const Capacitor = { isNativePlatform: () => false };')
  .replace("import { validateMobileApiUrl } from './apiConfig.js';", '')
  .replace("import { resolveMediaUrl } from './mediaUrl.js';", '')
  .replaceAll('import.meta.env.', '({}).') + '\n//# sourceURL=api-under-test.js';
const { default: API } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
globalThis.localStorage = { getItem: () => null };

test('mobile builds reject relative and device-local backend addresses', () => {
  for (const value of ['/api/v1', '', 'http://localhost:8000/api/v1', 'http://127.0.0.1/api/v1', 'http://[::1]/api/v1', 'http://example.com/app']) {
    assert.throws(() => validateMobileApiUrl(value), /Mobile backend is not configured/);
  }
  assert.equal(validateMobileApiUrl('https://example.com/api/v1/'), 'https://example.com/api/v1');
});

test('API rejects HTML, empty bodies and JSON null instead of returning a false login success', async () => {
  for (const body of ['<!doctype html><html>App</html>', '', 'null']) {
    globalThis.fetch = async () => new Response(body, { status: 200 });
    await assert.rejects(API.post('/auth/login', {}), /empty or invalid response/);
  }
});

test('API preserves valid JSON, no-content success and server error messages', async () => {
  const data = { data: { requires_2fa: true } };
  globalThis.fetch = async () => Response.json(data);
  assert.deepEqual(await API.post('/auth/login', {}), data);
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await API.delete('/item'), null);
  globalThis.fetch = async () => Response.json({ detail: 'Invalid credentials' }, { status: 401 });
  await assert.rejects(API.post('/auth/login', {}), /Invalid credentials/);
});
