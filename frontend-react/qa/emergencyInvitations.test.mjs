import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationLink, whatsappInvitation, invitationReturnPath, sosLocationLink, telegramWhatsappInvitation, emergencyInvitationOrigin } from '../src/utils/emergencyInvitations.js';
import { sosResult } from '../src/utils/sosResult.js';

test('WhatsApp draft targets the explicit number and carries a private fragment invitation', () => {
  const token = 'a'.repeat(43);
  const link = invitationLink(token, 'https://lifeos.example');
  const url = new URL(link);
  assert.equal(url.pathname, '/emergency-invitation');
  assert.equal(url.search, '');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('token'), token);
  const whatsapp = new URL(whatsappInvitation('919876543210', link));
  assert.equal(whatsapp.origin, 'https://wa.me');
  assert.equal(whatsapp.pathname, '/919876543210');
  assert.ok(whatsapp.searchParams.get('text').includes(link));
  assert.match(whatsapp.searchParams.get('text'), /does not verify your phone/);
});

test('invalid tokens, phone numbers and redirects cannot create unsafe links', () => {
  for (const token of ['', 'short', 'a'.repeat(101), 'https://evil.example']) {
    assert.throws(() => invitationLink(token, 'https://lifeos.example'));
  }
  assert.throws(() => invitationLink('a'.repeat(43), 'javascript:alert(1)'));
  for (const number of ['', '0'.repeat(10), '+919876543210', '123?text=bad']) {
    assert.throws(() => whatsappInvitation(number, 'https://lifeos.example'));
  }
  for (const path of ['https://evil.example', '//evil.example', '/app', '/emergency-invitation/../evil', '/emergency-invitation#token=short']) {
    assert.equal(invitationReturnPath(path), null);
  }
  const path = `/emergency-invitation#token=${'a'.repeat(43)}`;
  assert.equal(invitationReturnPath(path), path);
  assert.equal(invitationReturnPath('/emergency-invitation'), '/emergency-invitation');
});

test('received alert maps links accept only valid fixed-host coordinate URLs', () => {
  assert.equal(sosLocationLink('Location: https://www.google.com/maps?q=0.0,-72.3'), 'https://www.google.com/maps?q=0.0,-72.3');
  assert.equal(sosLocationLink('https://evil.example/maps?q=0,0'), null);
  assert.equal(sosLocationLink('https://www.google.com/maps?q=91,0'), null);
});

test('WhatsApp phone verification goes to the entered contact and preserves the Telegram token', () => {
  const link = `https://t.me/LifeOSTestBot?start=${'a'.repeat(43)}`;
  const url = new URL(telegramWhatsappInvitation('+91 98765 43210', link));
  assert.equal(url.pathname, '/919876543210');
  assert.ok(url.searchParams.get('text').includes(link));
  assert.match(url.searchParams.get('text'), /tap Confirm, then Share My Phone Number/);
  assert.throws(() => telegramWhatsappInvitation('+919876543210', 'https://evil.example/?start=x'));
});

test('app invitations preserve configured public ports and never invent a fallback website', () => {
  assert.equal(emergencyInvitationOrigin('https://lifeos.example:8443', 'http://localhost:5173'), 'https://lifeos.example:8443');
  assert.equal(emergencyInvitationOrigin('', 'https://lifeos.example'), 'https://lifeos.example');
  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', 'capacitor://localhost']) {
    assert.throws(() => emergencyInvitationOrigin('', origin), /published LifeOS website/);
  }
});

test('SOS feedback distinguishes an inbox save from email or push delivery', () => {
  const saved = 'In-app alerts saved: 1. Recipients may not have seen them yet.';
  const success = sosResult({ success: true, actions: [saved] }, { locationAvailable: true });
  assert.equal(success.ok, true);
  assert.match(success.message, /In-app alerts saved/);
  assert.doesNotMatch(success.message, /notification requests submitted/);
  const failure = sosResult({ success: true, actions: [saved, 'Email could not be delivered.'] });
  assert.equal(failure.ok, false);
  assert.match(failure.message, /In-app alerts saved/);
  assert.match(failure.message, /Email could not/);
});
