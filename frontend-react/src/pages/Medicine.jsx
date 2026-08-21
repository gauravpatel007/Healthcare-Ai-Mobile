import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import API from '../utils/api';
import { useLang } from '../contexts/LangContext';
import { toast } from 'react-hot-toast';
import editIcon from '../../../Icons/edit sign.png';
import {
  CheckCircle2,
  Activity,
  X,
  Pill,
  CheckCircle,
  AlertTriangle,
  Plus,
  Camera,
  ShieldAlert,
  Edit,
  Trash2,
  Clock,
  Calendar,
  Info,
  Box,
  Syringe,
  Droplet,
  FlaskConical,
  Circle,
  Pipette,
  Disc
} from 'lucide-react';
import CustomSelect from '../components/ui/CustomSelect';

const ScoredTablet = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <ellipse cx="12" cy="8" rx="10" ry="5" />
    <path d="M2 8v5c0 2.76 4.48 5 10 5s10-2.24 10-5V8" />
    <line x1="6" y1="4" x2="18" y2="12" />
  </svg>
);

const formatInteractionText = (text) => {
  if (!text) return null;
  const lines = text.split('\n');

  return lines.map((line, lineIndex) => {
    const cleanLine = line.replace(/^\*\s*/, '').trim();
    if (!cleanLine) return null;

    if (!cleanLine.includes('**')) {
      const colonIndex = cleanLine.indexOf(':');
      if (colonIndex > 0 && colonIndex < 80) {
        const heading = cleanLine.substring(0, colonIndex);
        const rest = cleanLine.substring(colonIndex + 1).trim();
        const isMed = !heading.toLowerCase().includes('precautions') && !heading.toLowerCase().includes('side effects');
        
        if (isMed) {
          return (
            <div key={lineIndex} className="mb-4 last:mb-0 text-sm md:text-base text-rose-900 dark:text-rose-200 leading-relaxed">
              <strong className="text-base md:text-lg font-extrabold text-rose-800 dark:text-rose-300 block mb-2 pb-1 border-b border-rose-200/60 dark:border-rose-800/50">
                {heading}
              </strong>
              <span>{rest}</span>
            </div>
          );
        } else {
          return (
            <div key={lineIndex} className="mb-2 last:mb-0 text-sm md:text-base text-rose-900 dark:text-rose-200 leading-relaxed">
              <strong className="font-bold text-rose-950 dark:text-rose-100 mr-1">
                {heading}:
              </strong>
              <span>{rest}</span>
            </div>
          );
        }
      }
    }
    
    const parts = cleanLine.split(/(\*\*.*?\*\*)/g);

    return (
      <div key={lineIndex} className="mb-2 last:mb-0 text-sm md:text-base text-rose-900 dark:text-rose-200 leading-relaxed">
        {parts.map((part, partIndex) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const boldText = part.slice(2, -2);
            if (partIndex === 1 && cleanLine.startsWith('**') && !boldText.endsWith(':')) {
              return <strong key={partIndex} className="text-base md:text-lg font-extrabold text-rose-800 dark:text-rose-300 block mb-2 pb-1 border-b border-rose-200/60 dark:border-rose-800/50">{boldText}</strong>;
            }
            
            const isSubHeading = boldText.toLowerCase().includes('side effects') || boldText.toLowerCase().includes('precautions');
            return [
              (partIndex > 1 && isSubHeading) ? <div key={`br-${partIndex}`} className="h-3 w-full"></div> : null,
              <strong key={partIndex} className="font-bold text-rose-950 dark:text-rose-100 mr-1">{boldText}</strong>
            ];
          }
          if (partIndex === 2 && cleanLine.startsWith('**')) {
            let p = part;
            if (p.startsWith(' - ')) p = p.substring(3);
            else if (p.startsWith('- ')) p = p.substring(2);
            else if (p.startsWith(' – ')) p = p.substring(3);
            return <span key={partIndex}>{p}</span>;
          }
          return <span key={partIndex}>{part}</span>;
        })}
      </div>
    );
  });
};

const Medicine = ({ voiceAction, onVoiceActionConsumed }) => {
  const { t, lang } = useLang();
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
  const [medicines, setMedicines] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editMedicine, setEditMedicine] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [newMedicine, setNewMedicine] = useState({
    name: '', dosage: '', type: 'tablet', frequency: 'once_daily', purpose: '', times: ['08:00'], total_pills: 30, remaining: 30, start_date: new Date().toISOString().split('T')[0]
  });
  const [isScanning, setIsScanning] = useState(false);
  const [showInteractionsModal, setShowInteractionsModal] = useState(false);
  const [interactionsData, setInteractionsData] = useState([]);

  // Listen for voice actions
  useEffect(() => {
    if (voiceAction && voiceAction.target_feature === 'medicine') {
      if (voiceAction.action_name === 'open_add_modal') {
        setShowAddForm(true);
      } else if (voiceAction.action_name === 'fill_form' && voiceAction.data) {
        setShowAddForm(true);
        setNewMedicine(prev => ({
          ...prev,
          ...(voiceAction.data.name && { name: voiceAction.data.name }),
          ...(voiceAction.data.dosage && { dosage: voiceAction.data.dosage }),
          ...(voiceAction.data.type && { type: voiceAction.data.type }),
          ...(voiceAction.data.frequency && { frequency: voiceAction.data.frequency }),
          ...(voiceAction.data.purpose && { purpose: voiceAction.data.purpose }),
        }));
      } else if (voiceAction.action_name === 'edit_medicine' && voiceAction.data?.name) {
        const medName = voiceAction.data.name.toLowerCase();
        const targetMed = medicines.find(m => m.name.toLowerCase().includes(medName));
        if (targetMed) {
          openEditModal(targetMed);
        } else {
          toast.error(t('Could not find medicine ') + voiceAction.data.name);
        }
      } else if (voiceAction.action_name === 'check_interactions') {
        checkInteractions();
      }
      if (onVoiceActionConsumed) onVoiceActionConsumed();
    }
  }, [voiceAction]);

  const typeIcon = {
    tablet: <ScoredTablet className="w-7 h-7" />,
    capsule: <Pill className="w-7 h-7" />,
    syrup: <FlaskConical className="w-7 h-7" />,
    injection: <Syringe className="w-7 h-7" />,
    drops: <Droplet className="w-7 h-7" />,
    cream: <Box className="w-7 h-7" />
  };

  const typeColor = {
    tablet: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    capsule: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    syrup: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    injection: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
    drops: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
    cream: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
  };

  const fetchData = async () => {
    try {
      const [meds, preds] = await Promise.all([
        API.get('/medicines'),
        API.get('/medicines/refill-predictions')
      ]);
      setMedicines(meds || []);
      setPredictions(preds || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const deleteMedicine = async (id) => {
    if (window.confirm(t('Remove this medicine?'))) {
      try {
        await API.delete(`/medicines/${id}`);
        setMedicines(medicines.filter(m => m.id !== id));
      } catch (e) {
        toast.error(t('Failed to delete medicine'));
      }
    }
  };

  const openEditModal = (med) => {
    setEditMedicine({ ...med });
    setShowEditForm(true);
  };

  const handleUpdateMedicine = async () => {
    if (!editMedicine.name || !editMedicine.dosage) {
      toast.error(t('Name and dosage are required'));
      return;
    }
    try {
      const updated = await API.request(`/medicines/${editMedicine.id}`, {
        method: 'PUT',
        body: editMedicine
      });
      setMedicines(medicines.map(m => m.id === updated.id ? updated : m));
      setShowEditForm(false);
      setEditMedicine(null);
      toast.success(t('Medicine updated'));
    } catch (e) {
      toast.error(t('Failed to update medicine'));
    }
  };

  const checkInteractions = async () => {
    try {
      const res = await API.get('/medicines/interactions');
      if (res.has_interactions && res.warnings && res.warnings.length > 0) {
        setInteractionsData(res.warnings);
        setShowInteractionsModal(true);
      } else {
        toast.success(`✅ ${t('No Interactions Found')}\n\n${t('Your current medications appear safe to take together.')}`);
      }
    } catch (e) {
      toast.error(t('Failed to check interactions'));
    }
  };

  const handleSaveMedicine = async () => {
    if (!newMedicine.name || !newMedicine.dosage) {
      toast.error(t('Name and dosage are required'));
      return;
    }
    try {
      const added = await API.post('/medicines', newMedicine);
      setMedicines([added, ...medicines]);
      setShowAddForm(false);
      setShowAddForm(false);
      setNewMedicine({ name: '', dosage: '', type: 'tablet', frequency: 'once_daily', purpose: '', times: ['08:00'], total_pills: 30, remaining: 30, start_date: new Date().toISOString().split('T')[0] });
      toast.success(t('Medicine saved'));
    } catch (e) {
      toast.error(t('Failed to save medicine'));
    }
  };

  const handleScanPill = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const base64data = canvas.toDataURL('image/jpeg', 0.8);

          try {
            const res = await API.post('/vision/analyze', {
              image_data: base64data,
              scan_type: 'pill'
            });
            if (res && res.data) {
              setNewMedicine(prev => ({
                ...prev,
                name: res.data.name,
                purpose: res.data.purpose,
              }));
              setShowAddForm(true);

              setScanResult({
                type: 'success',
                title: 'Pill Analyzed Successfully! 💊',
                data: res.data
              });
            } else {
              setScanResult({
                type: 'error',
                title: 'Scan Failed',
                message: "Could not analyze the pill. Please try again."
              });
            }
          } catch (error) {
            console.error(error);
            setScanResult({
              type: 'error',
              title: 'Scan Failed',
              message: error.response?.data?.detail || error.message || "Could not analyze the pill. Please try again."
            });
          } finally {
            setIsScanning(false);
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsScanning(false);
    }
    e.target.value = null;
  };

  const getNumTimes = (frequency) => {
    if (frequency === 'twice_daily') return 2;
    if (frequency === 'thrice_daily') return 3;
    return 1;
  };

  const renderTimeInputs = (medicine, setMedicine) => {
    const num = getNumTimes(medicine.frequency);
    let times = Array.isArray(medicine.times) && medicine.times.length ? medicine.times : ['08:00'];

    const currentTimes = Array.from({ length: num }, (_, i) => {
      if (times[i]) return times[i];
      if (i > 0 && times[i - 1]) {
        let [h, m] = times[i - 1].split(':').map(Number);
        h = (h + 4) % 24;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      }
      if (i === 2) return '20:00';
      return '08:00';
    });

    return (
      <div className="col-span-full">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('Time(s)')}</label>
        <div className={`grid gap-4 ${num === 1 ? 'grid-cols-1' : num === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {currentTimes.map((time, index) => (
            <div key={index} className="flex flex-col">
              {num > 1 && <span className="text-xs text-gray-500 mb-1">{t('Dose')} {index + 1}</span>}
              <input
                type="time"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white"
                value={time}
                onChange={e => {
                  let val = e.target.value;
                  if (!val) return;

                  const newTimes = [...currentTimes];
                  newTimes[index] = val;

                  if (index > 0 && newTimes[index] <= newTimes[index - 1]) {
                    toast.error(t(`Dose ${index + 1} must be after Dose ${index}`));
                    return;
                  }

                  for (let i = index + 1; i < newTimes.length; i++) {
                    if (newTimes[i] <= newTimes[i - 1]) {
                      let [h, m] = newTimes[i - 1].split(':').map(Number);
                      h = (h + 1) % 24;
                      newTimes[i] = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    }
                  }

                  setMedicine({ ...medicine, times: newTimes });
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) return <div className="empty-state"><span className="spinner"></span> {t('Loading Medicines...')}</div>;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20 relative">

      {/* Scan Result Modal */}
      {scanResult && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-300">
            <div className={`p-6 text-center ${scanResult.type === 'success' ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${scanResult.type === 'success' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-800 dark:text-indigo-300' : 'bg-red-100 text-red-600 dark:bg-red-800 dark:text-red-300'}`}>
                {scanResult.type === 'success' ? <CheckCircle2 className="w-8 h-8" /> : <Activity className="w-8 h-8" />}
              </div>
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">{scanResult.title}</h3>
              {scanResult.type === 'error' && (
                <p className="text-gray-600 dark:text-gray-300 font-medium">{scanResult.message}</p>
              )}
            </div>

            {scanResult.type === 'success' && scanResult.data && (
              <div className="p-6 space-y-4">
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4">
                  <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-1">{scanResult.data.name}</h4>
                  <p className="text-indigo-600 dark:text-indigo-400 font-medium text-sm">{scanResult.data.purpose}</p>
                </div>

                {scanResult.data.common_interactions && scanResult.data.common_interactions.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/50">
                    <div className="flex items-center gap-2 mb-2 text-amber-800 dark:text-amber-400 font-bold text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      {t('Warnings & Interactions')}
                    </div>
                    <ul className="text-sm text-amber-700 dark:text-amber-500 space-y-1 pl-6 list-disc">
                      {scanResult.data.common_interactions.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="p-6 pt-2">
              <button
                onClick={() => setScanResult(null)}
                className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors"
              >
                {t('Continue to Add Form')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-hidden w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Pill className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              {t('Medicine Management')}
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse shrink-0"></span>
              {medicines.length} {t('active medications')}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 relative z-10 shrink-0 ml-auto pr-2 flex-wrap">
          <label className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-md hover:bg-gray-800 dark:hover:bg-white hover:shadow-lg cursor-pointer ${isScanning ? 'opacity-80 cursor-wait' : ''}`}>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanPill} disabled={isScanning} />
            {isScanning ? (
              <>
                <Clock className="w-4 h-4 animate-spin shrink-0" />
                <span className="whitespace-nowrap">{t('Scanning...')}</span>
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">{t('Scan Pill')}</span>
              </>
            )}
          </label>
          <button
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            onClick={checkInteractions}
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">{t('Check Interactions')}</span>
          </button>
          <button
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:shadow-lg"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">{t('Add Medicine')}</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500 opacity-10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1 tracking-wide uppercase">{t('Active')}</p>
              <h3 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight leading-tight">{medicines.length}</h3>
            </div>
            <div className="p-4 bg-purple-500 bg-opacity-10 dark:bg-opacity-20 rounded-2xl shadow-sm transition-transform duration-300 ease-out group-hover:scale-125 text-purple-600 dark:text-purple-400">
              <Pill className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm font-semibold text-gray-500 relative z-10">
            {t('Medications')}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 opacity-10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1 tracking-wide uppercase">{t('Well Stocked')}</p>
              <h3 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight leading-tight">{medicines.filter(m => m.remaining > 5).length}</h3>
            </div>
            <div className="p-4 bg-emerald-500 bg-opacity-10 dark:bg-opacity-20 rounded-2xl shadow-sm transition-transform duration-300 ease-out group-hover:scale-125 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm font-semibold text-emerald-600 dark:text-emerald-400 relative z-10">
            <span className="bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-lg">{t('Healthy Supply')}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500 opacity-10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1 tracking-wide uppercase">{t('Refill Soon')}</p>
              <h3 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight leading-tight">{medicines.filter(m => m.remaining <= 5).length}</h3>
            </div>
            <div className="p-4 bg-rose-500 bg-opacity-10 dark:bg-opacity-20 rounded-2xl shadow-sm transition-transform duration-300 ease-out group-hover:scale-125 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm font-semibold text-rose-600 dark:text-rose-400 relative z-10">
            <span className="bg-rose-50 dark:bg-rose-900/30 px-2.5 py-1 rounded-lg">{t('Requires Attention')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {medicines.length > 0 ? medicines.map(m => {
          const pct = m.remaining && m.total_pills ? (m.remaining / m.total_pills) * 100 : 100;
          return (
            <div key={m.id} className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 opacity-[0.03] dark:opacity-[0.05] rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 pointer-events-none"></div>

              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${typeColor[m.type] || 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400'}`}>
                    {typeIcon[m.type] || <Pill className="w-7 h-7" />}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight mb-1">{m.name}</h4>
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {m.dosage} • <span className="capitalize">{m.type}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditModal(m)} className="p-2.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Edit Medicine">
                    <Edit className="w-5 h-5" />
                  </button>
                  <button onClick={() => deleteMedicine(m.id)} className="p-2.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="Delete Medicine">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-grow mb-5 relative z-10">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-4">{m.purpose}</p>
                <div className="flex justify-between items-center mb-4">
                  <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-100 dark:border-gray-600">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="capitalize">{t(m.frequency.replace('_', ' '))}</span>
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${pct > 40 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : pct > 20 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                    {m.remaining} {t('pills left')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(m.times || []).map(tm => (
                    <span key={tm} className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-2.5 py-1 rounded-lg text-xs font-bold border border-indigo-100 dark:border-indigo-800">
                      <Clock className="w-3 h-3" />
                      {tm}
                    </span>
                  ))}
                </div>
                {m.start_date && (
                  <p className="text-xs text-gray-400 mt-4 font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {t('Started')}: {m.start_date}
                  </p>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-gray-800 rounded-[2.5rem] border border-dashed border-gray-200 dark:border-gray-700">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 rounded-full flex items-center justify-center mb-4">
              <Pill className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">{t('No Medicines Added')}</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">{t('Track your medications, set reminders, and never miss a dose.')}</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all bg-indigo-600 text-white shadow-md hover:bg-indigo-700 hover:shadow-lg"
            >
              <Plus className="w-4 h-4" />
              {t('Add Medicine')}
            </button>
          </div>
        )}
      </div>

      {predictions.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shadow-sm">
              <Box className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{t('Refill Predictions')}</h2>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {predictions.map((p, i) => {
                const med = medicines.find(m => m.id === p.medicine_id);
                const pType = med ? med.type : 'tablet';
                return (
                  <div key={i} className="flex flex-col gap-4 p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all group">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform ${typeColor[pType] || 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400'}`}>
                        {typeIcon[pType] || <Pill className="w-6 h-6" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white truncate leading-tight">{p.medicine_name}</h4>
                        <span className={`px-2.5 py-1 inline-block mt-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${p.days_left > 10 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : p.days_left > 5 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                          ~{p.days_left} {t('days left')}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        {p.remaining} {t('of')} {p.total_pills} {t('pills remaining')}
                      </p>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${p.percentage > 40 ? 'bg-emerald-500' : p.percentage > 20 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${p.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {showAddForm && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) setShowAddForm(false) }}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Pill className="w-6 h-6 text-indigo-500" /> {t('Add Medicine')}
              </h3>
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors" onClick={() => setShowAddForm(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('Medicine Name')}</label>
                  <input type="text" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white" value={newMedicine.name} onChange={e => setNewMedicine({ ...newMedicine, name: e.target.value })} placeholder="e.g., Paracetamol" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('Dosage')}</label>
                  <input type="text" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white" value={newMedicine.dosage} onChange={e => setNewMedicine({ ...newMedicine, dosage: e.target.value })} placeholder="e.g., 500mg" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('Type')}</label>
                  <CustomSelect
                    value={newMedicine.type}
                    onChange={e => setNewMedicine({ ...newMedicine, type: e.target.value })}
                    options={[
                      { value: "tablet", label: t('Tablet') },
                      { value: "capsule", label: t('Capsule') },
                      { value: "syrup", label: t('Syrup') },
                      { value: "injection", label: t('Injection') },
                      { value: "drops", label: t('Drops') },
                      { value: "cream", label: t('Cream') }
                    ]}
                    className="!bg-gray-50 dark:!bg-gray-900 border border-gray-200 dark:border-gray-700 !font-normal !py-3 !shadow-none !text-gray-900 dark:!text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('Frequency')}</label>
                  <CustomSelect
                    value={newMedicine.frequency}
                    onChange={e => setNewMedicine({ ...newMedicine, frequency: e.target.value })}
                    options={[
                      { value: "once_daily", label: t('Once daily') },
                      { value: "twice_daily", label: t('Twice daily') },
                      { value: "thrice_daily", label: t('Thrice daily') },
                      { value: "once_weekly", label: t('Once weekly') },
                      { value: "as_needed", label: t('As needed') }
                    ]}
                    className="!bg-gray-50 dark:!bg-gray-900 border border-gray-200 dark:border-gray-700 !font-normal !py-3 !shadow-none !text-gray-900 dark:!text-white"
                  />
                </div>
              </div>
              {renderTimeInputs(newMedicine, setNewMedicine)}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('Purpose')}</label>
                <input type="text" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white" value={newMedicine.purpose} onChange={e => setNewMedicine({ ...newMedicine, purpose: e.target.value })} placeholder="What is this medicine for?" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('Total Pills')}</label>
                  <input type="number" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white" value={newMedicine.total_pills} onChange={e => setNewMedicine({ ...newMedicine, total_pills: parseInt(e.target.value) || 0, remaining: parseInt(e.target.value) || 0 })} placeholder="30" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('Remaining')}</label>
                  <input type="number" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white" value={newMedicine.remaining} onChange={e => setNewMedicine({ ...newMedicine, remaining: parseInt(e.target.value) || 0 })} placeholder="30" />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 shrink-0">
              <button className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" onClick={() => setShowAddForm(false)}>{t('Cancel')}</button>
              <button className="px-5 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition-all hover:shadow-lg" onClick={handleSaveMedicine}>{t('Save Medicine')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showEditForm && editMedicine && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) setShowEditForm(false) }}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Edit className="w-6 h-6 text-indigo-500" /> {t('Edit Medicine')}
              </h3>
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors" onClick={() => setShowEditForm(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('Medicine Name')}</label>
                  <input type="text" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white" value={editMedicine.name} onChange={e => setEditMedicine({ ...editMedicine, name: e.target.value })} placeholder="e.g., Paracetamol" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('Dosage')}</label>
                  <input type="text" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white" value={editMedicine.dosage} onChange={e => setEditMedicine({ ...editMedicine, dosage: e.target.value })} placeholder="e.g., 500mg" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('Type')}</label>
                  <CustomSelect
                    value={editMedicine.type}
                    onChange={e => setEditMedicine({ ...editMedicine, type: e.target.value })}
                    options={[
                      { value: "tablet", label: t('Tablet') },
                      { value: "capsule", label: t('Capsule') },
                      { value: "syrup", label: t('Syrup') },
                      { value: "injection", label: t('Injection') },
                      { value: "drops", label: t('Drops') },
                      { value: "cream", label: t('Cream') }
                    ]}
                    className="!bg-gray-50 dark:!bg-gray-900 border border-gray-200 dark:border-gray-700 !font-normal !py-3 !shadow-none !text-gray-900 dark:!text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('Frequency')}</label>
                  <CustomSelect
                    value={editMedicine.frequency}
                    onChange={e => setEditMedicine({ ...editMedicine, frequency: e.target.value })}
                    options={[
                      { value: "once_daily", label: t('Once daily') },
                      { value: "twice_daily", label: t('Twice daily') },
                      { value: "thrice_daily", label: t('Thrice daily') },
                      { value: "once_weekly", label: t('Once weekly') },
                      { value: "as_needed", label: t('As needed') }
                    ]}
                    className="!bg-gray-50 dark:!bg-gray-900 border border-gray-200 dark:border-gray-700 !font-normal !py-3 !shadow-none !text-gray-900 dark:!text-white"
                  />
                </div>
              </div>
              {renderTimeInputs(editMedicine, setEditMedicine)}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('Purpose')}</label>
                <input type="text" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white" value={editMedicine.purpose || ''} onChange={e => setEditMedicine({ ...editMedicine, purpose: e.target.value })} placeholder="What is this medicine for?" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('Total Pills')}</label>
                  <input type="number" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white" value={editMedicine.total_pills || 0} onChange={e => setEditMedicine({ ...editMedicine, total_pills: parseInt(e.target.value) || 0 })} placeholder="30" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('Remaining')}</label>
                  <input type="number" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white" value={editMedicine.remaining || 0} onChange={e => setEditMedicine({ ...editMedicine, remaining: parseInt(e.target.value) || 0 })} placeholder="30" />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 shrink-0">
              <button className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" onClick={() => setShowEditForm(false)}>{t('Cancel')}</button>
              <button className="px-5 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition-all hover:shadow-lg" onClick={handleUpdateMedicine}>{t('Update Medicine')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {showInteractionsModal && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) setShowInteractionsModal(false) }}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0 bg-rose-50 dark:bg-rose-900/20">
              <h3 className="text-xl font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6" /> {t('Interactions Found')}
              </h3>
              <button className="p-2 text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-full transition-colors" onClick={() => setShowInteractionsModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {interactionsData.map((w, i) => (
                <div key={i} className="p-5 bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/50 rounded-2xl">
                  <div className="font-sans text-sm md:text-base text-rose-900 dark:text-rose-200 leading-relaxed">
                    {formatInteractionText(w.description)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default Medicine;
