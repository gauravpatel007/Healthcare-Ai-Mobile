import { Capacitor, registerPlugin } from '@capacitor/core';
import { useSyncExternalStore } from 'react';
import API from './api';
import { legacyReminderPreview } from './reminderCompatibility';

// Timeout wrapper — prevents fetch from hanging indefinitely (e.g. ECONNREFUSED on mobile)
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms))
  ]);
}

export const nativeReminders = Capacitor.getPlatform() === 'android';
const Native = registerPlugin('MedicineReminders');
const namespace = location.pathname.startsWith('/qa/') ? 'lifeos_qa_medicine_reminder' : 'lifeos_medicine_reminder';
const CACHE = `${namespace}_cache`;
const QUEUE = `${namespace}_queue`;
const DEVICE = `${namespace}_device`;
const parse = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
export const deviceId = () => {
  let id = localStorage.getItem(DEVICE);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE, id); }
  return id;
};
export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
let state = { data: parse(CACHE, null), loading: false, error: '', pending: 0, rejected: [], permission: null, offline: !navigator.onLine };
const listeners = new Set();
const update = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
export function useReminders() { return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => state); }
let inFlight;
let generation = 0;
let backendAvailable = null;
export const reminderApiAvailable = () => backendAvailable === true;

async function compatibilityPreview() {
  const [medicines, logs] = await Promise.all([API.get('/medicines'), API.get('/medicines/today-logs').catch(() => [])]);
  const data = legacyReminderPreview(medicines || [], logs || []);
  update({ data, error: '', loading: false, offline: false });
}

export async function retryReminderBackend() {
  backendAvailable = null;
  return refreshReminders();
}

async function configure(data) {
  if (!nativeReminders) return;
  const s = data.settings;
  const permission = await Native.configure({ user_id: data.user_id, timezone: s.timezone, rules: data.rules,
    stocks: data.medicines.filter(m => ['tablet', 'capsule'].includes(m.type) && m.is_active).map(m => ({ ...m, ...s.overrides[m.id] })),
    doses: data.doses,
    enabled: s.enabled && s.delivery === 'device' && s.device_id === deviceId(), grace_minutes: s.grace_minutes });
  update({ permission });
}

export function refreshReminders() {
  if (inFlight) return inFlight;
  const epoch = generation;
  inFlight = (async () => {
    if (!API.isAuthenticated()) return;
    update({ loading: !state.data });
    try {
      if (backendAvailable === null) {
        try {
          if (typeof API.supportsReminders === 'function') {
            const supported = await withTimeout(API.supportsReminders(), 5000);
            if (supported === false) backendAvailable = false;
          }
        } catch {
          // If check fails or times out, default to trying
        }
      }
      if (backendAvailable === false) {
        await withTimeout(compatibilityPreview(), 8000);
        return;
      }
      let data;
      try {
        data = await withTimeout(API.get(`/reminders?timezone=${encodeURIComponent(localZone())}`), 8000);
        backendAvailable = true;
      } catch (err) {
        console.warn('Direct /reminders fetch failed:', err);
        if (err.status === 404) {
          backendAvailable = false;
        }
        try {
          await withTimeout(compatibilityPreview(), 8000);
        } catch (fallbackErr) {
          update({ error: fallbackErr.message || 'Backend unreachable', loading: false, offline: true });
        }
        return;
      }
      if (epoch !== generation) return;
      if (state.data && state.data.user_id !== data.user_id) {
        localStorage.removeItem(QUEUE); localStorage.removeItem(CACHE);
      }
      await configure(data);
      const nativeQueue = nativeReminders ? (await Native.queue()).actions : [];
      const actions = [...parse(QUEUE, []), ...nativeQueue].filter(a => a.user_id === data.user_id)
        .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
      const done = [], rejected = [];
      for (const a of actions) {
        if (epoch !== generation) return;
        try {
          await API.post(`/reminders/doses/${encodeURIComponent(a.dose_id)}/action`, a);
          done.push(a.action_id);
        } catch (e) {
          if (e.status && e.status < 500) rejected.push({ ...a, error: e.message });
          else throw e;
        }
      }
      if (actions.length) data = await API.get(`/reminders?timezone=${encodeURIComponent(localZone())}`);
      if (epoch !== generation) return;
      localStorage.setItem(QUEUE, JSON.stringify(parse(QUEUE, []).filter(a => !done.includes(a.action_id))));
      if (nativeReminders) await Native.acknowledge({ ids: done, doses: data.doses });
      localStorage.setItem(CACHE, JSON.stringify(data));
      // Keep queued actions visible until the server confirms them.
      const waiting = actions.filter(a => !done.includes(a.action_id));
      for (const a of waiting) {
        if (rejected.some(r => r.action_id === a.action_id)) continue;
        const dose = data.doses.find(d => d.id === a.dose_id);
        if (dose) Object.assign(dose, { status: a.status, acted_at: a.occurred_at, reason: a.reason,
          snoozed_until: a.status === 'snoozed' ? new Date(new Date(a.occurred_at).getTime() + a.minutes * 60000).toISOString() : null });
      }
      update({ data, error: '', loading: false, offline: false, pending: waiting.length, rejected });
      window.dispatchEvent(new Event('medicine-reminders-updated'));
      
      if (typeof window !== 'undefined' && window._registerOneSignalToken) {
        window._registerOneSignalToken();
      }
    } catch (e) {
      if (e.status === 404 && epoch === generation) {
        backendAvailable = false;
        try { await compatibilityPreview(); } catch (fallbackError) {
          update({ error: fallbackError.message, loading: false, offline: !fallbackError.status });
        }
        return;
      }
      if (epoch === generation) update({ error: e.message, loading: false, offline: !e.status });
    }
  })().finally(() => { inFlight = undefined; });
  return inFlight;
}

export async function recordDose(dose, status, options = {}) {
  if (!state.data) throw new Error('Load your medicine schedule first.');
  if (state.data.compatibility) throw new Error('Reminder actions require the backend update.');
  const action = { action_id: crypto.randomUUID(), dose_id: dose.id, medicine_id: dose.medicine_id,
    user_id: state.data.user_id, name: dose.name, dosage: dose.dosage, status,
    occurred_at: new Date().toISOString(), minutes: 15, reason: '', ...options };
  if (nativeReminders) await Native.record(action);
  else localStorage.setItem(QUEUE, JSON.stringify([...parse(QUEUE, []), action]));
  const data = { ...state.data, doses: state.data.doses.map(d => d.id === dose.id ? { ...d, status,
    acted_at: action.occurred_at, reason: action.reason,
    snoozed_until: status === 'snoozed' ? new Date(Date.now() + action.minutes * 60000).toISOString() : null } : d) };
  localStorage.setItem(CACHE, JSON.stringify(data));
  update({ data, pending: state.pending + 1 });
  refreshReminders(); // Fire and forget so UI doesn't hang
}

export async function discardAction(id) {
  localStorage.setItem(QUEUE, JSON.stringify(parse(QUEUE, []).filter(a => a.action_id !== id)));
  if (nativeReminders) await Native.acknowledge({ ids: [id], doses: state.data?.doses || [] });
  refreshReminders(); // Fire and forget
}

export async function saveReminderSettings(patch) {
  if (state.data?.compatibility) throw new Error('Reminder settings require the backend update.');
  const next = { ...state.data.settings, ...patch };
  await API.put('/reminders/settings', next);
  await refreshReminders();
}

export async function enableReminderNotifications() {
  if (nativeReminders) {
    try {
      const permission = await Native.enable();
      update({ permission });
      if (!permission.notifications) console.warn('Allow LifeOS notifications in Android settings.');
    } catch (e) {
      console.warn('Native notification enable failed:', e);
    }
    // Always use server push since native local notifications aren't implemented
    await saveReminderSettings({ enabled: true, delivery: 'server', device_id: deviceId() });
  } else {
    const OneSignal = typeof window !== 'undefined' ? window.OneSignal : null;
    if (OneSignal?.Notifications?.requestPermission) {
      await OneSignal.Notifications.requestPermission();
      const token = OneSignal.User?.PushSubscription?.id;
      if (!token) throw new Error('Push registration is not ready. Allow notifications and try again.');
      await API.put('/users/me/device-token', { token });
      await saveReminderSettings({ enabled: true, delivery: 'server', device_id: null });
    } else {
      throw new Error('Push notifications are currently supported on the Android mobile app.');
    }
  }
}
export const openAlarmSettings = () => Native.openAlarmSettings();
export const openNotificationSettings = () => Native.openNotificationSettings();
export async function testReminderNotification() {
  if (nativeReminders) {
    const registered = await window._registerOneSignalToken?.();
    if (!registered) throw new Error('Allow LifeOS notifications and sign in, then try again.');
  }
  return API.post('/users/me/test-push', {});
}

export async function clearReminderSession() {
  generation++;
  backendAvailable = null;
  if (nativeReminders) await Native.clear();
  localStorage.removeItem(CACHE); localStorage.removeItem(QUEUE);
  update({ data: null, pending: 0, rejected: [], error: '' });
}

export function startReminderSync() {
  let stopped = false;
  const refresh = () => { if (!stopped && document.visibilityState !== 'hidden') refreshReminders(); };
  refresh();
  const timer = setInterval(refresh, 30000);
  window.addEventListener('online', refresh);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('focus', refresh);
  return () => { stopped = true; clearInterval(timer); window.removeEventListener('online', refresh);
    window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
}

export function startReminderNavigation(navigate) {
  if (!nativeReminders) return () => {};
  let stopped = false, handle;
  const open = () => {
    if (!stopped) navigate(API.isAuthenticated() ? '/app/medicine?tab=reminders' : '/?login=true');
  };
  Native.consumeOpen().then(r => { if (r.open) open(); }).catch(console.error);
  Native.addListener('openReminder', open).then(h => { if (stopped) h.remove(); else handle = h; });
  return () => { stopped = true; handle?.remove(); };
}
