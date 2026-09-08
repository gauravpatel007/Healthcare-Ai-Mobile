export function sosResult(response) {
  const data = response?.data || response || {};
  const actions = Array.isArray(data.actions) ? data.actions.filter(action => typeof action === 'string') : [];
  if (actions.some(action => /20003|\b401\b|authenticate|authentication failed/i.test(action))) {
    return { ok: false, message: 'SMS/call service authentication failed. The server credentials or account access must be repaired. Call your emergency contact directly.' };
  }
  const errors = actions.filter(action => /fail|error|exception|missing|could not|not (?:configured|delivered)|no (?:phone|contact)/i.test(action));
  if (!data.success || errors.length) {
    const accepted = actions.filter(action => /requests? accepted/i.test(action));
    const details = [...new Set([...accepted, ...errors])];
    return { ok: false, message: details.join('\n') || data.message || 'SOS delivery could not be confirmed. Call your emergency contact directly.' };
  }
  if (!actions.length) return { ok: false, message: 'SOS was recorded, but notification delivery could not be confirmed. Call your emergency contact directly.' };
  const warning = actions.some(action => /recording unavailable/i.test(action)) ? ' Recording unavailable; a spoken SOS was used instead.' : '';
  return { ok: true, message: 'SOS notification requests submitted. Delivery is not confirmed; call directly if help is urgent.' + warning };
}
