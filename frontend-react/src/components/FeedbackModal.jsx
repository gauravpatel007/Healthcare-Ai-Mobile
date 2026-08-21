import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import CustomSelect from './ui/CustomSelect';

const FeedbackModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'history'
  const [type, setType] = useState('Suggestion');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'history') {
      fetchHistory();
    }
  }, [isOpen, activeTab]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await API.getUserFeedback();
      setHistory(data || []);
    } catch (err) {
      console.error(err);
    }
    setLoadingHistory(false);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setStatus('loading');
    try {
      await API.submitFeedback({ type, message });
      setStatus('success');
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
        setType('Suggestion');
        onClose();
      }, 2000);
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: '24px', padding: '32px',
        width: '100%', maxWidth: '450px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Feedback</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '12px' }}>
          <button 
            onClick={() => setActiveTab('new')}
            style={{ flex: 1, padding: '8px 0', border: 'none', background: activeTab === 'new' ? 'var(--bg-card)' : 'transparent', color: activeTab === 'new' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600, borderRadius: '8px', cursor: 'pointer', boxShadow: activeTab === 'new' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
          >
            New Feedback
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            style={{ flex: 1, padding: '8px 0', border: 'none', background: activeTab === 'history' ? 'var(--bg-card)' : 'transparent', color: activeTab === 'history' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600, borderRadius: '8px', cursor: 'pointer', boxShadow: activeTab === 'history' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
          >
            My History
          </button>
        </div>

        {activeTab === 'new' ? (
          status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✅</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>Thank you!</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Your feedback has been sent to the admin.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-secondary)' }}>Feedback Type</label>
              <CustomSelect
                value={type}
                onChange={e => setType(e.target.value)}
                options={[
                  { value: "Suggestion", label: "Suggestion" },
                  { value: "Bug Report", label: "Bug Report" },
                  { value: "Rating", label: "Rating" },
                  { value: "Complaint", label: "Complaint" }
                ]}
                className="bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] font-normal py-[10px]"
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-secondary)' }}>Message</label>
              <textarea 
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us what you think..."
                rows="4"
                style={{
                  width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical'
                }}
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={status === 'loading'}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: '1rem',
                cursor: status === 'loading' ? 'not-allowed' : 'pointer', marginTop: '8px'
              }}
            >
              {status === 'loading' ? 'Sending...' : 'Send Feedback'}
            </button>
            {status === 'error' && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
                Failed to send feedback. Please try again.
              </p>
            )}
          </form>
        )
        ) : (
          <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '8px' }}>
            {loadingHistory ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading history...</p>
            ) : history.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>You haven't submitted any feedback yet.</p>
            ) : (
              history.map(item => (
                <div key={item.id} style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.type}</span>
                    <span style={{ fontSize: '0.8rem', color: item.status === 'Closed' ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>{item.status}</span>
                  </div>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{item.message}</p>
                  
                  {item.admin_reply && (
                    <div style={{ padding: '12px', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '12px', borderLeft: '4px solid var(--primary)' }}>
                      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '4px' }}>Admin Reply</p>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.admin_reply}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;
