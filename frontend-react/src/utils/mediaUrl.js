export function resolveMediaUrl(value, apiBase, origin) {
  if (!value) return null;
  if (/^(data:image\/|blob:)/i.test(value)) return value;
  let path = value.trim();
  if (/^https?:\/\//i.test(path)) {
    const parsed = new URL(path);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) return path;
    path = parsed.pathname + parsed.search;
  }
  const backend = new URL(apiBase, origin);
  return new URL(path.startsWith('/') ? path : '/' + path, backend.origin).href;
}
