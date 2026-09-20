import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestHospitals, hospitalDistance, fetchHospitalElements, hospitalDirections, watchNearbyHospitals, hospitalHoursToday, hospitalPhones, hospitalWebsite } from '../src/utils/nearbyHospitals.js';

test('today hours use published weekly ranges, split shifts, closed days and 24/7', () => {
  const monday = new Date(2026, 8, 21, 12);
  const sunday = new Date(2026, 8, 20, 12);
  assert.equal(hospitalHoursToday('24/7', monday), 'Open 24 hours');
  assert.equal(hospitalHoursToday('Mo-Fr 09:00-12:00,14:00-18:00; Sa 10:00-13:00; Su off', monday), '09:00-12:00, 14:00-18:00');
  assert.equal(hospitalHoursToday('Mo-Sa 09:00-18:00; Su off', sunday), 'Closed (published schedule)');
  assert.equal(hospitalHoursToday('Fr-Mo 10:00-16:00', sunday), '10:00-16:00');
  assert.equal(hospitalHoursToday('08:00-24:00', monday), '08:00-24:00');
  assert.equal(hospitalHoursToday('Mo-Fr 09:00-18:00', sunday), 'No hours listed for today');
  assert.equal(hospitalHoursToday(null), 'Hours not listed');
});

test('ambiguous, holiday, overnight and malformed hours are not presented as confirmed today', () => {
  for (const hours of ['Mo-Su 09:00-18:00; PH off', 'Mo 22:00-06:00', 'by appointment', 'Mo-Fr 09:00-18:00; Mo off', '09:70-18:00', '25:00-26:00', 'Jan-Mar 09:00-18:00']) {
    assert.match(hospitalHoursToday(hours), /could not be confirmed/);
  }
});

test('hospital detail fields use published contact tags, never infer doctors or hours', () => {
  const [hospital] = nearestHospitals([facility(1, 0, {
    emergency: 'yes', 'contact:phone': '+91 12345 67890; +91 23456 78901', 'contact:website': 'https://example.org/doctors',
  })], 0, 0);
  assert.equal(hospital.timing, null);
  assert.equal(hospital.website, 'https://example.org/doctors');
  assert.deepEqual(hospitalPhones(hospital.phone).map(phone => phone.dial), ['+911234567890', '+912345678901']);
  assert.deepEqual(hospitalPhones(null), []);
  assert.deepEqual(hospitalPhones('N/A'), []);
  assert.equal(hospitalWebsite('javascript://alert(1)'), null);
  assert.equal(hospitalWebsite('example.org'), 'https://example.org/');
});

const facility = (id, lat, tags = {}) => ({ type: 'node', id, lat, lon: 0, tags: { amenity: 'hospital', name: `Facility ${id}`, ...tags } });
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('ranks all results before limiting, validates coordinates and excludes non-hospitals', () => {
  const results = nearestHospitals([
    ...Array.from({ length: 15 }, (_, i) => facility(i, (15 - i) / 1000)),
    facility(20, 1), facility(21, NaN), facility(22, 0, { amenity: 'pharmacy' }),
    facility(23, 0, { disused: 'yes' }),
  ], 0, 0);
  assert.equal(results.length, 10);
  assert.equal(results[0].id, 'node/14');
  assert.equal(results.at(-1).id, 'node/5');
  assert.ok(Math.abs(hospitalDistance(0, 0, 0, 1) - 111.195) < 0.001);
  assert.ok(results.every((h, i) => i === 0 || h.rawDist >= results[i - 1].rawDist));
});

test('includes building/relation centers, deduplicates nearby same-name POIs, preserves address and type', () => {
  const results = nearestHospitals([
    facility(1, 0, { name: 'Local hospital', emergency: 'yes', 'addr:full': '10 Main Road' }),
    { type: 'way', id: 2, center: { lat: 0.0001, lon: 0 }, tags: { amenity: 'hospital', name: 'Local hospital' } },
    { type: 'relation', id: 3, center: { lat: 0.01, lon: 0 }, tags: { healthcare: 'clinic', name: 'Clinic', 'addr:street': 'Side Road', 'addr:city': 'Town' } },
    facility(4, 0.02, { name: 'Local hospital' }),
  ], 0, 0);
  assert.equal(results.length, 3);
  assert.equal(results[0].type, 'Emergency');
  assert.equal(results[0].address, '10 Main Road');
  assert.equal(results[1].type, 'Clinic');
  assert.equal(results[1].address, 'Side Road, Town');
  const url = new URL(hospitalDirections(results[0]));
  assert.equal(url.searchParams.get('destination'), '0,0');
  assert.equal(url.pathname, '/maps/dir/');
  assert.equal(url.searchParams.has('origin'), false);
});

test('queries actual coordinates and all geometry types, retries overload and rejects partial data', async () => {
  const calls = [];
  const result = await fetchHospitalElements(12, 77, new AbortController().signal, async (url, options) => {
    calls.push(url);
    const query = options.body.get('data');
    assert.match(query, /around:10000,12,77/);
    assert.match(query, /nwr/);
    assert.match(query, /out center tags/);
    return calls.length === 1 ? { ok: false, status: 429 } : { ok: true, json: async () => ({ elements: [] }) };
  });
  assert.deepEqual(result, []);
  assert.equal(calls.length, 2);
  await assert.rejects(fetchHospitalElements(0, 0, new AbortController().signal, async () => ({ ok: true, json: async () => ({ elements: [], remark: 'timeout' }) })), /Incomplete/);
  await assert.rejects(fetchHospitalElements(0, 0, new AbortController().signal, async () => { throw new Error('offline'); }), /offline/);
});

function tracking(t, fetchElements = async () => []) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
  const states = [];
  let position, error, cleared;
  const stop = watchNearbyHospitals(state => states.push(state), {
    secure: true, fetchElements,
    geolocation: {
      watchPosition(success, failure, options) {
        position = (lat, lon = 0) => success({ coords: { latitude: lat, longitude: lon } });
        error = code => failure({ code });
        assert.equal(options.enableHighAccuracy, true);
        assert.equal(options.maximumAge, 0);
        return 42;
      },
      clearWatch(id) { cleared = id; },
    },
  });
  t.after(stop);
  return { states, position, error, stop, cleared: () => cleared };
}

test('updates ordering on each fix, fetches after movement, and cleans up watcher', async t => {
  const calls = [];
  const session = tracking(t, async (lat, lon) => {
    calls.push([lat, lon]);
    return [facility(1, 0), facility(2, 0.001), facility(3, 1)];
  });
  session.position(0);
  t.mock.timers.tick(0);
  await settle();
  assert.equal(session.states.at(-1).hospitals[0].id, 'node/1');
  session.position(0.001);
  assert.equal(session.states.at(-1).hospitals[0].id, 'node/2');
  assert.equal(calls.length, 1);
  session.position(1);
  assert.equal(session.states.at(-1).loading, true);
  t.mock.timers.tick(30000);
  await settle();
  assert.equal(calls.length, 2);
  assert.equal(session.states.at(-1).hospitals[0].id, 'node/3');
  session.stop();
  assert.equal(session.cleared(), 42);
  const count = session.states.length;
  session.position(2);
  assert.equal(session.states.length, count);
});

test('discards an older search after movement and results after unmount', async t => {
  const pending = [];
  const session = tracking(t, (lat, lon, signal) => new Promise(resolve => pending.push({ resolve, signal })));
  session.position(0);
  t.mock.timers.tick(0);
  session.position(1);
  assert.equal(pending[0].signal.aborted, true);
  pending[0].resolve([facility(1, 0)]);
  await settle();
  assert.deepEqual(session.states.at(-1).hospitals, []);
  t.mock.timers.tick(30000);
  session.stop();
  const count = session.states.length;
  pending[1].resolve([facility(2, 1)]);
  await settle();
  assert.equal(session.states.length, count);
});

test('permission denial, GPS unavailable, timeout, unsupported and insecure contexts never emit fake results', t => {
  const session = tracking(t);
  for (const [code, message] of [[1, /permission denied/], [2, /Enable GPS/], [3, /timed out/]]) {
    session.error(code);
    assert.match(session.states.at(-1).error, message);
    assert.deepEqual(session.states.at(-1).hospitals, []);
    assert.equal(session.states.at(-1).loading, false);
  }
  for (const config of [{ secure: false }, { secure: true, geolocation: null }]) {
    const states = [];
    watchNearbyHospitals(state => states.push(state), config)();
    assert.ok(states.at(-1).error);
  }
});

test('unanswered permission is bounded', t => {
  const session = tracking(t);
  t.mock.timers.tick(25000);
  assert.match(session.states.at(-1).error, /timed out/);
});

test('empty search is a successful empty state', async t => {
  const session = tracking(t);
  session.position(0);
  t.mock.timers.tick(0);
  await settle();
  assert.deepEqual(session.states.at(-1), { hospitals: [], loading: false, error: null });
});

test('network errors clear results and stop loading', async t => {
  const session = tracking(t, async () => { throw new Error('offline'); });
  session.position(0);
  t.mock.timers.tick(0);
  await settle();
  assert.match(session.states.at(-1).error, /internet connection/);
  assert.equal(session.states.at(-1).loading, false);
  assert.deepEqual(session.states.at(-1).hospitals, []);
});
