import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyReminderPreview } from '../src/utils/reminderCompatibility.js';

const now = new Date(2026, 8, 6, 12, 0);
const medicine = { id: 'm', name: 'Test medicine', dosage: '1 unit', is_active: true,
  frequency: 'once_daily', times: ['08:00', '20:00'], start_date: '2026-09-01' };
test('saved medicine schedules remain visible without reminder endpoints', () => {
  const result = legacyReminderPreview([medicine], [], now);
  assert.equal(result.compatibility, true);
  assert.equal(result.medicines.length, 1);
  assert.equal(result.doses.length, 2);
  assert.equal(result.settings.enabled, false);
  assert.ok(result.doses.every(d => d.status === 'upcoming' && !d.acted_at));
});
test('uses recorded legacy status without inventing history', () => {
  const result = legacyReminderPreview([medicine], [{ medicine_id: 'm', date: '2026-09-06', scheduled_time: '08:00', status: 'taken' }], now);
  assert.deepEqual(result.doses.map(d => d.status), ['taken', 'upcoming']);
});
test('as-needed, future and expired courses do not create doses', () => {
  for (const change of [{ frequency: 'as_needed' }, { start_date: '2026-09-07' }, { end_date: '2026-09-05' }]) {
    const result = legacyReminderPreview([{ ...medicine, ...change }], [], now);
    assert.equal(result.medicines.length, 1);
    assert.equal(result.doses.length, 0);
  }
});
test('weekly schedules use the start weekday and invalid times are ignored', () => {
  assert.equal(legacyReminderPreview([{ ...medicine, frequency: 'once_weekly' }], [], now).doses.length, 0);
  assert.equal(legacyReminderPreview([{ ...medicine, times: ['99:00', '08:00', '08:00'] }], [], now).doses.length, 1);
});
