import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../contexts/LangContext';
import API from '../utils/api';
import toast from 'react-hot-toast';
import {
  AlertTriangle, Phone, Activity, HeartPulse, Plus, X, Edit2, Trash2,
  MapPin, ShieldAlert, ShieldCheck, Bot, Search, Droplet, Clock, Download, Share2, User, Heart
} from 'lucide-react';
import OrganDonorModal from '../components/OrganDonorModal';
import OrganNetworkModal from '../components/OrganNetworkModal';
import HealthIDCard from '../components/HealthIDCard';

const Emergency = ({ voiceAction, onVoiceActionConsumed }) => {
  const navigate = useNavigate();
  const { t, lang } = useLang();

  useEffect(() => {
    // Hide right panel globally for this page
    const appContainer = document.querySelector('.app-container');
    const rightPanel = document.querySelector('.right-panel');
    if (appContainer && rightPanel) {
      appContainer.style.gridTemplateColumns = 'var(--sidebar-width) 1fr';
      rightPanel.style.display = 'none';
    }
    return () => {
      if (appContainer && rightPanel) {
        appContainer.style.gridTemplateColumns = 'var(--sidebar-width) 1fr var(--right-panel-width)';
        rightPanel.style.display = 'flex';
      }
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [sosLoading, setSosLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [contacts, setContacts] = useState([]);

  // AI Triage State
  const [triageSymptom, setTriageSymptom] = useState('');
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageResult, setTriageResult] = useState(null);

  // AI First Aid State
  const [firstAidLoading, setFirstAidLoading] = useState(false);
  const [firstAidResult, setFirstAidResult] = useState(null);
  const [firstAidTopic, setFirstAidTopic] = useState('');

  // Organ Donor State
  const [isOrganDonorModalOpen, setIsOrganDonorModalOpen] = useState(false);
  const [isOrganNetworkModalOpen, setIsOrganNetworkModalOpen] = useState(false);

  // Listen for voice actions (handled after triggerSOS is defined)
  const voiceActionHandled = React.useRef(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [fetchedContacts, qrData] = await Promise.all([
        API.get('/emergency/contacts'),
        API.get('/emergency/qr-data')
      ]);
      setContacts(fetchedContacts || []);
      setProfile(qrData || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeSessionRef = React.useRef(null);

  const startLiveTracking = (sessionId) => {
    try {
      const wsUrl = API.getWebSocketUrl(`/emergency/ws/${sessionId}`);
      const ws = new WebSocket(wsUrl);
      activeSessionRef.current = ws;

      ws.onopen = () => {
        // Start Location Tracking
        const locInterval = setInterval(() => {
          if (navigator.geolocation && ws.readyState === WebSocket.OPEN) {
            navigator.geolocation.getCurrentPosition(pos => {
              ws.send(JSON.stringify({ type: 'location', latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
            }, () => { }, { enableHighAccuracy: true });
          }
        }, 5000);

        // Start Audio Recording
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = async (e) => {
              if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                const reader = new FileReader();
                reader.readAsDataURL(e.data);
                reader.onloadend = () => {
                  ws.send(JSON.stringify({ type: 'audio_chunk', data: reader.result }));
                }
              }
            };
            mediaRecorder.start(2000);

            ws.onclose = () => {
              clearInterval(locInterval);
              mediaRecorder.stop();
              stream.getTracks().forEach(trk => trk.stop());
            };
          }).catch(err => console.error("Audio recording permission denied", err));
        } else {
          ws.onclose = () => clearInterval(locInterval);
        }
      };
    } catch (e) {
      console.error("Live tracking setup failed", e);
    }
  };

  const triggerSOS = async (skipConfirm = false, isSilent = false) => {
    const shouldSkipConfirm = skipConfirm === true || isSilent === true;
    if (shouldSkipConfirm || confirm(t('🚨 EMERGENCY SOS 🚨\n\nAre you sure you want to trigger an SOS alert? This will immediately notify your emergency contacts and local authorities.'))) {
      try {
        if (!isSilent) setSosLoading(true);
        const getPosition = () => {
          return new Promise((resolve) => {
            if (!navigator.geolocation) {
              resolve(null);
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
              (err) => resolve(null),
              { timeout: 6000, enableHighAccuracy: true }
            );
          });
        };

        const locationData = await getPosition();
        const sessionId = Date.now().toString();
        const payload = locationData ? { ...locationData, session_id: sessionId } : { session_id: sessionId };

        const res = await API.post('/emergency/sos', payload);

        startLiveTracking(sessionId);

        if (!isSilent) {
          toast.success(t('SOS ALERT SENT.') + '\n\n' + t('Actions triggered:') + '\n' + res.actions.map(a => `✅ ${a}`).join('\n') + '\n\n📞 ' + t('Emergency: 112'), { duration: 8000 });
        } else {
          console.log("Silent SOS executed successfully.");
        }
      } catch (e) {
        if (!isSilent) toast.error(t('Failed to send SOS'));
      } finally {
        if (!isSilent) setSosLoading(false);
      }
    }
  };

  const toggleDonor = async () => {
    try {
      const res = await API.post('/emergency/toggle-donor');
      toast.success(res.message);
      fetchData(); // refresh profile state
    } catch (e) {
      toast.error(t('Failed to update status'));
    }
  };

  const formatMessage = (text) => {
    if (!text) return null;
    if (typeof text !== 'string') return text;
    let formatted = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\n/g, '<br />');
    formatted = formatted.replace(/(^|<br \/>)\s*[\*\-]\s+/g, '$1• ');
    return <span dangerouslySetInnerHTML={{ __html: formatted }} style={{ lineHeight: '1.6' }} />;
  };

  const evaluateTriage = async () => {
    if (!triageSymptom.trim()) return;
    try {
      setTriageLoading(true);
      const res = await API.post('/ai/symptoms/analyze', {
        symptoms: [triageSymptom],
        duration: "Unknown",
        severity: "Unknown",
        age_group: profile?.age ? `${profile.age}` : "Adult"
      });
      setTriageResult(res);
    } catch (e) {
      toast.error(t("Failed to evaluate symptom."));
    } finally {
      setTriageLoading(false);
    }
  };

  const getFirstAid = async (topic) => {
    try {
      setFirstAidLoading(true);
      setFirstAidTopic(topic);
      const res = await API.post('/ai/chat', {
        message: `Provide immediate, critical step-by-step first aid instructions for: ${topic}. Keep it short and actionable. No introductory filler.`
      });
      setFirstAidResult(res.response);
    } catch (e) {
      toast.error(t("Failed to get first aid instructions."));
    } finally {
      setFirstAidLoading(false);
    }
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [modalData, setModalData] = useState({ id: null, name: '', phone: '', relation: '', email: '', carrier: '' });

  const openAddModal = () => {
    setModalMode('add');
    setModalData({ id: null, name: '', phone: '', relation: '', email: '', carrier: '' });
    setModalOpen(true);
  };

  // Voice action handler
  useEffect(() => {
    if (voiceAction && voiceAction.target_feature === 'emergency') {
      if (voiceAction.action_name === 'trigger_sos') {
        triggerSOS(true, false);
      } else if (voiceAction.action_name === 'trigger_sos_silent') {
        triggerSOS(true, true);
      } else if (voiceAction.action_name === 'open_add_modal') {
        openAddModal();
      }
      if (onVoiceActionConsumed) onVoiceActionConsumed();
    }
  }, [voiceAction]);

  const openEditModal = (c) => {
    setModalMode('edit');
    setModalData({ id: c.id, name: c.name, phone: c.phone, relation: c.relation, email: c.email || '', carrier: c.carrier || '' });
    setModalOpen(true);
  };

  const saveContact = async () => {
    if (!modalData.name || !modalData.phone || !modalData.relation) {
      toast.error(t("Please fill in all fields."));
      return;
    }

    try {
      if (modalMode === 'add') {
        await API.post('/emergency/contacts', { name: modalData.name, phone: modalData.phone, relation: modalData.relation, email: modalData.email || null, carrier: modalData.carrier || null });
      } else {
        await API.put(`/emergency/contacts/${modalData.id}`, { name: modalData.name, phone: modalData.phone, relation: modalData.relation, email: modalData.email || null, carrier: modalData.carrier || null });
      }
      setModalOpen(false);
      fetchData();
      toast.success(modalMode === 'add' ? t('Contact added successfully') : t('Contact updated successfully'));
    } catch (e) {
      toast.error(t('Failed to save contact'));
    }
  };

  const deleteContact = async (id) => {
    if (confirm(t('Delete this contact?'))) {
      try {
        await API.delete(`/emergency/contacts/${id}`);
        fetchData();
        toast.success(t('Contact deleted'));
      } catch (e) {
        toast.error(t('Failed to delete contact'));
      }
    }
  };

  const getNearbyHospitals = () => [
    { name: 'Apollo Hospital', distance: '2.3 km', type: t('Multi-specialty'), phone: '1066', icon: <Activity size={24} /> },
    { name: 'City Blood Bank', distance: '1.5 km', type: t('Blood Bank'), phone: '104', icon: <Droplet size={24} /> },
    { name: 'LifeCare Pharmacy', distance: '0.8 km', type: t('Pharmacy'), phone: '1800-123', icon: <HeartPulse size={24} /> },
    { name: 'Ambulance Service', distance: t('On Call'), type: t('Emergency'), phone: '108', icon: <AlertTriangle size={24} /> }
  ];

  const healthIDText = profile ? `${t('EMERGENCY MEDICAL ID')}\n${t('Name')}: ${profile.name || t('Unknown')}\n${t('Blood Type')}: ${profile.blood_type || t('Unknown')}\n${t('Age')}: ${profile.age || '?'} | ${t('Gender')}: ${profile.gender || t('Unknown')}\n${t('Allergies')}: ${profile.allergies?.join(', ') || t('None')}\n${t('Conditions')}: ${profile.conditions?.join(', ') || t('None')}\n${t('Emergency Contact')}: ${contacts && contacts.length > 0 ? `${contacts[0].name} - ${contacts[0].phone}` : t('None')}` : '';
  const qrUrl = `https://quickchart.io/qr?size=300&margin=0&text=${encodeURIComponent(healthIDText)}`;

  const downloadQR = async () => {
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'LifeOS_Emergency_QR.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t("QR code downloaded"));
    } catch (e) {
      toast.error(t("Failed to download QR code."));
    }
  };

  const [sharingLoading, setSharingLoading] = useState(false);
  const copyID = async () => {
    try {
      setSharingLoading(true);
      const res = await API.post('/share/generate');
      const url = `${window.location.origin}/shared/${res.token}`;
      await navigator.clipboard.writeText(url);
      toast.success(t("Secure Digital ID link copied!"));
    } catch (e) {
      toast.error(t("Failed to generate secure Digital ID link."));
    } finally {
      setSharingLoading(false);
    }
  };

  if (loading && !profile) return <div className="empty-state"><span className="spinner"></span> {t('Loading Emergency System...')}</div>;
  if (!profile) return <div className="empty-state">{t('Failed to load Emergency Data')}</div>;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20">

        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-hidden w-full mb-8">
          <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
                {t('Emergency System')}
              </h1>
              <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
                <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse shrink-0"></span>
                {t('Emergency services active and ready')}
              </p>
            </div>
          </div>
        </div>

        {/* AI Urgency Evaluator */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-100 dark:border-red-800/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-800/50 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
            <Bot size={24} />
          </div>
          <div className="flex-1 relative">
            <input
              type="text"
              value={triageSymptom}
              onChange={e => setTriageSymptom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && evaluateTriage()}
              placeholder={t("Describe your symptoms for instant AI triage (e.g., 'Severe chest pain')")}
              className="w-full py-3 px-4 pl-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
            />
            <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
          </div>
          <button onClick={evaluateTriage} disabled={triageLoading} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-70 disabled:cursor-wait shrink-0">
            {triageLoading ? t('Evaluating...') : t('Evaluate')}
          </button>
        </div>

        {triageResult && (
          <div className={`mb-8 p-6 rounded-2xl border ${triageResult.urgency === 'High' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : triageResult.urgency === 'Medium' ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'}`}>
            <div className="flex justify-between items-start mb-4">
              <h3 className={`text-lg font-bold ${triageResult.urgency === 'High' ? 'text-red-700 dark:text-red-400' : triageResult.urgency === 'Medium' ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
                {t('Urgency Level')}: {t(triageResult.urgency)}
              </h3>
              <button onClick={() => setTriageResult(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <strong className="block text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{t('Possible Conditions')}:</strong>
                <ul className="list-disc list-inside text-gray-800 dark:text-gray-200 text-sm">
                  {triageResult.conditions?.map((c, i) => <li key={i}>{c.condition} ({c.probability}%)</li>)}
                </ul>
              </div>
              <div>
                <strong className="block text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{t('Recommendations')}:</strong>
                <ul className="list-disc list-inside text-gray-800 dark:text-gray-200 text-sm">
                  {triageResult.recommendations?.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* SOS Button Container */}
          <div className="lg:col-span-2 p-8 rounded-[2rem] bg-gray-50 dark:bg-gray-800 shadow-sm border border-red-100 dark:border-red-900/30 flex flex-col items-center justify-center relative overflow-hidden group hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-500">
            <div className="absolute -inset-10 bg-red-500/5 blur-3xl rounded-full pointer-events-none"></div>

            <button
              onClick={triggerSOS}
              disabled={sosLoading}
              className={`relative z-10 flex flex-col items-center justify-center gap-2 w-40 h-40 rounded-full bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white shadow-[0_0_40px_rgba(239,68,68,0.4)] hover:shadow-[0_0_60px_rgba(239,68,68,0.6)] border-4 border-white dark:border-gray-800 transition-all transform hover:scale-105 active:scale-95 ${sosLoading ? 'opacity-80 cursor-wait' : 'cursor-pointer'}`}
            >
              {sosLoading ? (
                <>
                  <div className="w-8 h-8 rounded-full border-4 border-white/30 border-t-white animate-spin mb-2"></div>
                  <span className="font-bold tracking-widest text-sm">{t('LOCATING')}</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={48} className="mb-1" />
                  <span className="font-extrabold text-xl tracking-widest">{t('SOS')}</span>
                </>
              )}
            </button>

            <div className="mt-8 text-center relative z-10">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('Emergency Assistance')}</h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-sm leading-relaxed mb-4">
                {t('Press the SOS button to instantly alert your emergency contacts, share your live location, and begin audio recording.')}
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full text-xs font-bold uppercase tracking-wider">
                <Phone size={14} /> {t('Also call 911 / 112')}
              </div>
            </div>
          </div>

          {/* AI First Aid Assistant */}
          <div className="p-6 rounded-[2rem] bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                <HeartPulse size={20} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('AI First Aid')}</h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 flex-1">
              {t('Instant AI-guided first aid instructions for critical scenarios.')}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={() => getFirstAid('Burns')} disabled={firstAidLoading} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-600 transition-colors text-gray-700 dark:text-gray-300">
                <span className="text-2xl">🔥</span>
                <span className="text-xs font-semibold">{t('Burns')}</span>
              </button>
              <button onClick={() => getFirstAid('CPR')} disabled={firstAidLoading} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-600 transition-colors text-gray-700 dark:text-gray-300">
                <span className="text-2xl">🫁</span>
                <span className="text-xs font-semibold">{t('CPR')}</span>
              </button>
              <button onClick={() => getFirstAid('Severe Bleeding')} disabled={firstAidLoading} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-600 transition-colors text-gray-700 dark:text-gray-300">
                <span className="text-2xl">🩸</span>
                <span className="text-xs font-semibold">{t('Bleeding')}</span>
              </button>
              <button onClick={() => getFirstAid('Choking')} disabled={firstAidLoading} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-600 transition-colors text-gray-700 dark:text-gray-300">
                <span className="text-2xl">🤢</span>
                <span className="text-xs font-semibold">{t('Choking')}</span>
              </button>
            </div>

            <button onClick={() => navigate('/app/ai-chat')} className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
              <Bot size={18} /> {t('Open First Aid Chat')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Left Column: Contacts & Hospitals */}
          <div className="flex flex-col gap-8">

            {/* Emergency Contacts */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Phone className="text-blue-500" /> {t('Emergency Contacts')}
                </h3>
                <button onClick={openAddModal} className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1">
                  <Plus size={16} /> {t('Add New')}
                </button>
              </div>

              <div className="space-y-4">
                {contacts.map(c => (
                  <div key={c.id} className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between hover:shadow-md hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <span className="font-bold text-lg">{c.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-lg">{c.name}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 whitespace-nowrap">{c.relation}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{c.phone}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => openEditModal(c)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => deleteContact(c.id)} className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={18} />
                      </button>
                      <a href={`tel:${c.phone}`} className="ml-2 flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-bold hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
                        <Phone size={16} /> {t('Call')}
                      </a>
                    </div>
                  </div>
                ))}
                {contacts.length === 0 && (
                  <div className="p-6 text-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                    {t('No emergency contacts added yet.')}
                  </div>
                )}
              </div>
            </div>

            {/* Nearby Hospitals */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <MapPin className="text-red-500" /> {t('Nearby Hospitals')}
              </h3>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                {getNearbyHospitals().map((h, i) => (
                  <div key={i} className={`flex items-center justify-between p-4 transition-colors hover:bg-red-50 dark:hover:bg-red-900/10 cursor-pointer ${i !== getNearbyHospitals().length - 1 ? 'border-b border-gray-50 dark:border-gray-700/50' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-xl shrink-0">
                        {h.icon}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white">{h.name}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{h.distance} • {t(h.type)}</p>
                      </div>
                    </div>
                    <a href={`tel:${h.phone}`} className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2">
                      <Phone size={14} /> {h.phone}
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Organ Donor & Network */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <HeartPulse className="text-green-500" /> {t('Organ Donor & Exchange')}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Donor Registration Card */}
                <div onClick={() => setIsOrganDonorModalOpen(true)} className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between transition-colors hover:bg-green-50 dark:hover:bg-green-900/10 cursor-pointer group">
                  <div className="flex items-start justify-between mb-4">
                    <Heart className="w-10 h-10 text-green-500" fill="currentColor" />
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${profile.organ_donor ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                      {profile.organ_donor ? t('Registered') : t('Not Registered')}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-gray-900 dark:text-white mb-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                      {t('Donor Registration')}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('Manage advanced preferences & AI screening.')}
                    </p>
                  </div>
                </div>

                {/* Organ Network Card */}
                <div onClick={() => setIsOrganNetworkModalOpen(true)} className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/10 cursor-pointer group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-4xl text-indigo-500"><Search /></div>
                    <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                      {t('Global')}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-gray-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {t('Organ Match Network')}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('Search availability and match requirements.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Digital ID & Donor */}
          <div className="flex flex-col gap-8">

            {/* Digital Health ID */}
            <div>
              <HealthIDCard profile={profile} qrUrl={qrUrl} t={t} />

              <div className="flex gap-4 mt-6">
                <button onClick={downloadQR} className="flex-1 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl font-bold flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <Download size={18} /> {t('Download ID')}
                </button>
                <button onClick={copyID} disabled={sharingLoading} className={`flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-indigo-700 transition-colors ${sharingLoading ? 'opacity-70 cursor-wait' : ''}`}>
                  <Share2 size={18} /> {sharingLoading ? t('Generating...') : t('Share ID')}
                </button>
              </div>
            </div>
          </div>
        </div>


        {/* Add/Edit Contact Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity">
            <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Phone className="text-blue-500" />
                  {modalMode === 'add' ? t('Add Emergency Contact') : t('Edit Emergency Contact')}
                </h3>
                <button onClick={() => setModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('Name')}</label>
                  <input type="text" value={modalData.name} onChange={e => setModalData({ ...modalData, name: e.target.value })} placeholder={t('Contact name')} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('Phone')}</label>
                  <input type="tel" value={modalData.phone} onChange={e => setModalData({ ...modalData, phone: e.target.value })} placeholder="+1 (555) 000-0000" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('Email (Optional)')}</label>
                  <input type="email" value={modalData.email} onChange={e => setModalData({ ...modalData, email: e.target.value })} placeholder="contact@example.com" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('Relation')}</label>
                  <input type="text" value={modalData.relation} onChange={e => setModalData({ ...modalData, relation: e.target.value })} placeholder={t('e.g., Father, Doctor')} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
                <button onClick={() => setModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">{t('Cancel')}</button>
                <button onClick={saveContact} className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors">{t('Save Contact')}</button>
              </div>
            </div>
          </div>
        )}
        {/* AI First Aid Modal */}
        {firstAidResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity">
            <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Bot className="text-blue-500" />
                  {t('First Aid')}: {t(firstAidTopic)}
                </h3>
                <button onClick={() => setFirstAidResult(null)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <div className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200">
                  {formatMessage(firstAidResult)}
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
                <button onClick={() => setFirstAidResult(null)} className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors">{t('Close')}</button>
              </div>
            </div>
          </div>
        )}
        
        {/* Advanced Organ Donor Modals */}
        <OrganDonorModal
          isOpen={isOrganDonorModalOpen}
          onClose={() => setIsOrganDonorModalOpen(false)}
          profile={profile}
          onSave={(payload) => {
            setProfile(prev => ({
              ...prev,
              organ_donor: payload.organ_donor,
              organ_preferences: payload.organ_preferences
            }));
          }}
        />
        
        <OrganNetworkModal
          isOpen={isOrganNetworkModalOpen}
          onClose={() => setIsOrganNetworkModalOpen(false)}
          userBloodType={profile?.blood_type}
        />
    </div>
  );
};

export default Emergency;

