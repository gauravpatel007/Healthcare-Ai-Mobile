import test from 'node:test';
import assert from 'node:assert/strict';
import { getSosLocation } from '../src/utils/sosLocation.js';
import { sosResult } from '../src/utils/sosResult.js';

test('SOS requests fresh device coordinates, including zero coordinates', async () => {
  const location = await getSosLocation({ getCurrentPosition(success, failure, options) {
    assert.equal(options.maximumAge, 0);
    assert.equal(options.enableHighAccuracy, true);
    success({ coords: { latitude: 0, longitude: 72.4622436, accuracy: 12 } });
  } });
  assert.deepEqual(location, { latitude: 0, longitude: 72.4622436, accuracy: 12 });
});

test('denied, missing, invalid and throwing geolocation allow SOS without fake coordinates', async () => {
  for (const geolocation of [null,
    { getCurrentPosition(success, failure) { failure({ code: 1 }); } },
    { getCurrentPosition() { throw new Error('blocked'); } },
    { getCurrentPosition(success) { success({ coords: { latitude: NaN, longitude: 72 } }); } },
  ]) assert.equal(await getSosLocation(geolocation), null);
});

test('unanswered permission prompt has a deadline and ignores late coordinates', async () => {
  let callback;
  const request = getSosLocation({ getCurrentPosition(success) { callback = success; } }, 10);
  assert.equal(await request, null);
  callback({ coords: { latitude: 23, longitude: 72, accuracy: 10 } });
  assert.equal(await request, null);
});

test('SOS results distinguish submitted SMS with location from missing location', () => {
  const response = { success: true, actions: ['SMS requests accepted: 1. Maps link included.', 'Call requests accepted: 1.'] };
  const result = sosResult(response, { locationAvailable: true });
  assert.equal(result.ok, true);
  assert.match(result.message, /SMS requests accepted: 1/);
  assert.match(result.message, /Maps link included/);
  assert.match(result.message, /Delivery is not confirmed/);
  const missing = sosResult({ success: true, actions: ['Call requests accepted: 1.'] }, { locationAvailable: false });
  assert.equal(missing.ok, false);
  assert.match(missing.message, /no Maps link was included/);
});

test('trial rejection keeps call acceptance and location warning visible', () => {
  const result = sosResult({ success: true, actions: [
    'Call requests accepted: 1.',
    'Notification failed: SMS unavailable: this Twilio trial only permits preset templates.',
  ] }, { locationAvailable: false });
  assert.equal(result.ok, false);
  assert.match(result.message, /Call requests accepted: 1/);
  assert.match(result.message, /preset templates/);
  assert.match(result.message, /Location unavailable/);
});

test('SMS authentication failure preserves accepted calls without leaking raw errors', () => {
  const result = sosResult({ success: true, actions: [
    'Call requests accepted: 1.',
    'HTTP Error 401 POST /Accounts/private/Messages.json Authenticate',
  ] });
  assert.equal(result.ok, false);
  assert.match(result.message, /Call requests accepted: 1/);
  assert.match(result.message, /authentication failed/);
  assert.doesNotMatch(result.message, /private|POST/);
});
