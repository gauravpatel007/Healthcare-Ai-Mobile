// Read-only schedule preview for servers that have medicines but no reminder API yet.
// Never invent recorded doses or silently send new actions to the legacy log endpoint.
export function legacyReminderPreview(medicines, logs = [], now = new Date()) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const day = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const active = medicines.filter(m => m.is_active !== false);
  const doses = active.flatMap(m => {
    if (m.frequency === 'as_needed' || (m.start_date && m.start_date > day) || (m.end_date && m.end_date < day)) return [];
    if (m.frequency === 'once_weekly') {
      const start = (m.start_date || m.created_at?.slice(0, 10));
      if (!start || Math.round((Date.parse(day) - Date.parse(start)) / 86400000) % 7 !== 0) return [];
    }
    return [...new Set(m.times || [])].filter(time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)).map(time => {
      const log = logs.find(l => l.medicine_id === m.id && l.date === day && l.scheduled_time === time);
      return { id: `${m.id}:${day}:${time}`, medicine_id: m.id, name: m.name, dosage: m.dosage,
        scheduled_at: new Date(`${day}T${time}:00`).toISOString(), date: day, time, timezone,
        status: log?.status || 'upcoming', reason: '', acted_at: log?.updated_at || null };
    });
  });
  return { compatibility: true, user_id: null, today: day, medicines: active, doses, rules: [],
    settings: { timezone, enabled: false, grace_minutes: 120, delivery: 'server', device_id: null, overrides: {} } };
}
