export function sosResult(response) {
  const data = response?.data || response || {};
  const actions = Array.isArray(data.actions) ? data.actions : [];
  const errors = actions.filter(action => /fail|error|exception|missing|could not|not (?:configured|delivered)|no (?:phone|contact)/i.test(action));
  if (!data.success || errors.length) {
    return { ok: false, message: errors.join('\n') || data.message || 'SOS delivery could not be confirmed. Call your emergency contact directly.' };
  }
  if (!actions.length) return { ok: false, message: 'SOS was recorded, but notification delivery could not be confirmed. Call your emergency contact directly.' };
  return { ok: true, message: 'SOS notification requests submitted. Delivery is not confirmed; call directly if help is urgent.' };
}
