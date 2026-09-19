import React, { useState, useEffect, useRef } from 'react';
import { Bell, Trash2 } from 'lucide-react';
import API from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { reminderApiAvailable } from '../utils/reminders';
import { toast } from 'react-hot-toast';

const UserNotificationsDropdown = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [clearing, setClearing] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Poll every minute
    window.addEventListener('medicine-reminders-updated', fetchNotifications);
    return () => { clearInterval(interval); window.removeEventListener('medicine-reminders-updated', fetchNotifications); };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      const results = await Promise.allSettled([API.getUserNotifications(),
      reminderApiAvailable() ? API.get('/reminders/notifications') : Promise.resolve([])]);
      const data = results.flatMap(r => r.status === 'fulfilled' ? (r.value || []) : [])
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      if (data) {
        const readIds = JSON.parse(localStorage.getItem('read_notifications') || '[]');
        const unreadData = data.filter(n => n.href ? !n.read : !readIds.includes(n.id));
        setNotifications(unreadData);
        setUnreadCount(unreadData.length);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const clearAllNotifications = async (e) => {
    e.stopPropagation();
    if (clearing || notifications.length === 0) return;
    setClearing(true);

    try {
      if (reminderApiAvailable()) {
        await Promise.allSettled([
          API.post('/reminders/notifications/read-all', {}),
          API.delete('/reminders/notifications')
        ]);
      }
    } catch (err) {
      console.error('Failed to clear reminder notifications on server:', err);
    }

    // Mark all notifications as read in localStorage
    const readIds = JSON.parse(localStorage.getItem('read_notifications') || '[]');
    const allIds = notifications.map(n => n.id);
    const updated = Array.from(new Set([...readIds, ...allIds]));
    localStorage.setItem('read_notifications', JSON.stringify(updated));

    setNotifications([]);
    setUnreadCount(0);
    setClearing(false);
    toast.success('All notifications cleared');
  };

  const markAsRead = async (notif) => {
    const id = notif.id;
    if (notif.href) {
      try { await API.post(`/reminders/notifications/${encodeURIComponent(id)}/read`, {}); }
      catch { return; }
      navigate(notif.href);
      setIsOpen(false);
    }
    setNotifications(prev => prev.filter(n => n.id !== id));
    setUnreadCount(prev => prev - 1);

    const readIds = JSON.parse(localStorage.getItem('read_notifications') || '[]');
    if (!readIds.includes(id)) {
      readIds.push(id);
      localStorage.setItem('read_notifications', JSON.stringify(readIds));
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '40px', height: '40px', borderRadius: '50%', border: 'none',
          background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative', transition: 'background 0.2s', color: 'var(--text-primary)'
        }}
        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'}
        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Bell size={20} strokeWidth={2} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '8px', right: '8px', width: '8px', height: '8px',
            background: 'var(--danger)', borderRadius: '50%'
          }}></span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 12px)', right: 0, width: '280px',
          background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-color)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)', overflow: 'hidden', zIndex: 100, animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllNotifications}
                  disabled={clearing}
                  title="Clear all notifications"
                  aria-label="Clear all notifications"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    cursor: clearing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    opacity: clearing ? 0.6 : 1,
                    transition: 'all 0.2s',
                    gap: '4px'
                  }}
                  onMouseOver={(e) => {
                    if (!clearing) {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)';
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  }}
                >
                  {clearing ? 'Clearing...' : 'Clear'}
                </button>
              )}
              {unreadCount > 0 && (
                <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.75rem' }}>
                  {unreadCount} New
                </span>
              )}
            </div>
          </div>

          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>📭</span>
                You're all caught up!
              </div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') markAsRead(notif); }} onClick={() => markAsRead(notif)} style={{
                  padding: '16px', borderBottom: '1px solid var(--border-light)',
                  background: 'var(--bg-secondary)', cursor: 'pointer', transition: 'background 0.2s'
                }} onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-body)'} onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{notif.title}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(notif.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {notif.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserNotificationsDropdown;
