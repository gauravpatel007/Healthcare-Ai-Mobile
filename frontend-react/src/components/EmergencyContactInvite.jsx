import React, { useState } from 'react';
import { CheckCircle2, Copy, Mail, MessageCircle } from 'lucide-react';
import API from '../utils/api';
import { invitationLink, whatsappInvitation, emergencyInvitationOrigin } from '../utils/emergencyInvitations';
import { copyToClipboard } from '../utils/clipboard';

export default function EmergencyContactInvite({ contact }) {
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const status = contact.consent_status || 'pending';
  const accepted = status === 'accepted';
  const prepare = async () => {
    setBusy(true); setError(''); setNotice('');
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const origin = emergencyInvitationOrigin(import.meta.env.VITE_PUBLIC_WEB_URL, window.location.origin);
      invitationLink('a'.repeat(43), origin);
      const result = await API.post(`/emergency/contacts/${contact.id}/invitation`, {});
      const link = invitationLink(result.token, origin);
      const whatsapp = whatsappInvitation(result.whatsapp_number, link);
      setInvite({ link, whatsapp });
      if (tab) tab.location.href = whatsapp;
      else setNotice('Invitation ready. Tap Open WhatsApp below, then Send.');
    } catch (err) {
      tab?.close();
      setError(err.message || 'Could not create invitation.');
    } finally { setBusy(false); }
  };
  const copy = async () => {
    try { await copyToClipboard(invite.link); setNotice('Invitation copied. Send it to your contact.'); }
    catch { setError('Copy failed. Select and copy the invitation below.'); }
  };
  return <section aria-label="SOS app and email consent" className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h5 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"><Mail size={16} className="text-gray-500" />2. App & email alerts</h5>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${accepted ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
        {accepted && <CheckCircle2 size={13} />}{accepted ? 'Accepted' : status === 'revoked' ? 'Consent withdrawn' : 'Acceptance needed'}
      </span>
    </div>
    {accepted ? <p className="text-xs text-gray-500 break-all">{contact.accepted_by ? `Accepted by ${contact.accepted_by}` : 'Your contact accepted the app invitation.'}</p> : <>
      <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">To receive alerts inside LifeOS and optional email, your contact must also sign in and accept an app invitation.</p>
      <div className="flex flex-wrap gap-2">
        {invite ? <a href={invite.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400"><MessageCircle size={14} />Open WhatsApp invitation</a>
          : <button disabled={busy} onClick={prepare} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 disabled:opacity-50"><MessageCircle size={14} />{busy ? 'Preparing…' : 'Share app invitation'}</button>}
        {invite && <button onClick={copy} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300"><Copy size={14} />Copy invitation</button>}
      </div>
      {invite && <details className="text-xs text-gray-500 dark:text-gray-400"><summary className="cursor-pointer">View invitation link</summary><p className="mt-2">Tap Send in WhatsApp. Your contact then signs in to LifeOS and accepts. Expires in 7 days.</p><input readOnly aria-label="Invitation link" value={invite.link} onFocus={e => e.target.select()} className="mt-2 w-full p-2 rounded-lg border bg-transparent" /></details>}
    </>}
    {notice && <p role="status" className="text-xs text-blue-600">{notice}</p>}
    {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
  </section>;
}
