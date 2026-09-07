import React from 'react';
import { Check, Clock, SkipForward } from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import API from '../utils/api';
import { refreshReminders } from '../utils/reminders';

export const cardClasses = 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[2rem] p-5 sm:p-6 shadow-sm';
export const buttonClasses = 'min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50';
export const inputClasses = 'w-full min-h-[44px] px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm';

export const colors = {
  taken: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  skipped: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  snoozed: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  missed: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  due: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  upcoming: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
};

export const names = { taken: 'Taken', skipped: 'Skipped', snoozed: 'Snoozed', missed: 'Not recorded', due: 'Due now', upcoming: 'Upcoming', pending: 'Upcoming' };

export function MedicineDoseCard({ d, view, busy, readOnly, s, action, setDialog, setReason }) {
  const { t } = useLang();
  return (
    <div className={cardClasses}>
      <div className="flex justify-between gap-3 items-start">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">{d.time}{view === 'history' && ` · ${d.date}`}</p>
          <h3 className="font-bold text-lg break-words">{d.name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{d.dosage}</p>
        </div>
        <span className={`shrink-0 text-[11px] font-bold rounded-lg px-2.5 py-1.5 ${colors[d.status] || colors.upcoming}`}>{t(names[d.status] || d.status)}</span>
      </div>
      {d.reason && <p className="text-xs text-gray-500 mt-3">{d.reason}</p>}
      {d.acted_at && <p className="text-xs text-gray-500 mt-2">{t('Recorded at')} {new Date(d.acted_at).toLocaleString([], { timeZone: s?.timezone })}</p>}
      {d.status === 'snoozed' && <p className="text-xs text-purple-600 mt-2">{t('Remind again at')} {new Date(d.snoozed_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: s?.timezone })}</p>}
      {['taken', 'skipped'].includes(d.status) ? (
        <button disabled={busy || readOnly} className={`${buttonClasses} mt-3 text-gray-500`} onClick={() => action(d, 'pending')}>{t('Undo / correct')}</button>
      ) : (
        <div className="grid grid-cols-3 gap-2 mt-4">
          <button disabled={busy || readOnly} className={`${buttonClasses} px-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300`} onClick={() => action(d, 'taken')}><Check size={16} />{t('Taken')}</button>
          <button disabled={busy || readOnly} className={`${buttonClasses} px-2 bg-gray-100 dark:bg-gray-700`} onClick={() => { setReason(''); setDialog({ type: 'skip', dose: d }); }}><SkipForward size={15} />{t('Skip')}</button>
          <button disabled={busy || readOnly || d.status === 'upcoming'} className={`${buttonClasses} px-2 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300`} onClick={() => setDialog({ type: 'snooze', dose: d })}><Clock size={15} />{t('Snooze')}</button>
        </div>
      )}
    </div>
  );
}

export function MedicineActionDialog({ dialog, busy, reason, setReason, quantity, setQuantity, action, setDialog, run }) {
  const { t } = useLang();
  
  if (!dialog) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={e => { if (e.target === e.currentTarget && !busy) setDialog(null); }}>
      <div role="dialog" aria-modal="true" aria-label={t(dialog.type === 'refill' ? 'Record refill' : dialog.type === 'skip' ? 'Skip dose' : 'Snooze reminder')} className={`${cardClasses} w-full max-w-md mb-3 space-y-4`}>
        <h3 className="text-lg font-bold">{t(dialog.type === 'refill' ? 'Record refill' : dialog.type === 'skip' ? 'Skip dose' : 'Snooze reminder')}</h3>
        <p className="text-sm text-gray-500">{dialog.dose?.name || dialog.medicine?.name}</p>
        
        {dialog.type === 'snooze' ? (
          <div className="grid grid-cols-3 gap-2">
            {[10, 15, 30].map(minutes => (
              <button key={minutes} disabled={busy} className={`${buttonClasses} bg-purple-50 text-purple-600 dark:bg-purple-900/30`} onClick={() => action(dialog.dose, 'snoozed', { minutes })}>
                {minutes} {t('min')}
              </button>
            ))}
          </div>
        ) : (
          <>
            {dialog.type === 'skip' ? (
              <input autoFocus className={inputClasses} aria-label={t('Reason (optional)')} placeholder={t('Reason (optional)')} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />
            ) : (
              <label className="text-sm">{t('Units added')}
                <input autoFocus className={`${inputClasses} mt-2`} type="number" min="1" max="10000" value={quantity} onChange={e => setQuantity(e.target.value)} />
              </label>
            )}
            <button disabled={busy} className={`${buttonClasses} bg-blue-600 text-white w-full`} onClick={() => dialog.type === 'skip' ? action(dialog.dose, 'skipped', { reason }) : run(async () => {
              if (!dialog.action_id) dialog.action_id = crypto.randomUUID();
              await API.post(`/reminders/medicines/${dialog.medicine.id}/refill`, { action_id: dialog.action_id, quantity: Number(quantity) }); 
              await refreshReminders(); 
              setDialog(null);
            })}>{t('Save')}</button>
          </>
        )}
        <button disabled={busy} className={`${buttonClasses} w-full text-gray-500`} onClick={() => setDialog(null)}>{t('Cancel')}</button>
      </div>
    </div>
  );
}
