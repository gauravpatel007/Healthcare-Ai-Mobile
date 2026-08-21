import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'react-hot-toast';
import API from '../utils/api';
import { useUnit } from '../contexts/UnitContext';
import { useLang } from '../contexts/LangContext';
import { usePersistentTab } from '../hooks/usePersistentTab';
import {
  Settings as SettingsIcon, User, Shield, Image as ImageIcon, Trash2, ShieldAlert,
  Bell, ScanFace, FileText, Download, Share2, Plus, X, Phone, Save, Activity, HeartPulse, Target,
  Globe, Ruler
} from 'lucide-react';
import CustomSelect from '../components/ui/CustomSelect';

const Settings = ({ voiceAction, onVoiceActionConsumed }) => {
  const { unit, setUnit, displayWeight, displayHeight, weightUnit } = useUnit();
  const { lang, setLang, t } = useLang();

  useEffect(() => {
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
  const [profile, setProfile] = useState({
    name: '', age: 0, gender: '', weight: 0, height: 0, blood_type: '',
    allergies: '', conditions: '',
    ice1_name: '', ice1_rel: '', ice1_phone: '',
    ice2_name: '', ice2_rel: '', ice2_phone: ''
  });
  
  // Contacts
  const [ice1Id, setIce1Id] = useState(null);
  const [ice2Id, setIce2Id] = useState(null);
  const [showSecondaryContact, setShowSecondaryContact] = useState(false);

  // Face login state
  const [faceLoginEnabled, setFaceLoginEnabled] = useState(false);
  const [faceSetupOpen, setFaceSetupOpen] = useState(false);
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceCaptureStatus, setFaceCaptureStatus] = useState(''); // '' | 'loading' | 'scanning' | 'success' | 'error'
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [sharingLink, setSharingLink] = useState('');
  const [sharingLoading, setSharingLoading] = useState(false);
  const [showZoom, setShowZoom] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = usePersistentTab('settings', 'profile');

  // Voice Action Listener
  useEffect(() => {
    if (voiceAction && voiceAction.target_feature === 'settings' && voiceAction.action_name === 'open_tab' && voiceAction.data?.tab) {
      const tabId = voiceAction.data.tab.toLowerCase();
      const validTabs = ['profile', 'security', 'advanced', 'notifications'];
      if (validTabs.includes(tabId)) {
        setActiveTab(tabId);
      } else {
        toast.error(`Unknown settings tab: ${tabId}`);
      }
      if (onVoiceActionConsumed) onVoiceActionConsumed();
    }
  }, [voiceAction]);

  // Security state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorUri, setTwoFactorUri] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorSetupOpen, setTwoFactorSetupOpen] = useState(false);
  const [loginAlertsEnabled, setLoginAlertsEnabled] = useState(true);
  const [loginHistory, setLoginHistory] = useState([]);
  const [showAllLoginsModal, setShowAllLoginsModal] = useState(false);

  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [isAnalyzingGoal, setIsAnalyzingGoal] = useState(false);

  // Sync unit + lang from loaded profile
  useEffect(() => {
    if (profile.measurement_unit) setUnit(profile.measurement_unit);
    if (profile.language) setLang(profile.language);
  }, [profile.measurement_unit, profile.language]);

  const handleUnitChange = async (newUnit) => {
    setUnit(newUnit);
    setProfile(p => ({ ...p, measurement_unit: newUnit }));
    try {
      await API.put('/users/profile', { measurement_unit: newUnit });
    } catch (e) {
      console.error('Failed to save unit preference', e);
    }
  };

  const handleLangChange = async (newLang) => {
    setLang(newLang);
    setProfile(p => ({ ...p, language: newLang }));
    try {
      await API.put('/users/profile', { language: newLang });
      toast.success(t('Language updated!'));
    } catch (e) {
      console.error('Failed to save language preference', e);
    }
  };

  const handleAnalyzeGoal = async () => {
    if (!profile.target_weight || !profile.target_weight_timeline) {
      toast.error(t('Please enter both Target Weight and Timeline to analyze.'));
      return;
    }
    try {
      setIsAnalyzingGoal(true);
      const res = await API.post('/ai/fitness/analyze-goal', {
        current_weight: parseFloat(profile.weight) || 70,
        target_weight: parseFloat(profile.target_weight),
        timeline: profile.target_weight_timeline
      });
      setAiSuggestion(res);
      toast.success(t('Goal analyzed successfully!'));
    } catch (e) {
      toast.error(t('Failed to analyze goal.'));
    } finally {
      setIsAnalyzingGoal(false);
    }
  };


  const handleGenerateLink = async () => {
    try {
      setSharingLoading(true);
      const res = await API.post('/share/generate');
      const url = `${window.location.origin}/shared/${res.token}`;
      setSharingLink(url);
      navigator.clipboard.writeText(url);
      toast.success(t('Secure link generated and copied to clipboard! It will expire in 24 hours.'));
    } catch (e) {
      toast.error(t('Failed to generate secure link.'));
    } finally {
      setSharingLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const [data, authMe, contacts, history] = await Promise.all([
        API.get('/users/profile'),
        API.get('/auth/me').catch(() => null),
        API.get('/emergency/contacts').catch(() => []),
        API.get('/users/security/login-history').catch(() => null)
      ]);
      if (data) {
        const c1 = contacts && contacts.length > 0 ? contacts[0] : null;
        const c2 = contacts && contacts.length > 1 ? contacts[1] : null;

        if (c1) setIce1Id(c1.id);
        if (c2) {
          setIce2Id(c2.id);
          setShowSecondaryContact(true);
        }

        setProfile(prev => ({
          ...prev,
          ...data,
          allergies: Array.isArray(data.allergies) ? data.allergies.join(', ') : data.allergies,
          conditions: Array.isArray(data.conditions) ? data.conditions.join(', ') : data.conditions,
          ice1_name: c1 ? c1.name : '', ice1_rel: c1 ? c1.relation : '', ice1_phone: c1 ? c1.phone : '',
          ice2_name: c2 ? c2.name : '', ice2_rel: c2 ? c2.relation : '', ice2_phone: c2 ? c2.phone : ''
        }));
      }
      if (authMe) {
        setFaceLoginEnabled(!!authMe.face_login_enabled);
        setTwoFactorEnabled(!!authMe.two_factor_enabled);
        setLoginAlertsEnabled(!!authMe.login_alerts_enabled);
      }
      if (history && history.data) {
        setLoginHistory(history.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    
    const handleStorageChange = (e) => {
      if (e.key === 'lifeos_profile_updated') {
        fetchProfile();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      // Cleanup camera on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(trk => trk.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // ─── Face Login Functions ────────────────────────
  const loadFaceModels = async () => {
    if (faceModelsLoaded) return true;
    const faceapi = window.faceapi;
    if (!faceapi) {
      setFaceCaptureStatus('error');
      return false;
    }
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
      setFaceModelsLoaded(true);
      return true;
    } catch (e) {
      console.error('Failed to load face models', e);
      setFaceCaptureStatus('error');
      return false;
    }
  };

  const startFaceVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      return true;
    } catch (e) {
      console.error('Camera access denied', e);
      setFaceCaptureStatus('error');
      return false;
    }
  };

  const stopFaceVideo = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(trk => trk.stop());
      streamRef.current = null;
    }
  };

  const handleOpenFaceSetup = async () => {
    setFaceSetupOpen(true);
    setFaceCaptureStatus('loading');
    setFaceLoading(true);
    const [modelsOk, camOk] = await Promise.all([loadFaceModels(), startFaceVideo()]);
    setFaceLoading(false);
    if (modelsOk && camOk) {
      setFaceCaptureStatus('');
    }
  };

  const handleCloseFaceSetup = () => {
    stopFaceVideo();
    setFaceSetupOpen(false);
    setFaceCaptureStatus('');
  };

  const handleCaptureFace = async () => {
    const faceapi = window.faceapi;
    if (!faceapi || !faceModelsLoaded || !videoRef.current) {
      setFaceCaptureStatus('error');
      return;
    }
    setFaceCaptureStatus('scanning');
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!detection) {
        setFaceCaptureStatus('error');
        toast.error(t('No face detected. Please look straight at the camera and try again.'));
        return;
      }
      const descriptor = Array.from(detection.descriptor);
      await API.post('/auth/face-setup', { descriptor });
      setFaceCaptureStatus('success');
      setFaceLoginEnabled(true);
      setTimeout(() => {
        handleCloseFaceSetup();
      }, 1500);
    } catch (e) {
      console.error('Face capture failed', e);
      setFaceCaptureStatus('error');
      toast.error(t('Failed to save face data. Please try again.'));
    }
  };

  const handleFaceDisable = async () => {
    if (!confirm(t('Disable face login? You will need to set it up again to use it.'))) return;
    try {
      await API.post('/auth/face-disable');
      setFaceLoginEnabled(false);
      toast.success(t('Face login disabled successfully.'));
    } catch (e) {
      console.error(e);
      toast.error(t('Failed to disable face login.'));
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await API.post('/users/avatar', formData);
      if (res && res.avatar_url) {
        setProfile(prev => ({ ...prev, avatar_url: res.avatar_url }));
        toast.success(t('Profile picture updated successfully!'));
        window.location.reload(); // Force reload to update sidebar
      }
    } catch (error) {
      console.error('Avatar upload failed', error);
      toast.error(t('Failed to upload avatar'));
    }
  };

  const handleAvatarRemove = async () => {
    if (!confirm(t('Remove profile picture?'))) return;
    try {
      await API.put('/users/profile', { avatar_url: '' });
      setProfile(prev => ({ ...prev, avatar_url: null }));
      toast.success(t('Profile picture removed successfully!'));
      window.location.reload(); // Force reload to update sidebar
    } catch (error) {
      console.error('Avatar remove failed', error);
      toast.error(t('Failed to remove avatar'));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const calculateBMI = (weight, height) => {
    if (!weight || !height) return 0;
    const h = height / 100;
    return (weight / (h * h)).toFixed(1);
  };

  const calculateBMR = (weight, height, age, gender) => {
    if (!weight || !height || !age) return 0;
    if (gender === 'Male') {
      return Math.round(88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age));
    }
    return Math.round(447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age));
  };

  const handleSave = async () => {
    try {
      const payload = {
        name: profile.name,
        age: parseInt(profile.age) >= 0 ? parseInt(profile.age) : null,
        gender: profile.gender,
        blood_type: profile.blood_type,
        height: parseFloat(profile.height) > 0 ? parseFloat(profile.height) : null,
        weight: parseFloat(profile.weight) > 0 ? parseFloat(profile.weight) : null,
        step_goal: parseInt(profile.step_goal) || 10000,
        target_weight: profile.target_weight ? parseFloat(profile.target_weight) : null,
        target_weight_timeline: profile.target_weight_timeline || null,
        calorie_goal: profile.calorie_goal ? parseInt(profile.calorie_goal) || null : null,
        burn_calorie_goal: profile.burn_calorie_goal ? parseInt(profile.burn_calorie_goal) || 500 : 500,
        allergies: profile.allergies ? profile.allergies.split(',').map(s => s.trim()) : [],
        conditions: profile.conditions ? profile.conditions.split(',').map(s => s.trim()) : []
      };

      const saveContact = async (id, name, phone, rel) => {
        if (!name) {
          if (id) {
            await API.delete(`/emergency/contacts/${id}`);
          }
          return;
        }
        const contactPayload = { name, phone: phone || '', relation: rel || '' };
        if (id) {
          await API.put(`/emergency/contacts/${id}`, contactPayload);
        } else {
          await API.post('/emergency/contacts', contactPayload);
        }
      };

      if (payload.calorie_goal) {
        localStorage.setItem(`lifeos_calorie_goal_${profile.user_id}`, payload.calorie_goal.toString());
      }
      
      await Promise.all([
        API.put('/users/profile', payload),
        saveContact(ice1Id, profile.ice1_name, profile.ice1_phone, profile.ice1_rel),
        saveContact(ice2Id, profile.ice2_name, profile.ice2_phone, profile.ice2_rel)
      ]);

      // Refresh to get any new IDs assigned by DB
      const contacts = await API.get('/emergency/contacts').catch(() => []);
      setIce1Id(contacts && contacts.length > 0 ? contacts[0].id : null);
      setIce2Id(contacts && contacts.length > 1 ? contacts[1].id : null);

      localStorage.setItem('lifeos_profile_updated', Date.now());

      toast.success(t('Profile changes saved successfully!'));
    } catch (e) {
      toast.error(t('Failed to save profile'));
    }
  };

  const handleExportExcel = () => {
    const headers = [t('Field'), t('Value')];
    const rows = [
      [t('Name'), profile.name],
      [t('Age'), profile.age],
      [t('Gender'), profile.gender],
      [t('Weight (kg)'), profile.weight],
      [t('Height (cm)'), profile.height],
      [t('Blood Type'), profile.blood_type],
      [t('Allergies'), profile.allergies],
      [t('Medical Conditions'), profile.conditions],
      [t('Primary ICE Name'), profile.ice1_name],
      [t('Primary ICE Rel'), profile.ice1_rel],
      [t('Primary ICE Phone'), profile.ice1_phone],
      [t('Secondary ICE Name'), profile.ice2_name],
      [t('Secondary ICE Rel'), profile.ice2_rel],
      [t('Secondary ICE Phone'), profile.ice2_phone],
    ];

    let csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.map(item => `"${(item || '').toString().replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Healthcare_Profile.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  const handleExportPDF = async (e) => {
    const btn = e.target;
    const originalText = btn.innerText;
    try {
      btn.innerText = `⏳ ${t('Generating...')}`;

      if (!window.jspdf) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js');
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      doc.setFontSize(22);
      doc.text(t('Healthcare AI - Profile Data'), 14, 20);

      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`${t('Generated on')}: ${new Date().toLocaleString()}`, 14, 28);

      const rows = [
        [t('Name'), profile.name || ''],
        [t('Age'), profile.age?.toString() || ''],
        [t('Gender'), profile.gender || ''],
        [t('Weight (kg)'), profile.weight?.toString() || ''],
        [t('Height (cm)'), profile.height?.toString() || ''],
        [t('Blood Type'), profile.blood_type || ''],
        [t('Allergies'), profile.allergies || ''],
        [t('Medical Conditions'), profile.conditions || ''],
        [t('Primary Emergency Contact'), `${profile.ice1_name || t('N/A')} (${profile.ice1_rel || t('N/A')})`],
        [t('Primary Emergency Phone'), profile.ice1_phone || t('N/A')]
      ];

      if (profile.ice2_name || profile.ice2_phone) {
        rows.push([t('Secondary Emergency Contact'), `${profile.ice2_name || t('N/A')} (${profile.ice2_rel || t('N/A')})`]);
        rows.push([t('Secondary Emergency Phone'), profile.ice2_phone || t('N/A')]);
      }

      doc.autoTable({
        startY: 35,
        head: [[t('Attribute'), t('Details')]],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 11, cellPadding: 5 }
      });

      doc.save('Healthcare_Profile.pdf');
    } catch (err) {
      console.error(err);
      toast.error(t('Failed to generate PDF'));
    } finally {
      btn.innerText = originalText;
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20 relative">
      {showZoom && profile.avatar_url && (
        <div className="fixed inset-0 bg-black/85 z-[9999] flex items-center justify-center cursor-zoom-out backdrop-blur-sm transition-opacity" onClick={() => setShowZoom(false)}>
          <img src={`http://localhost:8000${profile.avatar_url}`} alt="Avatar Zoom" className="max-w-[90vw] max-h-[90vh] rounded-3xl object-contain shadow-2xl" />
          <div className="absolute top-6 right-8 text-white text-4xl font-light hover:text-gray-300 transition-colors">&times;</div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-6 relative z-10 w-full">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
            <SettingsIcon size={32} />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1">{t('settings')}</h2>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
              {t('Manage your profile and preferences', 'Manage your profile and preferences')}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 w-fit">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'profile' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
        >
          <User size={18} /> {t('profile_tab')}
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'security' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
        >
          <Shield size={18} /> {t('security_tab')}
        </button>
        <button
          onClick={() => setActiveTab('advanced')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'advanced' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
        >
          <Target size={18} /> {t('advanced_tab')}
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'notifications' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
        >
          <Bell size={18} /> {t('Notifications')}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col gap-8">

            {/* Personal Information */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <User className="text-blue-500" /> {t('Personal Information')}
              </h3>

              <div className="flex items-center gap-6 mb-8 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                <div
                  className="relative w-24 h-24 rounded-full overflow-hidden bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-3xl font-bold cursor-pointer border-4 border-white dark:border-gray-800 shadow-md"
                  onClick={() => profile.avatar_url && setShowZoom(true)}
                >
                  {profile.avatar_url ? (
                    <img src={`http://localhost:8000${profile.avatar_url}`} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    profile.name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="font-bold text-gray-900 dark:text-white text-lg">{t('Profile Picture')}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{t('Click picture to zoom, or upload new')}</div>
                  <div className="flex gap-3 mt-2">
                    <label className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
                      <ImageIcon size={16} /> {t('Upload')}
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    </label>
                    {profile.avatar_url && (
                      <button
                        onClick={handleAvatarRemove}
                        className="inline-flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                      >
                        <Trash2 size={16} /> {t('Remove')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('Full Name')}</label>
                <input type="text" name="name" value={profile.name} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('Age')}</label>
                  <input type="number" name="age" value={profile.age} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('Gender')}</label>
                  <CustomSelect
                    name="gender"
                    value={profile.gender || ''}
                    onChange={handleChange}
                    options={[
                      { value: "Male", label: t('Male') },
                      { value: "Female", label: t('Female') },
                      { value: "Other", label: t('Other') }
                    ]}
                    className="!bg-gray-50 dark:!bg-gray-900 border border-gray-200 dark:border-gray-700 !font-normal !py-3 !shadow-none !text-gray-900 dark:!text-white !text-base"
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contacts */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <HeartPulse className="text-red-500" /> {t('Emergency Contacts (ICE)')}
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <input type="text" name="ice1_name" placeholder={t('Name')} value={profile.ice1_name} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                </div>
                <div>
                  <input type="text" name="ice1_rel" placeholder={t('Relationship')} value={profile.ice1_rel} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                </div>
              </div>
              <div className="mb-4">
                <input type="tel" name="ice1_phone" placeholder={t('Phone Number')} value={profile.ice1_phone} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
              </div>

              {showSecondaryContact && (
                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('Secondary Contact')}</h4>
                    <button onClick={() => { setShowSecondaryContact(false); setProfile(p => ({ ...p, ice2_name: '', ice2_rel: '', ice2_phone: '' })); }} className="text-red-500 hover:text-red-600 text-sm font-semibold flex items-center gap-1 transition-colors">
                      <X size={14} /> {t('Remove')}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <input type="text" name="ice2_name" placeholder={t('Name')} value={profile.ice2_name} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                    </div>
                    <div>
                      <input type="text" name="ice2_rel" placeholder={t('Relationship')} value={profile.ice2_rel} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                    </div>
                  </div>
                  <div>
                    <input type="tel" name="ice2_phone" placeholder={t('Phone Number')} value={profile.ice2_phone} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                  </div>
                </div>
              )}

              {!showSecondaryContact && (
                <button onClick={() => setShowSecondaryContact(true)} className="mt-4 w-full py-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <Plus size={18} /> {t('Add another contact')}
                </button>
              )}
            </div>

          </div>

          <div className="flex flex-col gap-8 h-full">

            {/* Medical Profile */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Activity className="text-rose-500" /> {t('Medical Profile')}
              </h3>
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('weight')} ({weightUnit})</label>
                  <input type="number" name="weight" value={profile.weight ? (unit === 'imperial' ? (profile.weight * 2.20462).toFixed(1) : profile.weight) : ''} onChange={(e) => handleChange({ target: { name: 'weight', value: unit === 'imperial' && e.target.value ? parseFloat(e.target.value) / 2.20462 : e.target.value } })} className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('height')} ({unit === 'imperial' ? 'inches' : 'cm'})</label>
                  <input type="number" name="height" value={profile.height ? (unit === 'imperial' ? (profile.height / 2.54).toFixed(1) : profile.height) : ''} onChange={(e) => handleChange({ target: { name: 'height', value: unit === 'imperial' && e.target.value ? parseFloat(e.target.value) * 2.54 : e.target.value } })} className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('Blood Type')}</label>
                  <CustomSelect
                    name="blood_type"
                    value={profile.blood_type || ''}
                    onChange={handleChange}
                    options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => ({ value: b, label: b }))}
                    className="!bg-gray-50 dark:!bg-gray-900 border border-gray-200 dark:border-gray-700 !font-normal !py-3 !shadow-none !text-gray-900 dark:!text-white !text-base"
                  />
                </div>
              </div>
              <div className="mb-5">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('Allergies (comma separated)')}</label>
                <input type="text" name="allergies" value={profile.allergies} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('Medical Conditions')}</label>
                <input type="text" name="conditions" value={profile.conditions} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
              </div>
            </div>

            {/* Data Management & Save */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <FileText className="text-indigo-500" /> {t('Data Management')}
              </h3>
              <div className="flex gap-4 mb-4">
                <button onClick={handleExportPDF} className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600">
                  <Download size={18} /> {t('Export PDF')}
                </button>
                <button onClick={handleExportExcel} className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600">
                  <Download size={18} /> {t('Export Excel')}
                </button>
              </div>
              <button onClick={() => confirm(t('Are you sure you want to reset all data?'))} className="w-full py-3 rounded-xl font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors border border-red-100 dark:border-red-900/50 mb-6">
                {t('Reset All Data')}
              </button>

              <button onClick={handleSave} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-all active:scale-[0.98]">
                <Save size={20} /> {t('Save All Changes')}
              </button>
            </div>

          </div>
        </div>
      )}

      {activeTab === 'advanced' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-8">
            {/* ── Advanced Health Goals ── */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Target className="text-emerald-500" /> {t('advanced_health_goals')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('target_weight')} ({weightUnit})</label>
                  <input type="number" name="target_weight" value={profile.target_weight ? (unit === 'imperial' ? (profile.target_weight * 2.20462).toFixed(1) : profile.target_weight) : ''} placeholder={`e.g. ${unit === 'imperial' ? '150' : '65'}`} onChange={(e) => handleChange({ target: { name: 'target_weight', value: unit === 'imperial' && e.target.value ? parseFloat(e.target.value) / 2.20462 : e.target.value } })} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('timeline')}</label>
                  <input type="text" name="target_weight_timeline" value={profile.target_weight_timeline || ''} placeholder="e.g. In 2 months" onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                </div>
              </div>

              <div className="mb-8">
                <button
                  onClick={handleAnalyzeGoal}
                  disabled={isAnalyzingGoal}
                  className="w-full py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold border border-indigo-100 dark:border-indigo-800/30 flex items-center justify-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAnalyzingGoal ? <div className="w-5 h-5 rounded-full border-2 border-indigo-600 dark:border-indigo-400 border-t-transparent animate-spin" /> : <Activity size={18} />}
                  {isAnalyzingGoal ? t('analyzing_goal') : t('generate_ai')}
                </button>

                {aiSuggestion && aiSuggestion.analysis && (
                  <div className="mt-4 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-xl text-gray-800 dark:text-gray-200 text-sm leading-relaxed shadow-inner">
                    <div className="flex items-center gap-2 mb-2 text-indigo-600 dark:text-indigo-400 font-bold">
                      <Activity size={16} /> {t('ai_prediction')}
                    </div>
                    {aiSuggestion.analysis}
                  </div>
                )}
              </div>

              <div className="mb-8 border-t border-gray-100 dark:border-gray-700 pt-8">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Activity className="text-orange-500" /> {t('activity_goals')}
                </h4>
                <div className="space-y-6">
                  <div>
                    <label className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      <span>{t('calorie_limit')} (Diet Intake)</span>
                      {aiSuggestion && aiSuggestion.suggested_calories && (
                        <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px]">
                          {t('ai_suggestion')}: {aiSuggestion.suggested_calories} kcal
                        </span>
                      )}
                    </label>
                    <input type="number" name="calorie_goal" value={profile.calorie_goal || ''} placeholder="e.g. 2000" onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{t('leave_blank_ai')}</p>
                  </div>
                  <div>
                    <label className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      <span>{t('step_goal')}</span>
                      {aiSuggestion && aiSuggestion.suggested_steps && (
                        <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px]">
                          {t('ai_suggestion')}: {aiSuggestion.suggested_steps} steps
                        </span>
                      )}
                    </label>
                    <input type="number" name="step_goal" value={profile.step_goal || ''} placeholder="10000" onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                  </div>
                </div>
              </div>

              <button onClick={handleSave} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-all active:scale-[0.98] mt-6">
                <Save size={20} /> {t('save_goals')}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-8">
            {/* ── Measurement Units ── */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Ruler className="text-purple-500" /> {t('measurement_units')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('measurement_units_desc')}</p>

              <div className="space-y-5">
                {/* Weight Toggle */}
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('weight_unit')}</p>
                  <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {[{ val: 'metric', label: 'KG (Metric)' }, { val: 'imperial', label: 'LBS (Imperial)' }].map(({ val, label }) => (
                      <button
                        key={val}
                        onClick={() => handleUnitChange(val)}
                        className={`px-5 py-2.5 text-sm font-bold transition-all ${unit === val
                          ? 'bg-purple-600 text-white shadow-inner'
                          : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Height Toggle */}
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('height_unit')}</p>
                  <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {[{ val: 'metric', label: 'CM (Metric)' }, { val: 'imperial', label: 'Feet/Inches (Imperial)' }].map(({ val, label }) => (
                      <button
                        key={val}
                        onClick={() => handleUnitChange(val)}
                        className={`px-5 py-2.5 text-sm font-bold transition-all ${unit === val
                          ? 'bg-purple-600 text-white shadow-inner'
                          : 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Preview */}
                <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('preview')}</p>
                  <div className="flex gap-6 text-sm">
                    <span className="text-gray-700 dark:text-gray-300">
                      ⚖️ {t('weight')}: <strong>{displayWeight(profile.weight).value} {displayWeight(profile.weight).label}</strong>
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">
                      📏 {t('height')}: <strong>{displayHeight(profile.height).value} {displayHeight(profile.height).label}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── App Language ── */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Globe className="text-blue-500" /> {t('app_language')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('app_language_desc')}</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { code: 'en', flag: 'EN', name: 'English', native: 'English' },
                  { code: 'hi', flag: 'HI', name: 'Hindi', native: 'हिन्दी' },
                  { code: 'gu', flag: 'GU', name: 'Gujarati', native: 'ગુજરાતી' },
                ].map(({ code, flag, name, native }) => (
                  <button
                    key={code}
                    onClick={() => handleLangChange(code)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all font-semibold text-sm ${lang === code
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 text-gray-700 dark:text-gray-300'
                      }`}
                  >
                    <span className="text-xl font-black tracking-wider">{flag}</span>
                    <span>{name}</span>
                    <span className={`text-xs font-normal ${lang === code ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>{native}</span>
                    {lang === code && <span className="w-2 h-2 rounded-full bg-blue-500 mt-0.5" />}
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="flex flex-col gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Bell className="text-amber-500" /> {t('Notification Preferences')}
            </h3>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
              {t('Customize how LifeOS alerts you for different events. SMS and Email alerts will be sent to your registered contact details.')}
            </p>

            {/* ── Push Notifications Registration ── */}
            <div className="mb-8 p-6 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30">
              <h4 className="font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                <Bell size={18} /> {t('Web Push Notifications')}
              </h4>
              <p className="text-sm text-red-600/80 dark:text-red-400/80 mb-4">
                {t('Receive medication and appointment alerts directly on your device, even when the app is closed.')}
              </p>
              
              <div className="flex flex-col gap-3 sm:flex-row">
                {profile.push_device_token ? (
                  <>
                    <button
                      onClick={async () => {
                        if(confirm(t('Are you sure you want to disable push notifications?'))) {
                           try {
                             await API.put('/users/me/device-token', { token: '' });
                             setProfile(p => ({ ...p, push_device_token: null }));
                             toast.success(t('Successfully unsubscribed from notifications.'));
                           } catch (e) {
                             toast.error(t('Failed to unsubscribe'));
                           }
                        }
                      }}
                      className="flex-1 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-red-600 rounded-xl font-bold border border-red-200 dark:border-red-800 transition-colors shadow-sm"
                    >
                      {t('Unsubscribe from Push')}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                           await API.post('/users/me/test-push');
                           toast.success(t('Test notification sent! It should appear momentarily.'));
                        } catch (e) {
                           toast.error(e?.message || t('Failed to send test push'));
                        }
                      }}
                      className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-sm active:scale-[0.98]"
                    >
                      {t('Send Test Notification')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        const OneSignal = window.OneSignal || window.OneSignalDeferred || [];
                        
                        if (OneSignal.Slidedown) {
                          await OneSignal.Slidedown.promptPush();
                        } else if (OneSignal.push) {
                          OneSignal.push(function() {
                            OneSignal.Slidedown.promptPush();
                          });
                        } else {
                           toast.error("OneSignal is not ready yet. Please refresh and try again.");
                           return;
                        }
                        
                        setTimeout(async () => {
                          const playerId = OneSignal.User ? OneSignal.User.PushSubscription.id : null;
                          if (playerId) {
                            try {
                              await API.put('/users/me/device-token', { token: playerId });
                              setProfile(p => ({ ...p, push_device_token: playerId }));
                              toast.success(t('Push notifications enabled successfully!'));
                            } catch (apiErr) {
                              toast.error(apiErr?.response?.data?.detail || t('Failed to save token to server'));
                            }
                          } else {
                            if (OneSignal.User && OneSignal.User.PushSubscription.optedIn === false) {
                               toast.error(t('Notifications are blocked in your browser settings. Please unblock them via the site settings icon in the URL bar.'));
                            } else {
                               toast.error(t('Could not retrieve device token from OneSignal. Ensure notifications are allowed.'));
                            }
                          }
                        }, 3000);
                        
                      } catch (e) {
                        toast.error(e.message || t('Failed to enable push notifications'));
                      }
                    }}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-sm active:scale-[0.98]"
                  >
                    {t('Subscribe to Push Notifications')}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-8">
              {/* Medicine Reminders */}
              <div className="border-b border-gray-100 dark:border-gray-700/50 pb-6">
                <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">💊 {t('Medicine Reminders')}</h4>
                <div className="flex flex-col gap-4">
                  {['email', 'sms', 'app'].map(type => (
                    <div key={`med-${type}`} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{t(type + ' Notifications')}</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={profile.notification_preferences?.medicine?.[type] ?? false} onChange={(e) => {
                          const newPrefs = {
                            ...profile.notification_preferences,
                            medicine: { ...(profile.notification_preferences?.medicine || {}), [type]: e.target.checked }
                          };
                          setProfile(p => ({ ...p, notification_preferences: newPrefs }));
                          API.put('/users/profile', { notification_preferences: newPrefs }).catch(() => toast.error('Failed to save preference'));
                        }} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Appointment Alerts */}
              <div className="border-b border-gray-100 dark:border-gray-700/50 pb-6">
                <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">📅 {t('Appointment Alerts')}</h4>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('App Notifications')}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={profile.notification_preferences?.appointment?.app ?? false} onChange={(e) => {
                        const newPrefs = {
                          ...profile.notification_preferences,
                          appointment: { ...(profile.notification_preferences?.appointment || {}), app: e.target.checked }
                        };
                        setProfile(p => ({ ...p, notification_preferences: newPrefs }));
                        API.put('/users/profile', { notification_preferences: newPrefs }).catch(() => toast.error('Failed to save preference'));
                      }} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('SMS to Emergency Contact')}</span>
                      <span className="text-xs text-gray-500">{t('Alerts emergency contact of upcoming appointments')}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={profile.notification_preferences?.appointment?.emergency_sms ?? false} onChange={(e) => {
                        const newPrefs = {
                          ...profile.notification_preferences,
                          appointment: { ...(profile.notification_preferences?.appointment || {}), emergency_sms: e.target.checked }
                        };
                        setProfile(p => ({ ...p, notification_preferences: newPrefs }));
                        API.put('/users/profile', { notification_preferences: newPrefs }).catch(() => toast.error('Failed to save preference'));
                      }} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Inactivity/Fitness Alerts */}
              <div className="pb-2">
                <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">🏃 {t('Inactivity & Fitness Alerts')}</h4>
                <div className="flex flex-col gap-4">
                  {['email', 'app'].map(type => (
                    <div key={`fit-${type}`} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{t(type + ' Notifications')}</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={profile.notification_preferences?.fitness?.[type] ?? false} onChange={(e) => {
                          const newPrefs = {
                            ...profile.notification_preferences,
                            fitness: { ...(profile.notification_preferences?.fitness || {}), [type]: e.target.checked }
                          };
                          setProfile(p => ({ ...p, notification_preferences: newPrefs }));
                          API.put('/users/profile', { notification_preferences: newPrefs }).catch(() => toast.error('Failed to save preference'));
                        }} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="flex flex-col gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <ShieldAlert className="text-emerald-500" /> {t('Security Settings')}
            </h3>

            {/* Face Login Row */}
            <div className="flex items-center justify-between py-5 border-b border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${faceLoginEnabled ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                  <ScanFace size={24} />
                </div>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">{t('Face Login')}</div>
                  <div className={`text-sm ${faceLoginEnabled ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    {faceLoginEnabled ? t('✅ Enabled — your face is enrolled') : t('Biometric auth · Not configured')}
                  </div>
                </div>
              </div>
              {faceLoginEnabled ? (
                <div className="flex gap-2">
                  <button onClick={handleOpenFaceSetup} className="px-4 py-2 rounded-xl text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 transition-colors">{t('Re-scan')}</button>
                  <button onClick={handleFaceDisable} className="px-4 py-2 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 transition-colors">{t('Disable')}</button>
                </div>
              ) : (
                <button onClick={handleOpenFaceSetup} className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors">{t('Setup')}</button>
              )}
            </div>

            {/* 2FA Row */}
            <div className="flex items-center justify-between py-5 border-b border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${twoFactorEnabled ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                  <Shield size={24} />
                </div>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">{t('Two-Factor Authentication')}</div>
                  <div className={`text-sm ${twoFactorEnabled ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    {twoFactorEnabled ? t('✅ Enabled — Authenticator App') : t('Additional security layer · Not configured')}
                  </div>
                </div>
              </div>
              {twoFactorEnabled ? (
                <button onClick={async () => {
                  if (confirm(t('Are you sure you want to disable 2FA?'))) {
                    try {
                      await API.post('/auth/2fa/disable');
                      setTwoFactorEnabled(false);
                      toast.success(t('2FA Disabled.'));
                    } catch (e) { toast.error(t('Failed to disable 2FA')); }
                  }
                }} className="px-4 py-2 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 transition-colors">{t('Disable')}</button>
              ) : (
                <button onClick={async () => {
                  try {
                    const res = await API.get('/auth/2fa/setup');
                    setTwoFactorSecret(res.data.secret);
                    setTwoFactorUri(res.data.uri);
                    setTwoFactorSetupOpen(true);
                  } catch (e) { toast.error(t('Failed to setup 2FA')); }
                }} className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors">{t('Setup')}</button>
              )}
            </div>

            {/* Login Alerts Row */}
            <div className="flex items-center justify-between py-5 border-b border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${loginAlertsEnabled ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                  <Bell size={24} />
                </div>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">{t('Login Email Alerts')}</div>
                  <div className={`text-sm ${loginAlertsEnabled ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    {loginAlertsEnabled ? t('✅ Enabled — Receiving alerts for new logins') : t('Alerts are paused')}
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={loginAlertsEnabled} onChange={async () => {
                  try {
                    const res = await API.put('/users/security/alerts-toggle');
                    setLoginAlertsEnabled(res.data.login_alerts_enabled);
                  } catch (e) { toast.error('Failed'); }
                }} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Login History */}
            <div className="py-5">
              <h4 className="font-bold text-gray-900 dark:text-white mb-4">{t('Recent Logins')}</h4>
              {loginHistory.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('No recent logins found.')}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {loginHistory.slice(0, 2).map(h => (
                    <div key={h.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{h.ip_address}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={h.user_agent}>{h.user_agent}</span>
                      </div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">{new Date(h.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                  {loginHistory.length > 2 && (
                    <button onClick={() => setShowAllLoginsModal(true)} className="text-sm font-bold text-blue-600 hover:text-blue-700 mt-2 self-start transition-colors">
                      {t('Show more login history...')}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Blockchain */}
            <div className="flex items-center justify-between py-5 opacity-60">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-400">
                  <Share2 size={24} />
                </div>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">{t('Blockchain Sync')}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{t('Tamper-proof medical records')}</div>
                </div>
              </div>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-lg uppercase tracking-wider">{t('Coming Soon')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Login History Modal Overlay */}
      {showAllLoginsModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) setShowAllLoginsModal(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">🕒 {t('Recent Logins')}</h3>
              <button onClick={() => setShowAllLoginsModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2">
              {loginHistory.map(h => (
                <div key={h.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{h.ip_address}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={h.user_agent}>{h.user_agent}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">{new Date(h.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        , document.body)}

      {/* 2FA Setup Modal */}
      {twoFactorSetupOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) setTwoFactorSetupOpen(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">📱 {t('Setup 2FA')}</h3>
              <button onClick={() => setTwoFactorSetupOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <X size={24} />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {t('Scan this QR code with an Authenticator app (like Google Authenticator or Authy), then enter the 6-digit code below.')}
            </p>
            <div className="flex justify-center mb-6">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 inline-block">
                {twoFactorUri && <QRCodeSVG value={twoFactorUri} size={180} />}
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-4 text-center break-all">
              {t('Manual key')}: <strong className="text-gray-600 dark:text-gray-300">{twoFactorSecret}</strong>
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await API.post('/auth/2fa/verify-setup', { code: twoFactorCode });
                setTwoFactorEnabled(true);
                setTwoFactorSetupOpen(false);
                toast.success(t('2FA Enabled successfully!'));
              } catch (err) {
                toast.error(t('Invalid code. Please try again.'));
              }
            }}>
              <input type="text" value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} placeholder={t('6-digit code')} maxLength={6} required className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow mb-4 text-center tracking-[0.25em] text-lg font-bold" />
              <button type="submit" className="w-full py-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors">{t('Verify & Enable')}</button>
            </form>
          </div>
        </div>
        , document.body)}

      {/* Face Setup Modal */}
      {faceSetupOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) handleCloseFaceSetup(); }}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${faceCaptureStatus === 'success' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                  <ScanFace size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {faceCaptureStatus === 'success' ? t('Face Enrolled!') : t('Set Up Face Login')}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('Biometric authentication')}</p>
                </div>
              </div>
              <button onClick={handleCloseFaceSetup} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <X size={24} />
              </button>
            </div>

            {faceCaptureStatus !== 'success' && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {t('Position your face in the center of the frame with good lighting, then click ')} <strong>{t('"Capture & Enroll"')}</strong>.
              </p>
            )}

            <div className={`w-full h-72 bg-gray-900 rounded-2xl overflow-hidden relative flex justify-center items-center mb-6 border-4 ${faceCaptureStatus === 'success' ? 'border-green-500' : faceCaptureStatus === 'error' ? 'border-red-500' : 'border-blue-500/30'}`}>
              <video ref={videoRef} autoPlay muted playsInline className="h-full scale-x-[-1]" />

              {faceCaptureStatus === 'scanning' && (
                <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                  <span className="bg-black/60 text-white px-4 py-2 rounded-xl font-bold animate-pulse">🔍 {t('Detecting face…')}</span>
                </div>
              )}
              {faceCaptureStatus === 'success' && (
                <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                  <span className="bg-black/60 text-white px-6 py-3 rounded-xl font-bold text-lg shadow-lg">✅ {t('Face Saved Successfully!')}</span>
                </div>
              )}
              {(faceLoading || faceCaptureStatus === 'loading') && (
                <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center text-white text-sm gap-3 font-medium">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  {t('Loading AI models & camera…')}
                </div>
              )}
            </div>

            {faceCaptureStatus !== 'success' && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCaptureFace}
                  disabled={faceLoading || faceCaptureStatus === 'scanning' || faceCaptureStatus === 'loading'}
                  className={`flex-1 py-4 rounded-xl font-bold text-white shadow-sm transition-colors ${faceLoading || faceCaptureStatus === 'scanning' ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {faceCaptureStatus === 'scanning' ? t('Scanning…') : t('📸 Capture & Enroll Face')}
                </button>
                <button
                  type="button"
                  onClick={handleCloseFaceSetup}
                  className="px-6 py-4 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('Cancel')}
                </button>
              </div>
            )}

            {faceCaptureStatus === 'success' && (
              <p className="text-center text-sm font-bold text-green-600 dark:text-green-400">
                {t('You can now use Face Login on the sign-in screen! ✨')}
              </p>
            )}
          </div>
        </div>
        , document.body)}

    </div>
  );
};

export default Settings;
