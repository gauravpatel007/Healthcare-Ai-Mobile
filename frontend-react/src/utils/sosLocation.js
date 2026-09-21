export async function getSosLocation(geolocation = globalThis.navigator?.geolocation, timeoutVal = 15000) {
  const getDeviceLocation = () => {
    if (!geolocation) return Promise.resolve(null);
    return new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), timeoutVal);
      try {
        geolocation.getCurrentPosition(({ coords }) => {
          const { latitude, longitude, accuracy } = coords;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
              Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
            finish(null);
            return;
          }
          finish({ latitude, longitude, ...(Number.isFinite(accuracy) && accuracy >= 0 ? { accuracy } : {}) });
        }, () => finish(null), { timeout: timeoutVal, enableHighAccuracy: false, maximumAge: 60000 });
      } catch {
        finish(null);
      }
    });
  };

  let loc = await getDeviceLocation();
  
  if (!loc) {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        if (data && data.latitude && data.longitude) {
          loc = { latitude: data.latitude, longitude: data.longitude, accuracy: 10000 };
        }
      }
    } catch (e) {
      console.warn("IP location fallback failed", e);
    }
  }
  
  return loc;
}
