import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../contexts/LangContext';
import API from '../utils/api';
import { sosResult } from '../utils/sosResult';
import { getSosLocation } from '../utils/sosLocation';
import toast from 'react-hot-toast';
import {
  AlertTriangle, Phone, Activity, HeartPulse, Plus, X, Edit2, Trash2,
  MapPin, ShieldAlert, ShieldCheck, Bot, Search, Droplet, Clock, Download, Share2, User, Heart, Music
} from 'lucide-react';
import OrganDonorModal from '../components/OrganDonorModal';
import OrganNetworkModal from '../components/OrganNetworkModal';
import HealthIDCard from '../components/HealthIDCard';

const PREDEFINED_FIRST_AID = {
  'Burns': "1. Cool the burn under cold running water for at least 10 minutes.\n2. Remove clothing or jewelry near the burned area unless it's stuck to the skin.\n3. Cover the burn loosely with a clean, non-stick dressing or plastic wrap.\n4. Do not apply ice, butter, or ointments to a severe burn.\n5. Seek medical attention for large, deep, or facial burns.\n\n**DISCLAIMER:** This is a quick reference guide. It does not replace professional medical advice. Always call emergency services immediately in a critical situation.",
  'CPR': "1. Call emergency services immediately.\n2. Lay the person flat on their back on a firm surface.\n3. Place the heel of one hand in the center of their chest, and the other hand on top.\n4. Push hard and fast (at least 2 inches deep, 100-120 compressions per minute).\n5. Allow the chest to fully rise between compressions.\n6. Continue until help arrives or the person breathes.\n\n**DISCLAIMER:** This is a quick reference guide. It does not replace professional medical advice. Always call emergency services immediately in a critical situation.",
  'Severe Bleeding': "1. Apply firm, direct pressure to the wound with a clean cloth or bandage.\n2. Maintain pressure continuously; do not lift the cloth to check the wound.\n3. Elevate the injured area above the heart if possible.\n4. If bleeding soaks through, add more cloths on top—do not remove the bottom layer.\n5. Call emergency services if bleeding is severe or won't stop.\n\n**DISCLAIMER:** This is a quick reference guide. It does not replace professional medical advice. Always call emergency services immediately in a critical situation.",
  'Choking': "1. Ask 'Are you choking?' If they cannot cough, speak, or breathe, act immediately.\n2. Stand behind them and wrap your arms around their waist.\n3. Make a fist with one hand and place the thumb side just above their navel.\n4. Grasp your fist with your other hand.\n5. Give quick, upward thrusts (Heimlich maneuver) until the object is dislodged.\n6. If they become unconscious, begin CPR.\n\n**DISCLAIMER:** This is a quick reference guide. It does not replace professional medical advice. Always call emergency services immediately in a critical situation.",
  'Fainting': "1. Catch the person before they fall if possible, and lay them flat on their back.\n2. Elevate their legs above heart level (about 12 inches).\n3. Loosen restrictive clothing (belts, collars).\n4. Do not force them to get up quickly.\n5. If they don't regain consciousness within 1 minute, call emergency services.\n\n**DISCLAIMER:** This is a quick reference guide. It does not replace professional medical advice. Always call emergency services immediately in a critical situation.",
  'Seizure': "1. Do not restrain the person or put anything in their mouth.\n2. Clear the area of hard or sharp objects to prevent injury.\n3. Place something soft and flat under their head.\n4. Turn them gently onto one side to keep their airway clear.\n5. Time the seizure. If it lasts longer than 5 minutes, call emergency services.\n\n**DISCLAIMER:** This is a quick reference guide. It does not replace professional medical advice. Always call emergency services immediately in a critical situation."
};

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
  const [sosStatus, setSosStatus] = useState(null);
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

  // Audio Clip State (Archived)
  // const [audioClip, setAudioClip] = useState(null);
  // const [isUploadingAudio, setIsUploadingAudio] = useState(false);

  // Nearby Hospitals State
  const [realHospitals, setRealHospitals] = useState([]);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState(null);

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

      // ARCHIVED: Audio Clip Fetch
      // try {
      //   const audioRes = await API.get('/emergency/sos-audio');
      //   setAudioClip(audioRes);
      // } catch (err) {
      //   if (err.response?.status !== 404) console.error(err);
      // }
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
    if (sosLoading) return;
    if (shouldSkipConfirm || confirm(t('Send an SOS alert to your saved emergency contacts? Delivery depends on the notification service. This does not automatically contact local authorities.'))) {
      try {
        setSosLoading(true);
        if (!isSilent) setSosStatus(null);
        const locationData = await getSosLocation();
        const sessionId = Date.now().toString();
        const payload = { ...locationData, session_id: sessionId, is_silent: isSilent };
        const res = await API.post('/emergency/sos', payload);

        if (res.success) startLiveTracking(sessionId);

        if (!isSilent) {
          const status = sosResult(res, { locationAvailable: Boolean(locationData) });
          setSosStatus(status);
          if (status.ok) toast.success(t(status.message), { duration: 8000 });
          else toast.error(t(status.message), { duration: 10000 });
        } else {
          console.log(res.success ? "Silent SOS executed successfully." : "Silent SOS failed.");
        }
      } catch (e) {
        if (!isSilent) setSosStatus({ ok: false, message: e.message || 'SOS delivery failed. Call your emergency contact directly.' });
        if (!isSilent) toast.error(t('Emergency alert could not be confirmed. Please call your emergency contact directly.'), { duration: 8000 });
      } finally {
        setSosLoading(false);
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
    setFirstAidTopic(topic);
    const content = PREDEFINED_FIRST_AID[topic] || "No predefined instructions available. Please contact emergency services immediately.";
    setFirstAidResult(content);
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [modalData, setModalData] = useState({ id: null, name: '', phone: '', relation: '', email: '', carrier: '' });

  const openAddModal = () => {
    setModalMode('add');
    setModalData({ id: null, name: '', phone: '', relation: '', email: '', carrier: '' });
    setModalOpen(true);
  };

  /* --- ARCHIVED: Custom SOS Audio Upload & Delete Handlers ---
  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg'];
    if (!validTypes.includes(file.type)) {
      toast.error('Only MP3, WAV, and OGG files are supported.');
      return;
    }

    try {
      setIsUploadingAudio(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await API.post('/emergency/sos-audio', formData);
      setAudioClip(res);
      if (res.call_audio_ready === false) {
        toast.error(res.call_audio_message || 'Recording saved, but call audio is unavailable.');
      } else {
        toast.success('SOS custom audio clip saved!');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload audio clip');
    } finally {
      setIsUploadingAudio(false);
      e.target.value = ''; // reset input
    }
  };

  const handleDeleteAudio = async (e) => {
    e.stopPropagation();
    try {
      await API.delete('/emergency/sos-audio');
      setAudioClip(null);
      toast.success('Custom audio clip removed.');
    } catch (error) {
      toast.error('Failed to remove audio clip');
    }
  };
  ------------------------------------------------------------ */

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

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  const fetchRealHospitals = async (lat, lon) => {
    try {
      const query = `
        [out:json];
        (
          node["amenity"="hospital"](around:5000, ${lat}, ${lon});
          node["amenity"="clinic"](around:5000, ${lat}, ${lon});
          node["amenity"="pharmacy"](around:5000, ${lat}, ${lon});
        );
        out 5;
      `;
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
      });
      const data = await response.json();

      const hospitals = data.elements.map(el => {
        const dist = calculateDistance(lat, lon, el.lat, el.lon);
        let type = 'Hospital';
        let icon = <Activity size={24} />;
        if (el.tags.amenity === 'clinic') { type = 'Clinic'; icon = <HeartPulse size={24} />; }
        if (el.tags.amenity === 'pharmacy') { type = 'Pharmacy'; icon = <Droplet size={24} />; }

        return {
          name: el.tags.name || `Unnamed ${type}`,
          distance: `${dist.toFixed(1)} km`,
          type: t(type),
          phone: el.tags.phone || 'N/A',
          timing: el.tags.opening_hours || null,
          icon,
          rawDist: dist,
          lat: el.lat,
          lon: el.lon
        };
      }).sort((a, b) => a.rawDist - b.rawDist);

      setRealHospitals(hospitals);
      setLocationError(null);
    } catch (err) {
      console.error("Failed to fetch hospitals from Overpass API:", err);
      setLocationError("Failed to load live data.");
    } finally {
      setIsLocating(false);
    }
  };

  const requestLocationAndFetch = () => {
    setIsLocating(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchRealHospitals(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setLocationError("Location permission denied or unavailable.");
        setIsLocating(false);
      },
      { timeout: 10000 }
    );
  };

  useEffect(() => {
    requestLocationAndFetch();
  }, []);

  const getNearbyHospitals = () => [
    { name: 'Apollo Hospital', distance: '2.3 km', type: t('Multi-specialty'), phone: '1066', timing: '24/7', icon: <Activity size={24} />, lat: 28.6139, lon: 77.2090 },
    { name: 'City Blood Bank', distance: '1.5 km', type: t('Blood Bank'), phone: '104', timing: '9:00 AM - 6:00 PM', icon: <Droplet size={24} />, lat: 28.6140, lon: 77.2100 },
    { name: 'LifeCare Pharmacy', distance: '0.8 km', type: t('Pharmacy'), phone: '1800-123', timing: '24/7', icon: <HeartPulse size={24} />, lat: 28.6150, lon: 77.2110 },
    { name: 'Ambulance Service', distance: t('On Call'), type: t('Emergency'), phone: '108', timing: '24/7', icon: <AlertTriangle size={24} />, lat: 28.6160, lon: 77.2120 }
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
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center w-full gap-4 md:gap-6 relative overflow-hidden mb-8">
        <div className="flex items-center gap-4 md:gap-5 relative z-10 w-full md:w-auto">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold md:font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
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
      <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-100 dark:border-red-800/30 flex flex-col md:flex-row items-stretch md:items-center gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-800/50 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0 hidden sm:flex">
            <Bot size={24} />
          </div>
          <div className="flex-1 relative w-full">
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
        </div>
        <button onClick={evaluateTriage} disabled={triageLoading} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-70 disabled:cursor-wait shrink-0 w-full md:w-auto">
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

          {/* [ARCHIVED] Custom Audio Upload Button from UI */}

          <button
            onClick={triggerSOS}
            disabled={sosLoading}
            className={`relative z-10 flex flex-col items-center justify-center gap-2 w-40 h-40 rounded-full bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white shadow-[0_0_40px_rgba(239,68,68,0.4)] hover:shadow-[0_0_60px_rgba(239,68,68,0.6)] border-4 border-white dark:border-gray-800 transition-all transform hover:scale-105 active:scale-95 ${sosLoading ? 'opacity-80 cursor-wait' : 'cursor-pointer'}`}
          >
            {sosLoading ? (
              <>
                <div className="w-8 h-8 rounded-full border-4 border-white/30 border-t-white animate-spin mb-2"></div>
                <span className="font-bold tracking-widest text-sm">{t('SENDING SOS')}</span>
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
              {t('SOS requests notifications to your saved contacts. Location requires permission. If help is urgent, call directly.')}
            </p>
            {/* [ARCHIVED] Selected voice message display */}
            {sosStatus && <p role="status" className="my-3 whitespace-pre-line text-sm font-semibold">{t(sosStatus.message)}</p>}
            <a href="tel:108" className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full text-xs font-bold uppercase tracking-wider">
              <Phone size={14} /> {t('Call 108')}
            </a>
            {sosStatus && !sosStatus.ok && contacts.filter(c => c.phone).map(contact => (
              <div key={contact.id} className="mt-3 flex flex-wrap justify-center gap-3 text-sm">
                <a className="font-bold text-blue-600" href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}>Call {contact.name}</a>
                <a className="font-bold text-blue-600" href={`sms:${contact.phone.replace(/[^+\d]/g, '')}?body=${encodeURIComponent('SOS: I need urgent help. Please call me immediately.')}`}>Message {contact.name}</a>
              </div>
            ))}
          </div>
        </div>

        {/* First Aid Quick Reference */}
        <div className="p-6 rounded-[2rem] bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <HeartPulse size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('First Aid Quick Reference')}</h3>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 flex-1">
            {t('Instant predefined first-aid instructions for critical scenarios.')}
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin className="text-red-500" /> {t('Nearby Hospitals')}
              </h3>
              {locationError && (
                <button onClick={requestLocationAndFetch} className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 font-medium px-3 py-1 rounded-lg bg-sky-50 dark:bg-sky-900/20">
                  {t('Locate Me')}
                </button>
              )}
            </div>

            {locationError && (
              <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                <AlertTriangle className="text-amber-500 shrink-0 w-5 h-5 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>{t('Sample data shown.')}</strong> {t('Please allow location access to see real nearby hospitals.')}
                </p>
              </div>
            )}

            {isLocating ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p>{t('Locating nearby facilities...')}</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                {(realHospitals.length > 0 ? realHospitals : getNearbyHospitals()).length === 0 ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    {t('No facilities found nearby.')}
                  </div>
                ) : (
                  (realHospitals.length > 0 ? realHospitals : getNearbyHospitals()).map((h, i, arr) => (
                    <div key={i} onClick={() => setSelectedHospital(h)} className={`flex items-center justify-between p-4 transition-colors hover:bg-red-50 dark:hover:bg-red-900/10 cursor-pointer ${i !== arr.length - 1 ? 'border-b border-gray-50 dark:border-gray-700/50' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-xl shrink-0 text-red-500">
                          {h.icon}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white line-clamp-1 pr-2">{h.name}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{h.distance} • {t(h.type)}</p>
                        </div>
                      </div>
                      {h.phone && h.phone !== 'N/A' && (
                        <a href={`tel:${h.phone}`} onClick={e => e.stopPropagation()} className="shrink-0 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2">
                          <Phone size={14} /> <span className="hidden sm:inline">{h.phone}</span>
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Digital ID & Donor */}
        <div className="flex flex-col gap-8">

          {/* Digital Health ID */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <ShieldCheck className="text-indigo-500" /> {t('Medical ID')}
            </h3>
            <HealthIDCard profile={profile} qrUrl={qrUrl} t={t} />

            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <button onClick={downloadQR} className="flex-1 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl font-bold flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full">
                <Download size={18} /> {t('Download ID')}
              </button>
              <button onClick={copyID} disabled={sharingLoading} className={`flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-indigo-700 transition-colors w-full ${sharingLoading ? 'opacity-70 cursor-wait' : ''}`}>
                <Share2 size={18} /> {sharingLoading ? t('Generating...') : t('Share ID')}
              </button>
            </div>
          </div>

          {/* Organ Donation Info */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <HeartPulse className="text-green-500" /> {t('Organ Donation Info')}
            </h3>
            <button onClick={() => setIsOrganDonorModalOpen(true)} className="w-full bg-white dark:bg-gray-800 p-5 rounded-2xl flex flex-col shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left group">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-bold text-gray-900 dark:text-white text-lg">{t('About Organ Donation')}</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('Learn about the importance of organ donation and find official resources to register.')}
              </p>
            </button>
          </div>
        </div>
      </div>


      {/* Add/Edit Contact Modal */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
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

            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap justify-end gap-3">
              <button onClick={() => setModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">{t('Cancel')}</button>
              <button onClick={saveContact} className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors">{t('Save Contact')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* AI First Aid Modal */}
      {firstAidResult && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setFirstAidResult(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <HeartPulse className="text-blue-500" />
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
        </div>,
        document.body
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

      {/* Hospital Detail Modal */}
      {selectedHospital && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedHospital(null)}
          />
          <div className="relative bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin className="text-red-500" />
                {selectedHospital.name}
              </h3>
              <button onClick={() => setSelectedHospital(null)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-2xl shrink-0 text-red-500">
                  {selectedHospital.icon}
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">{t('Type')}</p>
                  <p className="font-bold text-gray-900 dark:text-white">{t(selectedHospital.type)}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-gray-500 dark:text-gray-400 font-medium">{t('Distance')}</p>
                  <p className="font-bold text-gray-900 dark:text-white">{selectedHospital.distance}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {selectedHospital.phone && selectedHospital.phone !== 'N/A' && (
                  <a href={`tel:${selectedHospital.phone}`} className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <Phone size={18} /> Call {selectedHospital.phone}
                  </a>
                )}
                {selectedHospital.timing && (
                  <div className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold border border-gray-200 dark:border-gray-600">
                    <Clock size={18} /> {selectedHospital.timing}
                  </div>
                )}
              </div>

              {selectedHospital.lat && selectedHospital.lon && (
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 mb-6 bg-gray-100 dark:bg-gray-800" style={{ height: '200px' }}>
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    src={`https://maps.google.com/maps?q=${selectedHospital.lat},${selectedHospital.lon}&z=15&output=embed`}
                    style={{ border: 0 }}
                    allowFullScreen
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap justify-end gap-3">
              {selectedHospital.lat && selectedHospital.lon && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${selectedHospital.lat},${selectedHospital.lon}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center px-6 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors flex items-center justify-center gap-2">
                  <MapPin size={18} /> {t('Open in Google Maps')}
                </a>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Emergency;
