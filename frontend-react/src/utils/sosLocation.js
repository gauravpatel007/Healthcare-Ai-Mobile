// Never replace a denied/unavailable device location with an IP-based estimate.
// A separate deadline also bounds browsers that leave the permission prompt open.
export function getSosLocation(geolocation = globalThis.navigator?.geolocation, timeout = 6000) {
  if (!geolocation) return Promise.resolve(null);
  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeout);
    try {
      geolocation.getCurrentPosition(({ coords }) => {
        const { latitude, longitude, accuracy } = coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
          finish(null);
          return;
        }
        finish({ latitude, longitude, ...(Number.isFinite(accuracy) && accuracy >= 0 ? { accuracy } : {}) });
      }, () => finish(null), { timeout, enableHighAccuracy: true, maximumAge: 0 });
    } catch {
      finish(null);
    }
  });
}
