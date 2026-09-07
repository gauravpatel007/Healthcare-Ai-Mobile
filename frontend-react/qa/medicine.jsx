// Development-only visual fixture. All API calls stay in memory; no account or health data is used.
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LangProvider } from '../src/contexts/LangContext';
import Medicine from '../src/pages/Medicine';
import API from '../src/utils/api';
import { refreshReminders, clearReminderSession } from '../src/utils/reminders';
import '../src/index.css';

const day = new Intl.DateTimeFormat('en-CA').format(new Date());
const legacy = new URLSearchParams(location.search).has('legacy');
const meds = ['Morning tablet', 'Evening capsule', 'Daily supplement'].map((name, i) => ({ id: `demo-${i}`, name,
  dosage: '1 unit', type: i === 1 ? 'capsule' : 'tablet', frequency: 'once_daily', times: ['08:00'], remaining: i === 2 ? 3 : 24,
  total_pills: 30, is_active: true, purpose: 'Sample medicine for UI testing', start_date: day }));
const demo = { user_id: 'visual-test', today: day, settings: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  enabled: true, grace_minutes: 120, delivery: 'server', device_id: null, overrides: {} }, medicines: meds, rules: [],
  doses: meds.map((m, i) => ({ id: `${m.id}:${day}:08:00`, medicine_id: m.id, name: m.name, dosage: m.dosage,
    scheduled_at: new Date(Date.now() + (i - 1) * 3600000).toISOString(), date: day, time: ['08:00', '12:00', '20:00'][i],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, status: i === 2 ? 'taken' : i === 0 ? 'due' : 'upcoming', reason: '' })) };
API.isAuthenticated = () => true;
API.supportsReminders = async () => !legacy;
API.get = async path => {
  if (legacy && path.startsWith('/reminders?')) { const error = new Error('Not Found'); error.status = 404; throw error; }
  return structuredClone(path.startsWith('/reminders?') ? demo : path === '/medicines' ? meds : path === '/medicines/refill-predictions' ? meds.map(m => ({ medicine_id: m.id, medicine_name: m.name, days_left: m.remaining, remaining: m.remaining, total_pills: 30, percentage: m.remaining / 30 * 100 })) : []);
};
API.post = async (path, data) => { if (path.includes('/action')) { const d = demo.doses.find(d => path.includes(encodeURIComponent(d.id))); if (d) Object.assign(d, { status: data.status, acted_at: data.occurred_at, reason: data.reason, snoozed_until: data.status === 'snoozed' ? new Date(Date.now() + data.minutes * 60000).toISOString() : null }); } return { success: true }; };
API.put = async (path, data) => { Object.assign(demo.settings, data); return demo.settings; };
function Preview() {
  const [dark, setDark] = useState(false), [width, setWidth] = useState(412);
  useEffect(() => { clearReminderSession().then(refreshReminders); }, []);
  return <><div className="p-3 flex gap-3 items-center"><strong>UI test · synthetic data</strong><button onClick={() => setDark(!dark)}>Toggle theme</button><select aria-label="Preview width" value={width} onChange={e => setWidth(Number(e.target.value))}>{[360, 412, 1024].map(w => <option key={w}>{w}</option>)}</select></div>
    <div className={dark ? 'dark' : ''} style={{ width, maxWidth: '100%', margin: 'auto' }}><div className="bg-gray-50 dark:bg-black p-4" data-testid="medicine-preview"><LangProvider><BrowserRouter><Medicine /></BrowserRouter></LangProvider></div></div><Toaster /></>;
}
createRoot(document.getElementById('root')).render(<Preview />);
