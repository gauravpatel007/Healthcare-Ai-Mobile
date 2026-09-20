import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import API from '../utils/api';
import LoginModal from '../components/LoginModal';
import { sosLocationLink } from '../utils/emergencyInvitations';

export default function EmergencyInvitation() {
  const location = useLocation();
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  const [preview, setPreview] = useState(null);
  const [account, setAccount] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [login, setLogin] = useState(false);
  const [agree, setAgree] = useState(false);
  const [email, setEmail] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setPreview(null);
    setAccepted(false);
    setAgree(false);
    setEmail(false);
    const load = async () => {
      try {
        if (token) {
          const info = await API.post('/emergency/invitations/preview', { token });
          if (active) setPreview(info);
        }
        if (API.isAuthenticated()) {
          // Avoid the global logout redirect here so an expired session keeps the invitation.
          const me = await API.request('/auth/me', { _retry: true });
          if (active) setAccount(me.data || me);
          if (!token) {
            const [acceptedContacts, received] = await Promise.all([
              API.get('/emergency/accepted-contacts'), API.get('/emergency/received-alerts'),
            ]);
            if (active) { setContacts(acceptedContacts); setAlerts(received); }
          }
        }
      } catch (err) {
        if (active) {
          if (err.status === 401) { setAccount(null); setLogin(true); }
          else setError(err.message || 'Unable to load this invitation.');
        }
      } finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (token || !account) return;
    let active = true;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const [acceptedContacts, received] = await Promise.all([
          API.get('/emergency/accepted-contacts'), API.get('/emergency/received-alerts'),
        ]);
        if (active) { setContacts(acceptedContacts); setAlerts(received); }
      } catch { /* Keep existing alerts visible during a temporary network failure. */ }
    };
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [token, account]);

  const accept = async () => {
    setBusy(true); setError('');
    try {
      await API.request('/emergency/invitations/accept', {
        method: 'POST', body: { token, consent: agree, email_opt_in: email }, _retry: true,
      });
      setAccepted(true);
    } catch (err) {
      if (err.status === 401) { setAccount(null); setLogin(true); }
      setError(err.message || 'Could not accept. Please try again.');
    } finally { setBusy(false); }
  };
  const revoke = async contact => {
    setBusy(true); setError('');
    try {
      await API.post(`/emergency/accepted-contacts/${contact.contact_id}/revoke`, {});
      setContacts(current => current.filter(item => item.contact_id !== contact.contact_id));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const button = 'px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50';
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-6">
      <div className="max-w-xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold">{token ? 'Emergency contact invitation' : 'SOS alerts & consent'}</h1>
        {loading && <p role="status">Loading...</p>}
        {error && <p role="alert" className="text-red-600">{error}</p>}
        {!loading && !accepted && token && preview && (
          <section className="p-5 rounded-2xl bg-white dark:bg-gray-800 space-y-4">
            <p><strong>{preview.sender_name}</strong> invited you to receive their emergency SOS alerts and shared location.</p>
            <p className="text-sm">This is consent for app/email alerts. It does not verify a phone number or enable automated calls or SMS. Only accept if you know the sender. You can stop alerts later.</p>
            <p className="text-sm">Expires: {new Date(preview.expires_at).toLocaleString()}</p>
            {preview.email_required && <p className="text-sm">Sign in using the email address the sender entered for you.</p>}
            {account ? <>
              <p className="text-sm">Signed in as <strong>{account.email}</strong></p>
              <label className="flex items-start gap-3"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-1" /> I agree to receive this person's SOS alerts in my LifeOS app.</label>
              <label className="flex items-start gap-3"><input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} className="mt-1" /> Also send alerts to my verified login email.</label>
              <button disabled={!agree || busy} onClick={accept} className={button}>{busy ? 'Accepting...' : 'Accept invitation'}</button>
              <button onClick={() => setLogin(true)} className="block text-sm text-blue-600">Use another account</button>
            </> : <button onClick={() => setLogin(true)} className={button}>Log in / Create account to accept</button>}
          </section>
        )}
        {accepted && <section role="status" className="p-5 rounded-2xl bg-white dark:bg-gray-800 space-y-3">
          <p>Accepted. SOS alerts will appear in your LifeOS inbox.{email ? ' Email alerts are also enabled.' : ''}</p>
          <p className="text-sm">Email delivery depends on the sender's server email setup. Phone notifications also require device permission and push service setup.</p>
          <Link className="text-blue-600" to="/emergency-invitation">Manage consent & view SOS alerts</Link>
        </section>}
        {!loading && !token && !account && <button onClick={() => setLogin(true)} className={button}>Log in to view alerts</button>}
        {!loading && !token && account && <>
          <section className="p-5 rounded-2xl bg-white dark:bg-gray-800 space-y-3">
            <h2 className="text-lg font-bold">People you receive SOS alerts from</h2>
            {!contacts.length && <p>No accepted invitations.</p>}
            {contacts.map(contact => <div key={contact.contact_id} className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <p>{contact.sender_name} — App{contact.email_enabled ? ' + email' : ''}</p>
              <button disabled={busy} onClick={() => revoke(contact)} className="text-red-600 py-2">Stop receiving alerts</button>
            </div>)}
          </section>
          <section className="p-5 rounded-2xl bg-white dark:bg-gray-800 space-y-3">
            <h2 className="text-lg font-bold">Recent SOS alerts</h2>
            {!alerts.length && <p>No SOS alerts received.</p>}
            {alerts.map(alert => <article key={alert.id} className="border-t border-gray-200 dark:border-gray-700 pt-3 break-words">
              <p className="text-sm text-gray-500">{new Date(alert.created_at).toLocaleString()}</p>
              <p>{alert.message}</p>
              {sosLocationLink(alert.message) && <a className="text-blue-600 inline-block py-2" href={sosLocationLink(alert.message)} target="_blank" rel="noopener noreferrer">Open shared location</a>}
            </article>)}
          </section>
        </>}
        <Link className="inline-block text-blue-600" to={API.isAuthenticated() ? '/app/emergency' : '/'}>Back to LifeOS</Link>
      </div>
      <LoginModal show={login} onClose={() => setLogin(false)} returnTo={`/emergency-invitation${token ? `#token=${token}` : ''}`} />
    </main>
  );
}
