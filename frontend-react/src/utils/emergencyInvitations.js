export function invitationLink(token, origin) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) throw new Error('Invalid invitation token');
  const url = new URL('/emergency-invitation', origin);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('A public website URL is required.');
  // Fragments are not sent in HTTP requests or Referer headers.
  url.hash = new URLSearchParams({ token }).toString();
  return url.href;
}

export function emergencyInvitationOrigin(publicUrl, currentOrigin) {
  const url = new URL(publicUrl || currentOrigin);
  if (!['http:', 'https:'].includes(url.protocol) || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(url.hostname)) {
    throw new Error('App invitations need a published LifeOS website. This page is running only on your computer. You can still share the Telegram phone-verification link above.');
  }
  return url.origin;
}

export function telegramWhatsappInvitation(phone, link) {
  const number = (phone || '').replace(/[\s().-]/g, '').replace(/^00/, '').replace(/^\+/, '');
  if (!/^[1-9][0-9]{7,14}$/.test(number)) throw new Error('Include the phone country code.');
  const url = new URL(link);
  if (url.origin !== 'https://t.me' || !/^\/[A-Za-z0-9_]{5,32}$/.test(url.pathname) || !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get('start') || '')) {
    throw new Error('Invalid Telegram verification link.');
  }
  const message = `Please confirm my LifeOS SOS emergency-contact request. Open this personal link in your Telegram account, tap Confirm, then Share My Phone Number. Only your own matching phone number can be verified. Please do not forward this link:\n${url.href}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function whatsappInvitation(number, link) {
  if (!/^[1-9][0-9]{7,14}$/.test(number)) throw new Error('Include the phone country code.');
  const message = `Please be my LifeOS emergency contact. Log in and choose Accept to receive my SOS app alerts (email is optional). This does not verify your phone or enable automated calls/SMS. You can stop alerts anytime. Please do not forward this personal link:\n${link}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function invitationReturnPath(value) {
  return /^\/emergency-invitation(?:#token=[A-Za-z0-9_-]{40,100})?$/.test(value || '') ? value : null;
}

export function sosLocationLink(message) {
  const match = message?.match(/https:\/\/www\.google\.com\/maps\?q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!match || Math.abs(Number(match[1])) > 90 || Math.abs(Number(match[2])) > 180) return null;
  return match[0];
}
