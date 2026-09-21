import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Copy, ExternalLink, MessageCircle, RefreshCw, Send } from 'lucide-react';
import API from '../utils/api';
import { copyToClipboard } from '../utils/clipboard';
import { telegramWhatsappInvitation } from '../utils/emergencyInvitations';

const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50';

export default function EmergencyTelegramVerification({ contact }) {
  const [link, setLink] = useState(contact.verification_url || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const status = contact.verification_status || 'pending';
  const verified = status === 'verified';

  useEffect(() => {
    setLink(contact.verification_url || null);
    setError(''); setNotice('');
  }, [contact.id, contact.phone, status]);

  const prepare = async (destination = null) => {
    setBusy(true); setError(''); setNotice('');
    const tab = destination ? window.open('about:blank', '_blank') : null;
    if (tab) tab.opener = null;
    try {
      const result = await API.post(`/emergency/contacts/${contact.id}/telegram-verification`, {});
      setLink(result.verification_url);
      if (tab) tab.location.href = destination === 'whatsapp'
        ? telegramWhatsappInvitation(contact.phone, result.verification_url) : result.verification_url;
      setNotice(destination ? 'Link ready. If no app opened, use the buttons below.' : 'New link ready. Share it with your contact; the previous link no longer works.');
    } catch (err) {
      tab?.close();
      setError(err.message || 'Could not prepare Telegram verification.');
    } finally { setBusy(false); }
  };

  const copy = async () => {
    try { await copyToClipboard(link); setNotice('Link copied. Send it to your emergency contact.'); }
    catch { setError('Copy failed. Select and copy the link below.'); }
  };

  return <section aria-label="Telegram phone verification" className="rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h5 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"><Send size={16} className="text-blue-600" />1. Phone verification</h5>
      <span role="status" className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${verified ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'}`}>
        {verified ? <CheckCircle2 size={13} /> : <Clock size={13} />}
        {verified ? 'Verified via Telegram' : status === 'pending' ? 'Verification Pending' : 'Not Verified'}
      </span>
    </div>
    {verified ? <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">This contact's phone number is verified.</p> : <>
      <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">Send the link to <strong>{contact.name}</strong>. They open it in Telegram, tap <strong>Confirm</strong>, then <strong>Share My Phone Number</strong>. A different phone number cannot verify this contact.</p>
      <div className="flex flex-wrap gap-2">
        {link ? <a href={telegramWhatsappInvitation(contact.phone, link)} target="_blank" rel="noopener noreferrer" className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}><MessageCircle size={14} />Share via WhatsApp</a>
          : <button disabled={busy} onClick={() => prepare('whatsapp')} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}><MessageCircle size={14} />Share via WhatsApp</button>}
        {link ? <a href={link} target="_blank" rel="noopener noreferrer" className={`${buttonClass} bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-blue-700 dark:text-blue-300`}><ExternalLink size={14} />Verify via Telegram</a>
          : <button disabled={busy} onClick={() => prepare('telegram')} className={`${buttonClass} bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-blue-700 dark:text-blue-300`}><ExternalLink size={14} />Verify via Telegram</button>}
        {link && <button onClick={copy} className={`${buttonClass} text-gray-600 dark:text-gray-300`}><Copy size={14} />Copy Link</button>}
        <button disabled={busy} onClick={() => prepare()} className={`${buttonClass} text-gray-600 dark:text-gray-300`}><RefreshCw size={14} className={busy ? 'animate-spin' : ''} />{busy ? 'Preparing…' : 'Resend Verification'}</button>
      </div>
      <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">Opening Telegram here uses your signed-in account. To verify someone else, share the link with them. Link expires in 24 hours.</p>
      {link && <details className="text-xs text-gray-500 dark:text-gray-400"><summary className="cursor-pointer">View verification link</summary><input aria-label="Verification link" readOnly value={link} onFocus={event => event.target.select()} className="mt-2 w-full p-2 rounded-lg border bg-white dark:bg-gray-900" /></details>}
    </>}
    {notice && !verified && <p role="status" className="text-xs text-blue-700 dark:text-blue-300">{notice}</p>}
    {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
  </section>;
}
