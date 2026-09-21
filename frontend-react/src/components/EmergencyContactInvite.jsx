import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import API from '../utils/api';
import { invitationLink, whatsappInvitation } from '../utils/emergencyInvitations';
import { getWebAppOrigin } from '../utils/url';

export default function EmergencyContactInvite({ contact }) {
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const status = contact.consent_status || 'pending';
  const prepare = async () => {
    setBusy(true); setError('');
    // Open synchronously so mobile browsers do not block the WhatsApp tab.
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const origin = getWebAppOrigin();
      // Validate the website URL before creating/rotating the invitation.
      invitationLink('a'.repeat(43), origin);
      const result = await API.post(`/emergency/contacts/${contact.id}/invitation`, {});
      const link = invitationLink(result.token, origin);
      const whatsapp = whatsappInvitation(result.whatsapp_number, link);
      setInvite({ link, whatsapp });
      if (tab) tab.location.href = whatsapp;
    } catch (err) {
      tab?.close();
      setError(err.message || 'Could not create invitation.');
    } finally { setBusy(false); }
  };
  return <div className="mt-2 text-xs space-y-1">
    <p className={status === 'accepted' ? 'text-green-600 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}>
      {status === 'accepted' ? 'Accepted — app/email alerts' : status === 'revoked' ? 'Consent withdrawn' : 'Pending acceptance'}
    </p>
    {status === 'accepted' && contact.accepted_by && <p className="text-gray-500 break-all">Accepted by {contact.accepted_by}</p>}
    {status !== 'accepted' && <button disabled={busy} onClick={prepare} className="text-blue-600 dark:text-blue-400 font-semibold py-1 disabled:opacity-50">
      {busy ? 'Preparing invitation...' : 'Invite via WhatsApp'}
    </button>}
    {status !== 'accepted' && invite && <div className="space-y-1">
      <a href={invite.whatsapp} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">Open WhatsApp chat</a>
      <p>Tap Send in WhatsApp. Your contact must log in and accept. Link expires in 7 days.</p>
      <input readOnly aria-label="Invitation link (copy to share)" value={invite.link} onFocus={e => e.target.select()} className="w-full p-1 rounded border bg-transparent" />
    </div>}
    {error && <p role="alert" className="text-red-600">{error}</p>}
  </div>;
}
