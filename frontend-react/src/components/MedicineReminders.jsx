import React, { useState } from 'react';
import { Bell, BellRing, Check, Clock, History, PackagePlus, RefreshCw, Settings2, SkipForward, WifiOff, AlertCircle, Globe } from 'lucide-react';
import { toast } from 'react-hot-toast';
import API from '../utils/api';
import { useLang } from '../contexts/LangContext';
import { useReminders, recordDose, refreshReminders, saveReminderSettings, enableReminderNotifications,
  nativeReminders, openAlarmSettings, openNotificationSettings, testReminderNotification, localZone, discardAction, deviceId, retryReminderBackend } from '../utils/reminders';

import { MedicineDoseCard, MedicineActionDialog, cardClasses as card, buttonClasses as button, inputClasses as input, colors, names } from './MedicineShared';
import CustomSelect from './ui/CustomSelect';

export default function MedicineReminders() {
  const { t } = useLang();
  const { data, error, loading, offline, pending, rejected, permission } = useReminders();
  const [view, setView] = useState('today');
  const [filter, setFilter] = useState('all');
  const [medicine, setMedicine] = useState('all');
  const [day, setDay] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState('');
  const [quantity, setQuantity] = useState(30);
  const [zone, setZone] = useState('');
  const [dismissZone, setDismissZone] = useState(false);
  const run = async fn => { if (busy) return; setBusy(true); try { await fn(); } catch (e) { toast.error(e.message); } finally { setBusy(false); } };
  if (!data) return <div className={card}>{loading ? t('Loading reminders…') : t('Your reminders could not be loaded.')}
    {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
    <button className={`${button} mt-4 bg-blue-600 text-white`} onClick={refreshReminders}>{t('Try again')}</button></div>;
  const s = data.settings;
  const readOnly = Boolean(data.compatibility);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: s.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const now = Date.now();
  const doses = data.doses.map(d => {
    if (!['upcoming', 'due', 'pending', 'snoozed', 'missed'].includes(d.status)) return d;
    const due = new Date(d.snoozed_until || d.scheduled_at).getTime();
    return { ...d, status: now > due + s.grace_minutes * 60000 ? 'missed' : due <= now ? 'due' : d.snoozed_until ? 'snoozed' : 'upcoming' };
  });
  const todayDoses = doses.filter(d => d.date === today);
  const shown = doses.filter(d => (view === 'today' ? d.date === today : d.date <= today)
    && (filter === 'all' || d.status === filter) && (medicine === 'all' || d.medicine_id === medicine)
    && (!day || d.date === day)).sort((a, b) => view === 'today' ? a.scheduled_at.localeCompare(b.scheduled_at) : b.scheduled_at.localeCompare(a.scheduled_at));
  const tracked = data.medicines.filter(m => m.is_active && ['tablet', 'capsule'].includes(m.type));
  const isThisDevice = s.delivery === 'device' && s.device_id === deviceId();
  const action = (d, status, opts) => run(async () => { await recordDose(d, status, opts); setDialog(null); });
  return <div className="space-y-5 text-gray-900 dark:text-gray-100 [&_h2]:text-gray-900 [&_h3]:text-gray-900 dark:[&_h2]:text-gray-100 dark:[&_h3]:text-gray-100">
    {readOnly && <div className="rounded-2xl p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm space-y-2">
      <p className="font-semibold">{t('Your saved medicine schedule')}</p>
      <p>{t('Reminder syncing is awaiting a server update. Your medicines are shown below; dose actions and notification setup will be available when the update is live.')}</p>
      <button className={`${button} bg-white/70 dark:bg-black/20`} onClick={retryReminderBackend}>{t('Check for update')}</button>
    </div>}
    {(offline || pending > 0) && <div className="rounded-2xl p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm flex gap-3"><WifiOff className="w-5 h-5 shrink-0" />
      <div>{offline ? t('Offline — showing your saved schedule.') : t('Actions waiting to sync')}{pending > 0 && ` · ${pending}`}
        <p className="mt-1">{t('Saved dose actions sync when you reconnect.')}</p></div></div>}
    {!offline && error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    {rejected.map(a => <div key={a.action_id} role="alert" className={`${card} text-sm`}><p>{a.name}: {a.error}</p>
      <button className={button} onClick={() => run(() => discardAction(a.action_id))}>{t('Discard unsynced change')}</button></div>)}
    {!dismissZone && s.timezone !== localZone() && <div className="rounded-2xl p-4 bg-blue-50 dark:bg-blue-900/20 text-sm space-y-3">
      <p><Globe className="w-4 h-4 inline mr-2" />{t('Your phone timezone has changed.')} {t('Schedule remains in')} <strong>{s.timezone}</strong>.</p>
      <div className="flex flex-wrap gap-2"><button disabled={busy} className={`${button} bg-blue-600 text-white`} onClick={() => run(() => saveReminderSettings({ timezone: localZone() }))}>{t('Use phone timezone')}</button>
        <button className={button} onClick={() => setDismissZone(true)}>{t('Keep schedule timezone')}</button></div></div>}
    <div className={card}>
      <div className="flex gap-3 items-start justify-between"><div className="flex gap-3"><div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center"><BellRing size={22} /></div>
        <div><h2 className="font-bold text-lg">{t('Your medicine routine')}</h2><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.timezone} · {t('One dose at a time')}</p></div></div>
        <button disabled={readOnly} title={t('Reminder settings')} aria-label={t('Reminder settings')} className="p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40" onClick={() => { setZone(s.timezone); setShowSettings(!showSettings); }}><Settings2 size={20} /></button></div>
      <div className="grid grid-cols-3 gap-2 mt-5">{[['Scheduled', todayDoses.length], ['Taken', todayDoses.filter(d => d.status === 'taken').length], ['Remaining', todayDoses.filter(d => !['taken', 'skipped'].includes(d.status)).length]].map(([label, count]) =>
        <div key={label} className="rounded-2xl bg-gray-50 dark:bg-gray-900/50 p-3"><p className="text-2xl font-bold">{count}</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t(label)}</p></div>)}</div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400"><span className={`w-2 h-2 rounded-full ${s.enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
        {t(readOnly ? 'Schedule preview · notification setup pending' : !s.enabled ? 'Notifications paused' : isThisDevice ? 'Scheduled on this Android device' : s.delivery === 'device' ? 'Reminders assigned to another device' : 'Server reminders — enable notifications to register this browser')}
      </div>
      {nativeReminders && permission && (!permission.notifications || !permission.exact) && <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">{t(!permission.notifications ? 'Android notifications are blocked.' : 'Precise alarm access is off. Reminders may be delayed.')}</p>}
      {showSettings && <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700 space-y-4">
        <div className="flex flex-wrap gap-2"><button disabled={busy} className={`${button} bg-blue-600 text-white`} onClick={() => run(enableReminderNotifications)}><Bell size={16} />{t('Enable notifications')}</button>
          <button disabled={busy} className={`${button} bg-gray-100 dark:bg-gray-700`} onClick={() => run(async () => { await testReminderNotification(); toast.success(t('Test notification requested')); })}>{t('Test notification')}</button>
          <button disabled={busy} className={button} onClick={() => run(() => saveReminderSettings({ enabled: !s.enabled }))}>{t(s.enabled ? 'Pause notifications' : 'Resume notifications')}</button></div>
        {nativeReminders && <div className="flex flex-wrap gap-2"><button className={`${button} bg-purple-50 dark:bg-purple-900/30 text-purple-600`} onClick={() => run(openAlarmSettings)}>{t('Allow precise alarms')}</button>
          <button className={button} onClick={() => run(openNotificationSettings)}>{t('Android app settings')}</button></div>}
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('Android force-stop or disabled permissions can stop reminders. Reopen LifeOS after changing device settings.')}</p>
        <label className="block text-sm font-semibold">{t('Schedule timezone')}<div className="flex gap-2 mt-2"><input aria-label={t('Schedule timezone')} className={input} value={zone} onChange={e => setZone(e.target.value)} placeholder="Asia/Kolkata" />
          <button disabled={busy} className={`${button} bg-blue-600 text-white`} onClick={() => run(() => saveReminderSettings({ timezone: zone }))}>{t('Save')}</button></div></label>
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold">{t('Mark unrecorded after')}</label>
          <CustomSelect
            value={s.grace_minutes}
            onChange={e => run(() => saveReminderSettings({ grace_minutes: Number(e.target.value) }))}
            options={[30, 60, 120, 240, 1440].map(n => ({
              value: n,
              label: n < 60 ? `${n} min` : `${n / 60} h`
            }))}
            className="!bg-gray-50 dark:!bg-gray-900 border border-gray-200 dark:border-gray-700 !font-normal !py-2.5 !shadow-none !text-gray-900 dark:!text-white min-h-[44px]"
            containerClassName="w-full mt-2"
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('This is a logging window, not advice about taking a late dose.')}</p>
      </div>}
    </div>
    <details className={card} open={readOnly || todayDoses.length === 0}>
      <summary className="font-bold cursor-pointer">{t('Saved medicine schedules')} · {data.medicines.filter(m => m.is_active !== false).length}</summary>
      <div className="mt-3 divide-y divide-gray-100 dark:divide-gray-700">{data.medicines.filter(m => m.is_active !== false).map(m => <div key={m.id} className="py-3">
        <p className="font-semibold">{m.name} <span className="text-xs font-normal text-gray-500">· {m.dosage}</span></p>
        <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">{m.frequency === 'as_needed' ? t('As needed — no recurring reminder') : m.times?.length ? m.times.join(' · ') : t('Add a time in Medicines to schedule reminders')}</p>
        <p className="text-xs text-gray-500 mt-1">{t(m.frequency?.replaceAll('_', ' ') || 'Daily')}{m.start_date && ` · ${t('Starts')} ${m.start_date}`}{m.end_date && ` · ${t('Ends')} ${m.end_date}`}</p>
      </div>)}</div>
    </details>
    <div className="flex items-center justify-between gap-2"><div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
      {[['today', Clock, 'Today'], ['history', History, 'History']].map(([id, Icon, label]) => <button key={id} className={`${button} ${view === id ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500'}`} onClick={() => { setView(id); setDay(''); }}><Icon size={16} />{t(label)}</button>)}</div>
      <button aria-label={t('Refresh reminders')} title={t('Refresh reminders')} className="p-3 rounded-xl text-blue-600" onClick={refreshReminders}><RefreshCw size={18} /></button></div>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <CustomSelect
        value={filter}
        onChange={e => setFilter(e.target.value)}
        options={[
          { value: 'all', label: t('All statuses') },
          ...Object.entries(names).filter(([id]) => id !== 'pending').map(([id, label]) => ({
            value: id,
            label: t(label)
          }))
        ]}
        className="!bg-gray-50 dark:!bg-gray-900 border border-gray-200 dark:border-gray-700 !font-normal !py-2.5 !shadow-none !text-gray-900 dark:!text-white min-h-[44px]"
        containerClassName="w-full"
      />
      <CustomSelect
        value={medicine}
        onChange={e => setMedicine(e.target.value)}
        options={[
          { value: 'all', label: t('All medicines') },
          ...Array.from(new Map(doses.map(d => [d.medicine_id, d.name]))).map(([id, name]) => ({
            value: id,
            label: name
          }))
        ]}
        className="!bg-gray-50 dark:!bg-gray-900 border border-gray-200 dark:border-gray-700 !font-normal !py-2.5 !shadow-none !text-gray-900 dark:!text-white min-h-[44px]"
        containerClassName="w-full"
      />
      {view === 'history' && <input aria-label={t('Filter by date')} className={`${input} col-span-2 sm:col-span-1`} type="date" value={day} max={today} onChange={e => setDay(e.target.value)} />}
    </div>
    <div className="space-y-3">{shown.length === 0 ? <div className={`${card} text-center py-10`}><Clock className="mx-auto text-purple-400 mb-3" size={30} /><h3 className="font-bold">{t('No doses to show')}</h3><p className="text-sm text-gray-500 mt-2">{t('Add medicine times in Medicines, or adjust your filters.')}</p></div> : shown.map(d =>
      <MedicineDoseCard key={d.id} d={d} view={view} busy={busy} readOnly={readOnly} s={s} action={action} setDialog={setDialog} setReason={setReason} />)}
    </div>
    <fieldset disabled={readOnly || busy} className={card}><h3 className="font-bold text-lg flex items-center gap-2"><PackagePlus className="text-blue-500" size={21} />{t('Refill reminders')}</h3><p className="text-xs text-gray-500 mt-2">{t('Stock tracking applies to tablets and capsules. Confirm units per dose below.')}</p>
      {tracked.length === 0 && <p className="text-sm text-gray-500 mt-4">{t('No tablet or capsule stock to track yet.')}</p>}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">{tracked.map(m => { const opts = { threshold: 5, units_per_dose: 1, refill_enabled: true, ...s.overrides[m.id] };
        const save = patch => run(() => saveReminderSettings({ overrides: { ...s.overrides, [m.id]: { ...opts, ...patch } } }));
        return <div key={m.id} className="py-4 space-y-3"><div className="flex justify-between items-center gap-2"><div><p className="font-semibold">{m.name}</p><p className={`text-xs mt-1 ${m.remaining <= opts.threshold ? 'text-rose-500' : 'text-gray-500'}`}>{m.remaining} {t('units remaining')}</p></div><button disabled={busy} className={`${button} bg-blue-50 text-blue-600 dark:bg-blue-900/30`} onClick={() => { setQuantity(30); setDialog({ type: 'refill', medicine: m }); }}>{t('Refill')}</button></div>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs text-gray-500">{t('Alert at units')}<input key={`t-${opts.threshold}`} className={`${input} mt-1`} type="number" min="0" max="10000" defaultValue={opts.threshold} onBlur={e => { if (e.target.value !== '' && Number(e.target.value) !== opts.threshold) save({ threshold: Number(e.target.value) }); }} /></label>
            <label className="text-xs text-gray-500">{t('Units per dose')}<input key={`u-${opts.units_per_dose}`} className={`${input} mt-1`} type="number" min="1" max="100" defaultValue={opts.units_per_dose} onBlur={e => { if (e.target.value !== '' && Number(e.target.value) !== opts.units_per_dose) save({ units_per_dose: Number(e.target.value) }); }} /></label></div>
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={opts.refill_enabled} onChange={e => save({ refill_enabled: e.target.checked })} />{t('Low-stock alerts')}</label></div>; })}</div>
    </fieldset>
    <MedicineActionDialog dialog={dialog} busy={busy} reason={reason} setReason={setReason} quantity={quantity} setQuantity={setQuantity} action={action} setDialog={setDialog} run={run} />
  </div>;
}
