export function invitationLink(token, origin) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) throw new Error('Invalid invitation token');
  const url = new URL('/emergency-invitation', origin);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('A public website URL is required.');
  // Fragments are not sent in HTTP requests or Referer headers.
  url.hash = new URLSearchParams({ token }).toString();
  return url.href;
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
