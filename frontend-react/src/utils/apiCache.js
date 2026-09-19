/**
 * LifeOS — Lightweight in-memory API cache with stale-while-revalidate.
 *
 * Usage:
 *   import { cachedGet, invalidateCache } from './apiCache';
 *
 *   // In a component:
 *   const data = await cachedGet('/medicines');        // served from cache if fresh
 *   await API.post('/medicines', body);
 *   invalidateCache('/medicines');                     // bust cache after mutation
 */

const _store = new Map();  // key -> { data, ts }

const DEFAULT_TTL_MS = 60_000;  // 60 seconds

/**
 * Return cached data for `key` if it exists and is younger than `ttlMs`.
 * Returns `null` if the cache entry is missing or stale.
 */
export function getCached(key, ttlMs = DEFAULT_TTL_MS) {
  const entry = _store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) return null;
  return entry.data;
}

/**
 * Store `data` in the cache under `key`, timestamped to now.
 */
export function setCached(key, data) {
  _store.set(key, { data, ts: Date.now() });
}

/**
 * Remove a cache entry (call after POST / PUT / DELETE mutations).
 * Supports wildcard prefix: invalidateCache('/medicines') also clears '/medicines/today-logs'.
 */
export function invalidateCache(keyOrPrefix) {
  for (const k of _store.keys()) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix + '/') || k.startsWith(keyOrPrefix + '?')) {
      _store.delete(k);
    }
  }
}

/**
 * Clear every entry in the cache (e.g. on logout).
 */
export function clearAllCache() {
  _store.clear();
}

/**
 * Cached wrapper around API.get() with stale-while-revalidate semantics.
 *
 * 1. If fresh cache exists (< ttlMs old), return it immediately — no network call.
 * 2. If stale cache exists, return stale data AND fire a background refresh.
 * 3. If no cache exists, fetch from network and cache the result.
 *
 * @param {object} API         The API utility object (import from './api')
 * @param {string} endpoint    e.g. '/medicines'
 * @param {number} ttlMs       Cache lifetime in ms (default 60s)
 * @param {function} onRefresh Optional callback when stale data is refreshed
 * @returns {Promise<any>}
 */
export async function cachedGet(API, endpoint, ttlMs = DEFAULT_TTL_MS, onRefresh = null) {
  const fresh = getCached(endpoint, ttlMs);
  if (fresh !== null) return fresh;

  // Check for stale data (within 5× TTL)
  const stale = getCached(endpoint, ttlMs * 5);
  if (stale !== null) {
    // Return stale data, refresh silently in background
    API.get(endpoint).then(freshData => {
      setCached(endpoint, freshData);
      if (onRefresh) onRefresh(freshData);
    }).catch(() => { /* silent background refresh failure */ });
    return stale;
  }

  // No cache at all — must wait for network
  const data = await API.get(endpoint);
  setCached(endpoint, data);
  return data;
}
