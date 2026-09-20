const SEARCH_RADIUS_KM = 10;

export function validCoordinates(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

export function hospitalDistance(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function nearestHospitals(elements, lat, lon) {
  const facilities = elements.flatMap(el => {
    const tags = el.tags || {};
    const clinic = tags.amenity === 'clinic' || tags.healthcare === 'clinic';
    if (!clinic && tags.amenity !== 'hospital' && tags.healthcare !== 'hospital') return [];
    if (['disused', 'abandoned', 'demolished', 'construction', 'proposed'].some(key => tags[key] === 'yes')) return [];
    const latitude = el.lat ?? el.center?.lat;
    const longitude = el.lon ?? el.center?.lon;
    if (!validCoordinates(latitude, longitude)) return [];
    const rawDist = hospitalDistance(lat, lon, latitude, longitude);
    if (rawDist > SEARCH_RADIUS_KM) return [];
    const type = tags.emergency === 'yes' ? 'Emergency' : clinic ? 'Clinic' : 'Hospital';
    const name = tags.name || tags['name:en'] || tags['name:local'];
    return [{
      id: `${el.type}/${el.id}`, name: name || `Unnamed ${clinic ? 'clinic' : 'hospital'}`,
      named: Boolean(name), type, rawDist,
      distance: rawDist < 1 ? `${Math.round(rawDist * 1000)} m` : `${rawDist.toFixed(2)} km`,
      lat: latitude, lon: longitude,
      address: tags['addr:full'] || [
        [tags['addr:housenumber'], tags['addr:street'] || tags['addr:place']].filter(Boolean).join(' '),
        tags['addr:suburb'], tags['addr:city'], tags['addr:postcode'],
      ].filter(Boolean).join(', '),
      phone: tags.phone || tags['contact:phone'] || null,
      timing: tags.opening_hours || null,
      website: hospitalWebsite(tags.website || tags['contact:website']),
    }];
  }).sort((a, b) => a.rawDist - b.rawDist);
  // OSM can describe the same facility as both a POI and a building/relation.
  const unique = [];
  for (const facility of facilities) {
    if (unique.some(other => other.id === facility.id || (
      other.named && facility.named && other.name.trim().toLowerCase() === facility.name.trim().toLowerCase() &&
      hospitalDistance(other.lat, other.lon, facility.lat, facility.lon) < 0.15
    ))) continue;
    unique.push(facility);
  }
  return unique.slice(0, 10);
}

export async function fetchHospitalElements(lat, lon, signal, fetchImpl = fetch) {
  if (!validCoordinates(lat, lon)) throw new Error('Invalid location');
  const query = `[out:json][timeout:25];(
    nwr["amenity"~"^(hospital|clinic)$"](around:10000,${lat},${lon});
    nwr["healthcare"~"^(hospital|clinic)$"](around:10000,${lat},${lon});
  );out center tags;`;
  // A second public instance handles temporary overload; neither requires a key.
  for (const endpoint of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const request = new AbortController();
    const abort = () => request.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 30000);
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST', body: new URLSearchParams({ data: query }), signal: request.signal,
      });
      if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.elements) || data.remark) throw new Error('Incomplete Overpass response');
      return data.elements;
    } catch (error) {
      if (signal.aborted || endpoint.includes('kumi.systems')) throw error;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  }
}

export function hospitalDirections(hospital) {
  // Omitting origin lets Maps obtain the user's current location when opened.
  return `https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lon}&travelmode=driving`;
}

export function hospitalWebsite(value) {
  if (!value) return null;
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function hospitalPhones(value) {
  return [...new Set((value || '').split(';').map(phone => phone.trim()).filter(Boolean))]
    .map(label => ({ label, dial: label.replace(/[^+\d]/g, '') }))
    .filter(phone => /\d{3}/.test(phone.dial));
}

// Interpret only unambiguous same-day weekly schedules. Complex OSM rules
// (holidays, seasons, appointments, overnight hours) remain visible verbatim.
// Do not claim a hospital is open now or infer 24/7 from emergency=yes.
export function hospitalHoursToday(value, date = new Date()) {
  if (!value?.trim()) return 'Hours not listed';
  const hours = value.trim();
  if (hours === '24/7') return 'Open 24 hours';
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const day = date.getDay();
  let today = null;
  const covered = new Set();
  const unknown = 'Today’s hours could not be confirmed — see published schedule';
  for (const rule of hours.split(';')) {
    const match = rule.trim().match(/^(?:([A-Za-z,-]+)\s+)?(off|closed|\d{2}:\d{2}-\d{2}:\d{2}(?:,\s*\d{2}:\d{2}-\d{2}:\d{2})*)$/);
    if (!match) return unknown;
    const days = new Set();
    for (const range of (match[1] || 'Su-Sa').split(',')) {
      if (!/^(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?$/.test(range)) return unknown;
      const [first, last = first] = range.split('-');
      let index = weekdays.indexOf(first);
      while (true) {
        days.add(index);
        if (index === weekdays.indexOf(last)) break;
        index = (index + 1) % 7;
      }
    }
    // Overlapping rules have more complex override semantics: show raw hours.
    for (const index of days) {
      if (covered.has(index)) return unknown;
      covered.add(index);
    }
    let label = 'Closed (published schedule)';
    if (!['off', 'closed'].includes(match[2])) {
      const slots = match[2].split(/,\s*/);
      for (const slot of slots) {
        const [start, end] = slot.split('-').map(time => {
          const [hour, minute] = time.split(':').map(Number);
          return hour <= 24 && minute < 60 && (hour < 24 || minute === 0) ? hour * 60 + minute : NaN;
        });
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return unknown;
      }
      label = slots.join(', ');
    }
    if (days.has(day)) today = label;
  }
  return today || 'No hours listed for today';
}

export function watchNearbyHospitals(onChange, {
  geolocation = globalThis.navigator?.geolocation,
  fetchElements = fetchHospitalElements,
  secure = globalThis.isSecureContext,
} = {}) {
  let active = true;
  let watcher;
  let request;
  let timer;
  let latest;
  let searched;
  let elements = [];
  let lastSearch = 0;
  const emit = (hospitals, loading, error = null) => active && onChange({ hospitals, loading, error });
  const fail = message => {
    request?.abort();
    clearTimeout(timer);
    timer = null;
    searched = null;
    elements = [];
    emit([], false, message);
  };
  const search = async () => {
    timer = null;
    searched = latest;
    lastSearch = Date.now();
    const current = new AbortController();
    request = current;
    try {
      const result = await fetchElements(searched.lat, searched.lon, current.signal);
      if (!active || current.signal.aborted) return;
      elements = result;
      emit(nearestHospitals(elements, latest.lat, latest.lon), false);
    } catch {
      if (active && !current.signal.aborted) fail('Unable to load nearby hospitals. Check your internet connection and try again.');
    }
  };
  emit([], true);
  if (secure === false) {
    fail('Location requires HTTPS. Open the app using a secure connection.');
  } else if (!geolocation) {
    fail('Geolocation is not supported on this device.');
  } else {
    // Also bound a permission prompt that is left unanswered by the browser.
    timer = setTimeout(() => fail('Location timed out. Enable GPS/location services and try again.'), 25000);
    try {
      watcher = geolocation.watchPosition(({ coords }) => {
        if (!active) return;
        const { latitude: lat, longitude: lon } = coords;
        if (!validCoordinates(lat, lon)) {
          fail('A valid location is unavailable. Enable GPS/location services and try again.');
          return;
        }
        latest = { lat, lon };
        if (!searched || hospitalDistance(searched.lat, searched.lon, lat, lon) >= 0.25) {
          request?.abort();
          elements = [];
          emit([], true);
          clearTimeout(timer);
          // Refresh after 250 m of movement, at most once per 30 seconds.
          timer = setTimeout(search, Math.max(0, 30000 - (Date.now() - lastSearch)));
        } else if (elements.length || !request) {
          emit(nearestHospitals(elements, lat, lon), false);
        }
      }, error => {
        if (!active) return;
        fail(error.code === 1
          ? 'Location permission denied. Allow location access in your browser/app settings and try again.'
          : error.code === 3
            ? 'Location timed out. Enable GPS/location services and try again.'
            : 'Location unavailable. Enable GPS/location services and try again.');
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    } catch {
      fail('Location unavailable. Check location permissions and enable GPS/location services.');
    }
  }
  return () => {
    active = false;
    if (watcher !== undefined) geolocation.clearWatch(watcher);
    request?.abort();
    clearTimeout(timer);
  };
}
