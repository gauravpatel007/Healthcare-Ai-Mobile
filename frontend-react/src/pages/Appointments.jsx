import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import API from '../utils/api';
import { useLang } from '../contexts/LangContext';
import { toast } from 'react-hot-toast';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Sparkles, 
  CheckCircle2, 
  Trash2, 
  Bot, 
  Plus, 
  X,
  Stethoscope,
  ActivitySquare,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import CustomSelect from '../components/ui/CustomSelect';

const Appointments = ({ voiceAction, onVoiceActionConsumed }) => {
  const { lang, t } = useLang();
  const [appointments, setAppointments] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [prepModal, setPrepModal] = useState({ isOpen: false, aptId: null });
  const [viewPrepModal, setViewPrepModal] = useState({ isOpen: false, text: '', aptId: null });
  const [prepSymptoms, setPrepSymptoms] = useState('');
  const [isPrepping, setIsPrepping] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const prevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  // Listen for voice actions
  useEffect(() => {
    if (voiceAction && voiceAction.target_feature === 'appointments') {
      if (voiceAction.action_name === 'open_add_modal') {
        setShowForm(true);
      } else if (voiceAction.action_name === 'fill_form' && voiceAction.data) {
        setShowForm(true);
        setNewApt(prev => ({
          ...prev,
          ...(voiceAction.data.doctor && { doctor: voiceAction.data.doctor }),
          ...(voiceAction.data.specialty && { specialty: voiceAction.data.specialty }),
          ...(voiceAction.data.hospital && { hospital: voiceAction.data.hospital }),
          ...(voiceAction.data.date && { date: voiceAction.data.date }),
          ...(voiceAction.data.time && { time: voiceAction.data.time }),
          ...(voiceAction.data.notes && { notes: voiceAction.data.notes }),
        }));
      } else if (voiceAction.action_name === 'ai_prep' && voiceAction.data?.doctor) {
        const docName = voiceAction.data.doctor.toLowerCase().replace('dr.', '').trim();
        const targetApt = appointments.find(a => a.doctor.toLowerCase().includes(docName));
        if (targetApt) {
          setPrepModal({ isOpen: true, aptId: targetApt.id });
        } else {
          toast.error(t('Could not find appointment for ') + voiceAction.data.doctor);
        }
      }
      if (onVoiceActionConsumed) onVoiceActionConsumed();
    }
  }, [voiceAction]);
  
  const [newApt, setNewApt] = useState({
    doctor: '',
    specialty: 'General Physician',
    hospital: '',
    date: '',
    time: '10:00',
    notes: ''
  });

  const fetchData = async () => {
    try {
      const [apts, suggs] = await Promise.all([
        API.get('/appointments'),
        API.get('/appointments/suggestions')
      ]);
      setAppointments(apts || []);
      setSuggestions(suggs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Stretch layout to fill empty right panel space
    const appContainer = document.querySelector('.app-container');
    const rightPanel = document.querySelector('.right-panel');
    if (appContainer && rightPanel) {
      appContainer.style.gridTemplateColumns = 'var(--sidebar-width) 1fr';
      rightPanel.style.display = 'none';
    }
    
    return () => {
      // Restore layout on unmount
      if (appContainer && rightPanel) {
        appContainer.style.gridTemplateColumns = 'var(--sidebar-width) 1fr var(--right-panel-width)';
        rightPanel.style.display = 'flex'; 
      }
    };
  }, []);

  const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date();
    // Append T00:00:00 to force local timezone parsing instead of UTC parsing
    return new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  };

  const today = new Date(new Date().setHours(0,0,0,0));
  const now = new Date();
  
  const isPast = (a) => {
    if (a.status !== 'upcoming') return true;
    const d = parseLocalDate(a.date);
    if (d < today) return true;
    if (d.getTime() === today.getTime() && a.time) {
      const aptTime = new Date(`${a.date}T${a.time}`);
      if (aptTime < now) return true;
    }
    return false;
  };

  const upcoming = appointments.filter(a => !isPast(a)).sort((a, b) => 
    new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`)
  );
  const past = appointments.filter(a => isPast(a)).map(a => 
    (a.status === 'upcoming' && isPast(a)) ? { ...a, status: 'completed' } : a
  ).sort((a, b) => 
    new Date(`${b.date}T${b.time || '00:00'}`) - new Date(`${a.date}T${a.time || '00:00'}`)
  );

  const getDaysUntil = (dateStr) => {
    const aptDate = parseLocalDate(dateStr);
    const timeDiff = aptDate.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  };

  const handleAdd = async () => {
    if (!newApt.doctor || !newApt.date) {
      toast.error(t('Please fill in doctor and date'));
      return;
    }
    try {
      const added = await API.post('/appointments', { ...newApt, status: 'upcoming' });
      setAppointments([...appointments, added]);
      setShowForm(false);
      setNewApt({ doctor: '', specialty: 'General Physician', hospital: '', date: '', time: '10:00', notes: '' });
      toast.success(t('Appointment added successfully'));
    } catch (e) {
      console.error("Failed to add appointment:", e);
      toast.error(t('Failed to add appointment: ') + (e.message || 'Unknown error'));
    }
  };

  const markCompleted = async (id) => {
    try {
      await API.put(`/appointments/${id}`, { status: 'completed' });
      setAppointments(appointments.map(a => a.id === id ? { ...a, status: 'completed' } : a));
      toast.success(t('Appointment marked as completed'));
    } catch (e) {
      toast.error(t('Failed to update status'));
    }
  };

  const deleteApt = async (id) => {
    if (window.confirm(t('Are you sure you want to delete this appointment?'))) {
      try {
        await API.delete(`/appointments/${id}`);
        setAppointments(appointments.filter(a => a.id !== id));
        toast.success(t('Appointment deleted'));
      } catch (e) {
        toast.error(t('Failed to delete'));
      }
    }
  };

  const renderMarkdown = (text) => {
    if (!text) return null;
    return (
      <div className="flex flex-col gap-3 text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed">
        {text.split('\n').map((line, i) => {
          if (!line.trim()) return null;
          let formattedLine = line.replace(/^\*\s/, '• ');
          formattedLine = formattedLine.replace(/^- /, '• ');
          
          const boldParts = formattedLine.split(/(\*\*.*?\*\*)/g);
          
          return (
            <div key={i}>
              {boldParts.map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={j} className="text-gray-900 dark:text-white font-bold">{part.slice(2, -2)}</strong>;
                }
                return part;
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const handleGeneratePrep = async () => {
    if (!prepModal.aptId) return;
    setIsPrepping(true);
    try {
      const updatedApt = await API.post(`/appointments/${prepModal.aptId}/prep`, { symptoms: prepSymptoms, language: 'en' });
      setAppointments(appointments.map(a => a.id === updatedApt.id ? updatedApt : a));
      setPrepModal({ isOpen: false, aptId: null });
      setPrepSymptoms('');
      toast.success(t('AI Preparation generated!'));
    } catch (e) {
      console.error(e);
      toast.error(t('Failed to generate prep questions: ') + (e.message || 'Unknown error'));
    } finally {
      setIsPrepping(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-hidden w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <CalendarIcon className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              {t("Appointment Manager")}
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse shrink-0"></span>
              {upcoming.length} {t("upcoming appointments")}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 relative z-10 shrink-0 ml-auto pr-2">
          <button 
            onClick={() => setShowForm(true)} 
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-base transition-all bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 shadow-sm hover:shadow-md"
          >
            <Plus className="w-5 h-5 shrink-0" />
            <span className="whitespace-nowrap">{t("New Appointment")}</span>
          </button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Upcoming Card */}
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 relative overflow-hidden group cursor-pointer">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 opacity-10 dark:opacity-20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1 tracking-wide uppercase">{t("Upcoming")}</p>
              <h3 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{upcoming.length}</h3>
            </div>
            <div className="p-4 text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-2xl shadow-sm transition-transform duration-300 ease-out group-hover:scale-125">
              <CalendarIcon className="w-7 h-7" style={{ color: 'currentColor' }} />
            </div>
          </div>
          <div className="mt-5 flex items-center text-sm">
            <span className="font-semibold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-3 py-1 rounded-full">{t("Scheduled")}</span>
          </div>
        </div>

        {/* Completed Card */}
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 relative overflow-hidden group cursor-pointer">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 opacity-10 dark:opacity-20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1 tracking-wide uppercase">{t("Completed")}</p>
              <h3 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{past.length}</h3>
            </div>
            <div className="p-4 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-2xl shadow-sm transition-transform duration-300 ease-out group-hover:scale-125">
              <CheckCircle2 className="w-7 h-7" style={{ color: 'currentColor' }} />
            </div>
          </div>
          <div className="mt-5 flex items-center text-sm">
            <span className="font-semibold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-3 py-1 rounded-full">{t("Past visits")}</span>
          </div>
        </div>

        {/* Hospitals Card */}
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 relative overflow-hidden group cursor-pointer">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500 opacity-10 dark:opacity-20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1 tracking-wide uppercase">{t("Hospitals")}</p>
              <h3 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{[...new Set(appointments.map(a => a.hospital))].length}</h3>
            </div>
            <div className="p-4 text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400 rounded-2xl shadow-sm transition-transform duration-300 ease-out group-hover:scale-125">
              <MapPin className="w-7 h-7" style={{ color: 'currentColor' }} />
            </div>
          </div>
          <div className="mt-5 flex items-center text-sm">
            <span className="font-semibold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-3 py-1 rounded-full">{t("Locations")}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          {/* Upcoming Appointments */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-blue-500" /> {t("Upcoming")}
            </h3>
            
            <div className="space-y-4">
              {upcoming.length > 0 ? upcoming.map(a => {
                const d = parseLocalDate(a.date);
                const daysUntil = getDaysUntil(a.date);
                return (
                  <div key={a.id} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row items-center justify-between gap-5 hover:shadow-md hover:-translate-y-0.5 transition-all w-full">
                    
                    {/* Date Flap & Details Container */}
                    <div className="flex flex-row items-center gap-5 flex-1 min-w-0">
                      {/* Date Flap */}
                      <div className="flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-blue-50 dark:bg-blue-900/30 rounded-xl shrink-0">
                        <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 leading-none">{d.getDate()}</span>
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mt-1">{d.toLocaleDateString(lang, { month: 'short', year: 'numeric' })}</span>
                      </div>
                      
                      {/* Details */}
                      <div className="flex-1 text-left min-w-0">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1 truncate">{t("Dr.")} {a.doctor}</h4>
                        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2 truncate">{t(a.specialty)}</p>
                        
                        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1.5 truncate"><MapPin className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{a.hospital}</span></span>
                          <span className="flex items-center gap-1.5 shrink-0"><Clock className="w-3.5 h-3.5 shrink-0" /> {a.time}</span>
                        </div>
                        
                        {a.notes && (
                          <div className="mt-3 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700 flex items-start gap-2">
                            <ActivitySquare className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                            <span className="truncate max-w-[250px] sm:max-w-md">{a.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col items-center justify-center gap-3 shrink-0 w-48 border-gray-100 dark:border-gray-700">
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold w-full text-center ${
                        daysUntil <= 3 
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {daysUntil === 0 ? t('Today') : daysUntil === 1 ? t('Tomorrow') : `${daysUntil} ${t('days')}`}
                      </span>
                      
                      <div className="flex flex-col gap-2 w-full">
                        {a.ai_prep_notes ? (
                          <button 
                            onClick={() => setViewPrepModal({ isOpen: true, text: a.ai_prep_notes, aptId: a.id })} 
                            className="flex-1 flex items-center justify-center gap-1.5 w-full bg-cyan-50 hover:bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:hover:bg-cyan-900/40 dark:text-cyan-400 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                          >
                            <Bot className="w-4 h-4" /> {t("View AI Prep")}
                          </button>
                        ) : (
                          <button 
                            onClick={() => setPrepModal({ isOpen: true, aptId: a.id })} 
                            className="flex-1 flex items-center justify-center gap-1.5 w-full border border-cyan-200 hover:border-cyan-300 hover:bg-cyan-50 text-cyan-600 dark:border-cyan-900/50 dark:hover:bg-cyan-900/30 dark:text-cyan-400 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                          >
                            <Sparkles className="w-4 h-4" /> {t("AI Prep")}
                          </button>
                        )}
                        
                        <div className="flex gap-2 flex-1">
                          <button onClick={() => markCompleted(a.id)} className="flex-1 flex items-center justify-center bg-gray-50 hover:bg-emerald-50 text-gray-500 hover:text-emerald-600 dark:bg-gray-800 dark:hover:bg-emerald-900/20 border border-gray-200 dark:border-gray-700 py-1.5 rounded-lg transition-colors">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteApt(a.id)} className="flex-1 flex items-center justify-center bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-600 dark:bg-gray-800 dark:hover:bg-red-900/20 border border-gray-200 dark:border-gray-700 py-1.5 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-10 shadow-sm border border-gray-100 dark:border-gray-700 text-center flex flex-col items-center justify-center">
                  <CalendarIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium">{t("No upcoming appointments. Schedule one now!")}</p>
                </div>
              )}
            </div>
          </div>

          {/* Past Appointments */}
          {past.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 opacity-70">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" /> {t("Past")}
              </h3>
              <div className="space-y-4 opacity-70">
                {past.map(a => {
                  const d = parseLocalDate(a.date);
                  return (
                    <div key={a.id} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row items-center justify-between gap-5 grayscale-[30%] text-left w-full">
                      <div className="flex flex-row items-center gap-5 flex-1 min-w-0">
                        <div className="flex flex-col items-center justify-center w-16 h-16 bg-gray-50 dark:bg-gray-900/50 rounded-xl shrink-0">
                          <span className="text-xl font-black text-gray-600 dark:text-gray-400 leading-none">{d.getDate()}</span>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-1">{d.toLocaleDateString(lang, { month: 'short' })}</span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-3 mb-1">
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white truncate max-w-[200px]">{t("Dr.")} {a.doctor}</h4>
                            <span className="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold shrink-0">{t("Completed")}</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 truncate">{t(a.specialty)}</p>
                          
                          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-400">
                            <span className="flex items-center gap-1.5 truncate"><MapPin className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{a.hospital}</span></span>
                            <span className="flex items-center gap-1.5 shrink-0"><Clock className="w-3.5 h-3.5 shrink-0" /> {a.time}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="shrink-0 w-32">
                         <button onClick={() => deleteApt(a.id)} className="w-full flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-600 dark:bg-gray-900 dark:hover:bg-red-900/20 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors">
                           <Trash2 className="w-4 h-4 shrink-0" /> {t("Delete")}
                         </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Right Sidebar: Suggestions */}
        <div className="space-y-6">
          {/* Calendar Widget */}
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 lg:p-7 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-500" />
                {calendarDate.toLocaleString(lang, { month: 'long', year: 'numeric' })}
              </h4>
              <div className="flex gap-1">
                <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider py-1">
                  {t(day)}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfMonth(calendarDate.getFullYear(), calendarDate.getMonth()) }).map((_, i) => (
                <div key={`empty-${i}`} className="h-8"></div>
              ))}
              
              {Array.from({ length: daysInMonth(calendarDate.getFullYear(), calendarDate.getMonth()) }).map((_, i) => {
                const day = i + 1;
                const d = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
                // Check if there is an appointment on this date
                const hasApt = appointments.some(a => {
                  const aptDate = parseLocalDate(a.date);
                  return aptDate.getFullYear() === d.getFullYear() && 
                         aptDate.getMonth() === d.getMonth() && 
                         aptDate.getDate() === d.getDate();
                });
                
                const isToday = day === today.getDate() && 
                                calendarDate.getMonth() === today.getMonth() && 
                                calendarDate.getFullYear() === today.getFullYear();
                                
                return (
                  <div key={day} className="flex justify-center items-center h-8 sm:h-10">
                    <div className={`relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                      isToday ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 
                      hasApt ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800' :
                      'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer'
                    }`}>
                      {day}
                      {hasApt && !isToday && (
                        <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full border border-white dark:border-gray-800"></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/10 dark:to-blue-900/10 border border-cyan-100 dark:border-cyan-900/30 rounded-[2rem] p-6 lg:p-8 shadow-sm">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Bot className="w-6 h-6 text-cyan-500" /> {t("AI Suggestions")}
            </h4>
            
            <div className="space-y-4">
              {suggestions.map((s, i) => (
                <div key={i} className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl p-4 border border-white/40 dark:border-gray-700/50 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">{t(s.specialist)}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.urgency.toLowerCase() === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      s.urgency.toLowerCase() === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {t(s.urgency)}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300 leading-relaxed">
                    {t(s.text)}
                  </p>
                </div>
              ))}
              {suggestions.length === 0 && (
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 text-center py-4">{t("No suggestions right now. You're up to date!")}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Appointment Modal */}
      {showForm && createPortal(
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setShowForm(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-500" /> {t("New Appointment")}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-1.5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t("Doctor Name")}</label>
                <input 
                  type="text" 
                  value={newApt.doctor} 
                  onChange={(e) => setNewApt({...newApt, doctor: e.target.value})} 
                  placeholder={t("e.g. Smith")}
                  className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white text-gray-900"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t("Specialty")}</label>
                  <CustomSelect
                    value={newApt.specialty}
                    onChange={(e) => setNewApt({...newApt, specialty: e.target.value})}
                    options={[
                      "General Physician", "Cardiologist", "Pulmonologist",
                      "Dermatologist", "Orthopedic", "ENT",
                      "Ophthalmologist", "Dentist", "Neurologist",
                      "Gynecologist", "Pediatrician", "Psychiatrist",
                      "Other"
                    ].map(s => ({ value: s, label: t(s) }))}
                    className="!bg-gray-50 dark:!bg-gray-900/50 border border-gray-200 dark:border-gray-700 !py-3 !shadow-none !text-gray-900 dark:!text-white !text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t("Hospital / Clinic")}</label>
                  <input 
                    type="text" 
                    value={newApt.hospital} 
                    onChange={(e) => setNewApt({...newApt, hospital: e.target.value})} 
                    placeholder={t("Location")} 
                    className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white text-gray-900"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t("Date")}</label>
                  <input 
                    type="date" 
                    value={newApt.date} 
                    onChange={(e) => setNewApt({...newApt, date: e.target.value})} 
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t("Time")}</label>
                  <input 
                    type="time" 
                    value={newApt.time} 
                    onChange={(e) => setNewApt({...newApt, time: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white text-gray-900"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t("Notes (Optional)")}</label>
                <textarea 
                  value={newApt.notes} 
                  onChange={(e) => setNewApt({...newApt, notes: e.target.value})} 
                  placeholder={t("Reason for visit, symptoms to mention...")}
                  rows="3"
                  className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none dark:text-white text-gray-900"
                ></textarea>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">{t("Cancel")}</button>
              <button onClick={handleAdd} className="px-6 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition-colors">{t("Save Appointment")}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* AI Prep Generation Modal */}
      {prepModal.isOpen && createPortal(
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => !isPrepping && setPrepModal({ isOpen: false, aptId: null })}
        >
          <div 
            className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-cyan-100 dark:border-cyan-900/30 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-500" /> {t("AI Prep Assistant")}
                </h3>
                <button onClick={() => !isPrepping && setPrepModal({ isOpen: false, aptId: null })} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 rounded-full p-1.5 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-xl border border-cyan-100 dark:border-cyan-900/30 mb-5 flex gap-3">
                <Info className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-cyan-800 dark:text-cyan-300 leading-relaxed">
                  {t("The AI will analyze your health profile and recent logs to draft relevant questions for your doctor, helping you make the most of your visit.")}
                </p>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t("Specific symptoms or concerns? (Optional)")}</label>
                <textarea 
                  value={prepSymptoms} 
                  onChange={(e) => setPrepSymptoms(e.target.value)} 
                  placeholder={t("e.g., I've been having headaches every morning...")}
                  disabled={isPrepping}
                  rows="3"
                  className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all resize-none dark:text-white disabled:opacity-50"
                ></textarea>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setPrepModal({ isOpen: false, aptId: null })} disabled={isPrepping} className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50">{t("Cancel")}</button>
              <button onClick={handleGeneratePrep} disabled={isPrepping} className="px-6 py-2.5 rounded-xl font-bold text-sm bg-cyan-600 hover:bg-cyan-700 text-white shadow-md shadow-cyan-600/20 transition-all flex items-center gap-2 disabled:opacity-70">
                {isPrepping ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> {t("Generating...")}</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> {t("Generate Prep")}</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* View AI Prep Modal */}
      {viewPrepModal.isOpen && createPortal(
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setViewPrepModal({ isOpen: false, text: '', aptId: null })}
        >
          <div 
            className="bg-white dark:bg-gray-800 w-full max-w-2xl max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 shrink-0">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-cyan-500" /> {t("AI Prepared Notes")}
              </h3>
              <button onClick={() => setViewPrepModal({ isOpen: false, text: '', aptId: null })} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-1.5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar">
              {renderMarkdown(viewPrepModal.text)}
            </div>
            
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center shrink-0">
              <button onClick={() => {
                const id = viewPrepModal.aptId;
                setViewPrepModal({ isOpen: false, text: '', aptId: null });
                setPrepModal({ isOpen: true, aptId: id });
              }} className="px-4 py-2.5 rounded-xl font-bold text-sm text-cyan-700 bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-900/20 dark:text-cyan-400 dark:hover:bg-cyan-900/40 transition-colors flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> {t("Regenerate")}
              </button>
              <button onClick={() => setViewPrepModal({ isOpen: false, text: '', aptId: null })} className="px-8 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition-colors">
                {t("Got it")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Appointments;
