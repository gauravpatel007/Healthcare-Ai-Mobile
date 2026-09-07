import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';
import { toast } from 'react-hot-toast';
import {
  Activity, HeartPulse, Flame, Target, Calendar,
  Stethoscope, FileText, Pill, Plus, ArrowRight,
  TrendingUp, Droplet, Moon, Link, Dumbbell, UtensilsCrossed, Check, Sparkles, Brain, ChevronDown
} from 'lucide-react';
import { useLang } from '../contexts/LangContext';
import { useUnit } from '../contexts/UnitContext';
import CustomSelect from '../components/ui/CustomSelect';
import { useReminders, recordDose, refreshReminders } from '../utils/reminders';
import { MedicineDoseCard, MedicineActionDialog } from '../components/MedicineShared';

/* ─── Reusable Card (Matches AdminUI) ──────────── */
const StatCard = ({ title, value, subtitle, icon: Icon, colorClass, onClick }) => (
  <div
    onClick={onClick}
    tabIndex={0}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e); } }}
    className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-[2rem] p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 relative overflow-hidden group cursor-pointer focus:outline-none"
  >
    <div className={`absolute top-0 right-0 w-32 h-32 ${colorClass} opacity-10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110`}></div>
    <div className="flex items-start justify-between relative z-10">
      <div>
        <p className="text-xs md:text-sm font-bold text-gray-500 dark:text-gray-400 mb-1 tracking-wide uppercase">{title}</p>
        <h3 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{value}</h3>
      </div>
      <div className={`p-4 ${colorClass} bg-opacity-10 dark:bg-opacity-20 rounded-2xl shadow-sm transition-transform duration-300 ease-out group-hover:scale-125`}>
        <Icon className="w-7 h-7" style={{ color: 'currentColor' }} />
      </div>
    </div>
    <div className="mt-5 flex items-center text-sm">
      <span className="font-semibold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-3 py-1 rounded-full">
        {subtitle}
      </span>
    </div>
  </div>
);

/* ─── Section Header ─────────────────────────────────────────── */
const SectionHeader = ({ title, subtitle, className = "mb-4" }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div className="w-1.5 h-6 md:h-8 bg-gradient-to-b from-blue-500 to-indigo-400 rounded-full"></div>
    <div>
      <h2 className="text-lg md:text-xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{title}</h2>
      {subtitle && <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm font-medium">{subtitle}</p>}
    </div>
  </div>
);

const DashboardOverview = ({ currentUser, voiceAction, onVoiceActionConsumed }) => {
  const navigate = useNavigate();
  const { t } = useLang();
  const { displayWeight, weightUnit, toStorageWeight } = useUnit();
  const [loading, setLoading] = useState(true);

  const [healthData, setHealthData] = useState({});
  const [fitnessStats, setFitnessStats] = useState({});
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [nutritionPlan, setNutritionPlan] = useState(null);
  const [recentRecords, setRecentRecords] = useState([]);
  const [myMeds, setMyMeds] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [todayMedLogs, setTodayMedLogs] = useState([]);

  const [isSharing, setIsSharing] = useState(false);
  const [sharedLink, setSharedLink] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // States for interactive components
  const [activeParam, setActiveParam] = useState('weight'); // 'weight', 'bp', 'pulse'
  const [paramTimeframe, setParamTimeframe] = useState('thisMonth'); // '6months', '3months', 'thisMonth'
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [aptTimeframe, setAptTimeframe] = useState('today'); // 'today', 'week'

  const [showParamModal, setShowParamModal] = useState(false);
  const [newParam, setNewParam] = useState({ category: 'weight', value: '', secondary_value: '' });
  const [savingParam, setSavingParam] = useState(false);

  // Medicine reminder states
  const { data: reminderData } = useReminders();
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState('');
  const [quantity, setQuantity] = useState(30);
  const [busy, setBusy] = useState(false);

  const action = async (d, status, opts) => {
    if (busy) return;
    setBusy(true);
    try {
      await recordDose(d, status, opts);
      setDialog(null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runDialogAction = async (fn) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (voiceAction && voiceAction.target_feature === 'dashboard') {
      if (voiceAction.action_name === 'share_doctor_summary') {
        if (!isSharing && !sharedLink) {
          handleShareSummary();
        }
        if (onVoiceActionConsumed) onVoiceActionConsumed();
      } else if (voiceAction.action_name === 'change_param_view') {
        const p = voiceAction.data?.param;
        const tf = voiceAction.data?.timeframe;
        if (p && ['weight', 'bp', 'pulse'].includes(p)) {
          setActiveParam(p);
        }
        if (tf && ['6months', '3months', 'thisMonth'].includes(tf)) {
          setParamTimeframe(tf);
        }
        if (onVoiceActionConsumed) onVoiceActionConsumed();
      } else if (voiceAction.action_name === 'refresh_data') {
        API.get('/medicines/today-logs').then(res => setTodayMedLogs(res || [])).catch(err => console.error(err));
        API.get('/trackers/health-data').then(res => setHealthData(res || {})).catch(err => console.error(err));
        API.get('/dashboard/summary').then(res => setDashboardSummary(res)).catch(err => console.error(err));
        if (onVoiceActionConsumed) onVoiceActionConsumed();
      }
    }
  }, [voiceAction]);

  const handleSaveParam = async () => {
    if (!newParam.value) return;
    setSavingParam(true);
    try {
      const payload = {
        category: newParam.category,
        value: newParam.category === 'weight' ? toStorageWeight(parseFloat(newParam.value)) : parseFloat(newParam.value),
        label: new Date().toLocaleDateString('en-US', { month: 'short' })
      };
      if (newParam.category === 'blood_pressure') {
        payload.secondary_value = parseFloat(newParam.secondary_value) || 80;
      }

      await API.post('/trackers/health-entry', payload);

      // Refresh health data for chart
      const hData = await API.get('/trackers/health-data');
      setHealthData(hData || {});

      setNewParam({ category: 'weight', value: '', secondary_value: '' });
      toast.success('Parameter saved successfully');
    } catch (error) {
      console.error('Failed to save parameter:', error);
      toast.error('Failed to save parameter');
    } finally {
      setSavingParam(false);
    }
  };

  const handleShareSummary = async () => {
    setIsSharing(true);
    try {
      const res = await API.post('/share/generate');
      const link = `${window.location.origin}/shared/${res.token}`;
      setSharedLink(link);

      try {
        await navigator.clipboard.writeText(link);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 5000);
        toast.success('Sharing link generated and copied to clipboard!');
      } catch (err) {
        toast.success('Sharing link generated');
      }
    } catch (e) {
      toast.error('Failed to generate sharing link.');
    } finally {
      setIsSharing(false);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [d, records, meds, apts, medLogs] = await Promise.all([
          API.get('/dashboard/summary').catch(() => null),
          API.get('/records').catch(() => []),
          API.get('/medicines').catch(() => []),
          API.get('/appointments').catch(() => []),
          API.get('/medicines/today-logs').catch(() => [])
        ]);
        setDashboardSummary(d);
        setHealthData({});
        setFitnessStats({ steps: 0, calories_burned: 0, step_goal: 10000 });
        setNutritionPlan({ tdee: 2200, protein_goal_grams: 84, carbs_goal_grams: 200, fat_goal_grams: 60 });
        setRecentRecords(records ? records.slice(0, 3) : []);
        setMyMeds(meds ? meds.filter(m => m.is_active) : []);
        setAppointments(apts || []);
        setTodayMedLogs(medLogs || []);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (loading || !window.Chart) return;

    let labels = [];
    let datasets = [];

    const getAggregatedData = (records, extractor, paramType) => {
      const getEmptyState = () => {
        const dummyLabels = paramTimeframe === 'thisMonth'
          ? ['Week 1', 'Week 2', 'Week 3', 'Week 4']
          : paramTimeframe === '3months' ? ['Month 1', 'Month 2', 'Month 3'] : ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'];
        const count = paramTimeframe === '3months' ? 3 : paramTimeframe === 'thisMonth' ? 4 : 6;
        return { labels: dummyLabels.slice(-count), data: Array(count).fill(null) };
      };

      if (!records || records.length === 0) return getEmptyState();

      const now = new Date();
      let cutoffDate = new Date();

      if (paramTimeframe === 'thisMonth') {
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1); // Start of this month
      } else if (paramTimeframe === '3months') {
        cutoffDate.setMonth(now.getMonth() - 3);
      } else {
        cutoffDate.setMonth(now.getMonth() - 6);
      }

      const filteredRecords = records.filter(r => new Date(r.recorded_at || r.date) >= cutoffDate);

      if (filteredRecords.length === 0) return getEmptyState();

      filteredRecords.sort((a, b) => new Date(a.recorded_at || a.date) - new Date(b.recorded_at || b.date));

      // Aggregate by day, keeping only the last entered value
      const dailyMap = new Map();
      filteredRecords.forEach(r => {
        const d = new Date(r.recorded_at || r.date);
        const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dailyMap.set(dateKey, r); // Later chronological entries overwrite earlier ones for the same day
      });
      const uniqueDailyRecords = Array.from(dailyMap.values());

      const labels = uniqueDailyRecords.map(r => {
        const d = new Date(r.recorded_at || r.date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });

      const data = uniqueDailyRecords.map(r => extractor(r));

      if (labels.length === 1) {
        labels.unshift('Start');
        data.unshift(data[0]);
      }

      return { labels, data };
    };

    if (activeParam === 'weight') {
      const { labels: l, data: weightDataRaw } = getAggregatedData(healthData.weight, r => r.value, 'weight');
      labels = l || [];
      const weightData = weightDataRaw.map(w => w ? displayWeight(w).raw : null);
      const fatData = weightData.map(w => w ? w * 0.25 : null);
      datasets = [
        { label: 'Weight', data: weightData },
        { label: '% Fat', data: fatData }
      ];
    } else if (activeParam === 'bp') {
      const { labels: l, data: sysData } = getAggregatedData(healthData.blood_pressure, r => r.systolic || r.value, 'sys');
      labels = l || [];
      const { data: diaData } = getAggregatedData(healthData.blood_pressure, r => r.diastolic || r.secondary_value || 80, 'dia');
      datasets = [
        { label: 'Systolic', data: sysData },
        { label: 'Diastolic', data: diaData }
      ];
    } else if (activeParam === 'pulse') {
      const { labels: l, data: pulseData } = getAggregatedData(healthData.heart_rate, r => r.value, 'pulse');
      labels = l || [];
      datasets = [
        { label: 'Heart Rate', data: pulseData }
      ];
    }

    setTimeout(() => {
      const ctx = document.getElementById('params-chart');
      if (ctx && window.myChartInstance) {
        window.myChartInstance.destroy();
      }
      if (ctx) {
        const canvasCtx = ctx.getContext('2d');

        const createGradient = (colorRGB) => {
          const gradient = canvasCtx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, `rgba(${colorRGB}, 0.5)`);
          gradient.addColorStop(1, `rgba(${colorRGB}, 0.0)`);
          return gradient;
        };

        datasets.forEach((ds, i) => {
          let rgb, hex;

          if (activeParam === 'pulse') {
            rgb = '239, 68, 68'; // Red
            hex = '#ef4444';
          } else if (activeParam === 'bp') {
            if (i === 0) {
              rgb = '249, 115, 22'; // Orange for Systolic
              hex = '#f97316';
            } else {
              rgb = '139, 92, 246'; // Violet for Diastolic
              hex = '#8b5cf6';
            }
          } else {
            // Weight
            const isPrimary = i === 0;
            rgb = isPrimary ? '6, 182, 212' : '59, 130, 246'; // Cyan vs Blue
            hex = isPrimary ? '#06b6d4' : '#3b82f6';
          }

          ds.borderColor = hex;
          ds.backgroundColor = createGradient(rgb);
          ds.borderWidth = 4;
          ds.tension = 0.45; // Smooth curves!
          ds.pointBackgroundColor = '#ffffff';
          ds.pointBorderColor = hex;
          ds.pointBorderWidth = 2;
          ds.pointRadius = 3;
          ds.pointHoverRadius = 5;
          ds.fill = true;
        });

        window.myChartInstance = new window.Chart(ctx, {
          type: 'line',
          data: { labels, datasets },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                position: 'top', align: 'end',
                labels: {
                  usePointStyle: true, pointStyle: 'circle', padding: window.innerWidth < 768 ? 10 : 20, boxWidth: window.innerWidth < 768 ? 8 : 12,
                  font: { family: "'Inter', sans-serif", weight: '600', size: window.innerWidth < 768 ? 10 : 12 }, color: '#64748b'
                }
              },
              tooltip: {
                backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff',
                titleColor: '#9ca3af',
                titleFont: { family: "'Inter', sans-serif", weight: '500', size: 12 },
                bodyColor: document.documentElement.classList.contains('dark') ? '#f3f4f6' : '#111827',
                bodyFont: { family: "'Inter', sans-serif", weight: '700', size: 13 },
                padding: 12,
                cornerRadius: 12,
                borderColor: document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                borderWidth: 1,
                displayColors: false,
                callbacks: {
                  title: function (context) { return context[0].label; },
                  label: function (context) {
                    let label = context.dataset.label || '';
                    if (label) label += ': ';
                    if (context.parsed.y !== null) {
                      label += context.parsed.y;
                      const l = label.toLowerCase();
                      if (l.includes('weight')) label += ` ${weightUnit}`;
                      else if (l.includes('heart') || l.includes('bpm')) label += ' bpm';
                      else if (l.includes('blood') || l.includes('systolic') || l.includes('diastolic')) label += ' mmHg';
                    }
                    return label;
                  }
                }
              }
            },
            scales: {
              x: {
                grid: { display: false, drawBorder: false },
                ticks: { font: { family: "'Inter', sans-serif", weight: '500' }, color: '#94a3b8', maxTicksLimit: window.innerWidth < 768 ? 5 : 10, maxRotation: window.innerWidth < 768 ? 45 : 0 }
              },
              y: {
                grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false, borderDash: [5, 5] },
                ticks: { font: { family: "'Inter', sans-serif", weight: '500' }, color: '#94a3b8', padding: 10 },
                beginAtZero: false
              }
            }
          }
        });
      }
    }, 50);
  }, [loading, healthData, activeParam, paramTimeframe]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('greeting_morning') || 'Good Morning';
    if (hour < 18) return t('greeting_afternoon') || 'Good Afternoon';
    return t('greeting_evening') || 'Good Evening';
  };

  const handleLogMedicine = async (medicineId, date, scheduledTime, currentStatus) => {
    if (currentStatus === 'taken') {
      toast.success(t('This medicine is already taken') || 'This medicine is already taken');
      return;
    }

    try {
      const logData = {
        medicine_id: medicineId,
        date: date,
        scheduled_time: scheduledTime,
        status: 'taken'
      };

      const updatedLog = await API.post('/medicines/log', logData);

      setTodayMedLogs(prev => {
        const existing = prev.findIndex(l => l.medicine_id === medicineId && l.scheduled_time === scheduledTime);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = updatedLog;
          return next;
        }
        return [...prev, updatedLog];
      });
      toast.success('Medicine logged as taken');
    } catch (e) {
      console.error('Failed to log medicine', e);
      toast.error('Failed to log medicine');
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const userName = (() => {
    if (currentUser?.name && currentUser.name !== 'Loading...' && currentUser.name.toLowerCase() !== 'user') return currentUser.name;
    const apiName = dashboardSummary?.user_name;
    if (apiName && apiName.toLowerCase() !== 'user') return apiName;
    try {
      const accounts = JSON.parse(localStorage.getItem('lifeos_accounts') || '[]');
      if (accounts.length > 0 && accounts[0].name) {
        return accounts[0].name;
      }
    } catch (e) { }
    return 'User';
  })();

  const healthScore = dashboardSummary?.health_score || 85;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 max-w-7xl mx-auto w-full">

      {/* ── Header / Hero Section ─────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden p-4 sm:p-6 flex flex-row items-center justify-between gap-4 group">

        {/* Abstract Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 opacity-5 rounded-full blur-3xl -mr-20 -mt-20 transition-transform duration-1000 group-hover:scale-110 pointer-events-none"></div>

        {/* Greeting block */}
        <div className="relative z-10 flex-1 min-w-0">
          <div className="hidden md:flex items-center gap-2 mb-2">
            <div className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-full">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold md:font-extrabold text-gray-900 dark:text-gray-100 tracking-tight leading-tight">
            {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{userName}</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium text-xs sm:text-sm mt-1">
            {t('greeting_msg') || 'Keep up the great work with your personalized health goals!'}
          </p>
        </div>

        {/* Health Score / Circle Icon block */}
        <div className="relative z-10 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 p-2.5 sm:p-4 rounded-2xl md:rounded-[1.5rem] border border-indigo-100 dark:border-gray-500 shadow-inner">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] font-black text-indigo-400 dark:text-gray-300 uppercase tracking-widest block mb-0.5">Health Score</span>
              <div className="flex items-baseline gap-1 justify-end">
                <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{healthScore}</span>
                <span className="text-xs text-indigo-400 font-bold">/100</span>
              </div>
            </div>
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 shrink-0">
              <svg width="100%" height="100%" viewBox="0 0 96 96" className="rotate-[-90deg]">
                <circle cx="48" cy="48" r="40" fill="none" className="stroke-indigo-100 dark:stroke-gray-500" strokeWidth="8" />
                <circle cx="48" cy="48" r="40" fill="none" className="stroke-indigo-500" strokeWidth="8" strokeDasharray="251" strokeDashoffset={251 - (251 * healthScore) / 100} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.5s ease-out' }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
              </div>
            </div>
          </div>
        </div>
      </div>







      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 w-full">

        {/* Left Column: Charts and Parameters */}
        <div className="lg:col-span-2 space-y-6">

          {/* Health Parameters Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-[2rem] p-4 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700 w-full overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 w-full">
              <SectionHeader title={t('my_parameters') || 'My Parameters'} subtitle={t('track_metrics') || 'Track key health metrics over time'} className="mb-0" />
              <button
                onClick={() => setShowParamModal(true)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold active:bg-indigo-100 dark:active:bg-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 active:scale-95 transition-all shrink-0 touch-manipulation"
              >
                <Plus className="w-4 h-4" /> {t('log_data') || 'Log Data'}
              </button>
            </div>

            {/* Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 w-full">
              <div className="flex flex-row flex-nowrap items-center bg-gray-50 dark:bg-gray-900/50 p-1 rounded-2xl border border-gray-100 dark:border-gray-700 w-fit max-w-full overflow-x-auto hide-scrollbar">
                <button
                  className={`px-4 py-2 min-h-[44px] rounded-xl text-sm font-bold transition-all duration-200 touch-manipulation active:scale-95 ${activeParam === 'weight' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 active:bg-gray-200 dark:active:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  onClick={() => setActiveParam('weight')}
                >
                  {t('weight') || 'Weight'}
                </button>
                <button
                  className={`px-4 py-2 min-h-[44px] rounded-xl text-sm font-bold transition-all duration-200 touch-manipulation active:scale-95 ${activeParam === 'bp' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 active:bg-gray-200 dark:active:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  onClick={() => setActiveParam('bp')}
                >
                  {t('blood_pressure') || 'Blood Pressure'}
                </button>
                <button
                  className={`px-4 py-2 min-h-[44px] rounded-xl text-sm font-bold transition-all duration-200 touch-manipulation active:scale-95 ${activeParam === 'pulse' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 active:bg-gray-200 dark:active:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  onClick={() => setActiveParam('pulse')}
                >
                  {t('pulse') || 'Pulse'}
                </button>
              </div>

              {/* Styled Select */}
              <div className="relative shrink-0 min-w-[150px]">
                <CustomSelect
                  value={paramTimeframe}
                  onChange={(e) => setParamTimeframe(e.target.value)}
                  options={[
                    { value: '6months', label: t('past_6_months') || 'Past 6 Months' },
                    { value: '3months', label: t('past_3_months') || 'Past 3 Months' },
                    { value: 'thisMonth', label: t('this_month') || 'This Month' }
                  ]}
                />
              </div>
            </div>

            <div className="h-56 md:h-80 w-full relative">
              <canvas id="params-chart"></canvas>
            </div>
          </div>

          {/* Quick Actions & Sharing */}
          <div className="grid grid-cols-1 gap-4 w-full">
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl md:rounded-[2rem] p-4 md:p-6 text-gray-900 dark:text-gray-100 shadow-sm flex flex-col justify-center hover:shadow-md hover:bg-pink-50 dark:hover:bg-pink-900/20 hover:border-pink-200 dark:hover:border-pink-800 transition-all duration-300 relative group overflow-hidden cursor-pointer" onClick={!sharedLink ? handleShareSummary : undefined}>
              {!sharedLink ? (
                <div className="flex justify-between items-center w-full">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-pink-50 dark:bg-pink-900/30 group-hover:bg-pink-100 dark:group-hover:bg-pink-800/50 rounded-2xl flex items-center justify-center text-pink-500 dark:text-pink-400 shrink-0 transition-colors">
                      <Link className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-xl group-hover:text-pink-900 dark:group-hover:text-pink-100 transition-colors">{isSharing ? 'Generating...' : (t('doctor_summary') || 'Doctor Summary')}</h3>
                      <p className="text-gray-500 dark:text-gray-400 group-hover:text-pink-600 dark:group-hover:text-pink-300 font-medium text-sm transition-colors">{t('share_data') || 'Share your health data'}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-pink-500 opacity-50 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                </div>
              ) : (
                <div className="flex items-center gap-4 w-full animate-in fade-in duration-300 cursor-default" onClick={e => e.stopPropagation()}>
                  <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shrink-0">
                    <Check className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-pink-900 dark:text-pink-100 font-bold mb-1.5 truncate">Summary Link Ready!</p>
                    <div className="flex items-center gap-2 w-full bg-white dark:bg-gray-900 p-1 rounded-lg border border-pink-200 dark:border-pink-700 focus-within:border-pink-400 transition-colors shadow-inner">
                      <input type="text" readOnly value={sharedLink} className="flex-1 bg-transparent text-gray-700 dark:text-gray-300 px-2 py-0.5 text-xs font-medium outline-none truncate min-w-0" onClick={e => e.target.select()} />
                      <button onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(sharedLink);
                        setIsCopied(true);
                        setTimeout(() => {
                          setIsCopied(false);
                          setSharedLink('');
                        }, 5000);
                      }}
                        className={`${isCopied ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-pink-500 hover:bg-pink-600'} text-white px-3 py-1 rounded font-bold text-xs transition-colors shadow-md shrink-0`}
                      >
                        {isCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Records & Medications (Split into 2 columns for better layout balance) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 w-full">

            {/* My Appointments Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-[2rem] p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
                <SectionHeader title={t('appointments') || 'Appointments'} className="mb-0" />
                <div className="flex shrink-0 bg-gray-50 dark:bg-gray-900/50 p-1 rounded-xl border border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => setAptTimeframe('today')}
                    className={`px-3 py-1 text-xs font-bold whitespace-nowrap rounded-lg transition-all ${aptTimeframe === 'today'
                      ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                  >
                    {t('today') || 'Today'}
                  </button>
                  <button
                    onClick={() => setAptTimeframe('week')}
                    className={`px-3 py-1 text-xs font-bold whitespace-nowrap rounded-lg transition-all ${aptTimeframe === 'week'
                      ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                  >
                    {t('this_week') || 'This Week'}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {(() => {
                  let apts = appointments || [];
                  const now = new Date();
                  const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                  const nextWeekStr = new Date(nextWeek.getTime() - nextWeek.getTimezoneOffset() * 60000).toISOString().split('T')[0];

                  apts = apts.filter(a => {
                    if (a.status !== 'upcoming') return false;
                    const aptTime = new Date(`${a.date}T${a.time || '00:00'}`);
                    return aptTime >= now;
                  });

                  if (aptTimeframe === 'today') {
                    apts = apts.filter(a => a.date === todayStr);
                  } else if (aptTimeframe === 'week') {
                    apts = apts.filter(a => a.date >= todayStr && a.date <= nextWeekStr);
                  }

                  apts.sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));

                  if (apts.length > 0) {
                    return apts.slice(0, 3).map((apt, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex flex-col items-center justify-center shrink-0">
                          <span className="text-xs font-bold uppercase">{new Date(`1970-01-01T${apt.time}`).toLocaleTimeString([], { hour: 'numeric' })}</span>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <h4 className="font-bold text-gray-900 dark:text-gray-100 truncate text-sm">Dr. {apt.doctor}</h4>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{apt.specialty}</p>
                        </div>
                      </div>
                    ));
                  } else {
                    return (
                      <div className="py-6 text-center text-sm font-medium text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                        No appointments {aptTimeframe}
                      </div>
                    );
                  }
                })()}
              </div>
              <button
                onClick={() => navigate('/app/appointments')}
                className="w-full mt-4 py-3 rounded-xl bg-gray-900 dark:bg-gray-700 text-white text-sm font-bold hover:bg-black dark:hover:bg-gray-600 transition-colors shadow-md"
              >
                {t('book_appointment') || 'Book Appointment'}
              </button>
            </div>

            {/* Today's Medications Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-[2rem] p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center mb-6">
                <SectionHeader title={t('medications') || 'Medications'} />
              </div>
              <div className="space-y-4 pr-2">
                {(() => {
                  if (!reminderData || !reminderData.doses) return <p className="text-xs font-medium text-gray-400 py-2">Loading...</p>;
                  const s = reminderData.settings;
                  const today = new Intl.DateTimeFormat('en-CA', { timeZone: s.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
                  const now = Date.now();
                  const doses = reminderData.doses.map(d => {
                    if (!['upcoming', 'due', 'pending', 'snoozed', 'missed'].includes(d.status)) return d;
                    const due = new Date(d.snoozed_until || d.scheduled_at).getTime();
                    return { ...d, status: now > due + s.grace_minutes * 60000 ? 'missed' : due <= now ? 'due' : d.snoozed_until ? 'snoozed' : 'upcoming' };
                  });
                  const todayDoses = doses.filter(d => d.date === today).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

                  if (!todayDoses.length) return <p className="text-xs font-medium text-gray-400 py-2">No active medications for today.</p>;

                  return todayDoses.map(d => (
                    <MedicineDoseCard 
                      key={d.id} 
                      d={d} 
                      view="today" 
                      busy={busy} 
                      readOnly={Boolean(reminderData.compatibility)} 
                      s={s} 
                      action={action} 
                      setDialog={setDialog} 
                      setReason={setReason} 
                    />
                  ));
                })()}
              </div>
            </div>

          </div>

        </div>

        {/* Right Column: Recent Activity */}
        <div className="space-y-6">

          {/* Recent Activity Card */}
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <SectionHeader title={t('recent_activity') || 'Recent Activity'} />
            </div>
            <div className="space-y-3">
              {recentRecords.length > 0 ? recentRecords.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{r.title}</div>
                    <div className="text-xs font-medium text-gray-500">{r.date}</div>
                  </div>
                </div>
              )) : (
                <p className="text-xs font-medium text-gray-400 py-2">No recent records.</p>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ── Modal for Adding Parameter ────────────────────────────── */}
      {showParamModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowParamModal(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Log Health Metric</h3>
              <button onClick={() => setShowParamModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-gray-500">✕</button>
            </div>

            <div className="space-y-5 mb-8">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Parameter</label>
                <CustomSelect
                  value={newParam.category}
                  onChange={(e) => setNewParam({ ...newParam, category: e.target.value })}
                  options={[
                    { value: "weight", label: t('weight') || 'Weight' },
                    { value: "blood_pressure", label: "Blood Pressure" },
                    { value: "heart_rate", label: "Heart Rate (bpm)" }
                  ]}
                  className="bg-gray-50 dark:bg-gray-900 border-2"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  {newParam.category === 'blood_pressure' ? 'Systolic (mmHg)' : newParam.category === 'weight' ? `Value (${weightUnit})` : 'Value'}
                </label>
                <input
                  type="number"
                  value={newParam.value}
                  onChange={(e) => setNewParam({ ...newParam, value: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                  placeholder={newParam.category === 'weight' ? `e.g. ${weightUnit === 'lbs' ? '154' : '70'}` : "e.g. 78"}
                />
              </div>

              {newParam.category === 'blood_pressure' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Diastolic (mmHg)</label>
                  <input
                    type="number"
                    value={newParam.secondary_value}
                    onChange={(e) => setNewParam({ ...newParam, secondary_value: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                    placeholder="e.g. 80"
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleSaveParam}
              disabled={savingParam || !newParam.value}
              className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingParam ? 'Saving...' : 'Save Parameter'}
            </button>
          </div>
        </div>
      )}

      <MedicineActionDialog 
        dialog={dialog} 
        busy={busy} 
        reason={reason} 
        setReason={setReason} 
        quantity={quantity} 
        setQuantity={setQuantity} 
        action={action} 
        setDialog={setDialog} 
        run={runDialogAction} 
      />
    </div>
  );
};

export default DashboardOverview;
