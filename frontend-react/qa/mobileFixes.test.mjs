import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMediaUrl } from '../src/utils/mediaUrl.js';
import { sosResult } from '../src/utils/sosResult.js';

test('avatars resolve against the backend including old localhost records', () => {
  for (const value of ['/uploads/avatars/a.jpg', 'uploads/avatars/a.jpg', 'http://localhost:8000/uploads/avatars/a.jpg', 'http://127.0.0.1:8000/uploads/avatars/a.jpg']) {
    assert.equal(resolveMediaUrl(value, 'http://16.171.242.175/api/v1', 'http://localhost'), 'http://16.171.242.175/uploads/avatars/a.jpg');
  }
  assert.equal(resolveMediaUrl('https://example.com/photo.jpg', '/api/v1', 'https://lifeos.example'), 'https://example.com/photo.jpg');
  assert.equal(resolveMediaUrl('/uploads/a.jpg', '/api/v1', 'https://lifeos.example'), 'https://lifeos.example/uploads/a.jpg');
});

test('legacy SOS success does not hide provider failures', () => {
  for (const action of ['Twilio configuration missing', 'SMS failed', 'SOS logged. Notifications could not be delivered', 'SOS notification task 0 exception', 'SMS requests accepted: 1. Failed: 1.']) {
    assert.equal(sosResult({ success: true, actions: [action] }).ok, false);
  }
  assert.equal(sosResult({ success: true, actions: [] }).ok, false);
  assert.equal(sosResult({ success: false }).ok, false);
  const accepted = sosResult({ success: true, actions: ['Call requests accepted: 1.'] });
  assert.equal(accepted.ok, true);
  assert.match(accepted.message, /Delivery is not confirmed/);
});
