// Register the current native subscription after authentication and SDK startup.
// A failed request must remain retryable; SDK initialization can finish after login.
export function createPushRegistration(API, subscription, zone) {
  let saved = '', inFlight;
  return function register() {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      if (!API.isAuthenticated()) { saved = ''; return false; }
      const token = await subscription.getIdAsync();
      if (!token || !await subscription.getOptedInAsync()) return false;
      const account = API.getToken();
      const key = `${account}:${token}`;
      if (saved === key) return true;
      await API.put('/users/me/device-token', { token, timezone: zone() });
      if (API.isAuthenticated() && API.getToken() === account) saved = key;
      return true;
    })().finally(() => { inFlight = null; });
    return inFlight;
  };
}
