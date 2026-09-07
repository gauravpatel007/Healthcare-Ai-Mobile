export function validateMobileApiUrl(value) {
  let url;
  try { url = new URL(value); } catch { /* Report configuration errors below. */ }
  if (!url || !['http:', 'https:'].includes(url.protocol) ||
      ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash ||
      !url.pathname.replace(/\/$/, '').endsWith('/api/v1')) {
    throw new Error('Mobile backend is not configured. Set VITE_API_URL to a reachable backend URL ending in /api/v1, then rebuild the APK.');
  }
  return value.replace(/\/$/, '');
}
