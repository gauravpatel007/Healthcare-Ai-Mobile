export function sosResult(response, { locationAvailable } = {}) {
  const data = response?.data || response || {};
  const locationWarning = locationAvailable === false
    ? ' Location unavailable; no Maps link was included. Allow location access to share it.' : '';
  const actions = Array.isArray(data.actions) ? data.actions.filter(action => typeof action === 'string') : [];
  if (actions.some(action => /20003|\b401\b|authenticate|authentication failed/i.test(action))) {
    // Extract only safe counts from legacy responses that can contain raw URLs.
    const accepted = actions.map(action => action.match(/^(SMS|Call) requests accepted: \d+\./)?.[0]).filter(Boolean);
    return { ok: false, message: (accepted.length ? accepted.join('\n') + '\n' : '') + 'SMS/call service authentication failed. The server credentials or account access must be repaired. Call your emergency contact directly.' + locationWarning };
  }
  const errors = actions.filter(action => /fail|error|exception|missing|could not|not (?:configured|delivered)|no (?:phone|contact)/i.test(action));
  if (!data.success || errors.length) {
    const accepted = actions.filter(action => /requests? accepted/i.test(action));
    const details = [...new Set([...accepted, ...errors])];
    return { ok: false, message: (details.join('\n') || data.message || 'SOS delivery could not be confirmed. Call your emergency contact directly.') + locationWarning };
  }
  if (!actions.length) return { ok: false, message: 'SOS was recorded, but notification delivery could not be confirmed. Call your emergency contact directly.' };
  const warning = actions.some(action => /recording unavailable/i.test(action)) ? ' Recording unavailable; a spoken SOS was used instead.' : '';
  const accepted = actions.filter(action => /requests? accepted/i.test(action)).join('\n');
  return { ok: !locationWarning, message: (accepted ? accepted + '\n' : '') + 'SOS notification requests submitted. Delivery is not confirmed; call directly if help is urgent.' + warning + locationWarning };
}
