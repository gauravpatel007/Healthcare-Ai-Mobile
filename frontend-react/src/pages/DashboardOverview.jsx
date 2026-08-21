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

/* ─── Reusable Card (Matches AdminUI) ──────────── */
const StatCard = ({ title, value, subtitle, icon: Icon, colorClass, onClick }) => (
  <div
    onClick={onClick}
    tabIndex={0}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e); } }}
    className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 relative overflow-hidden group cursor-pointer focus:outline-none"
  >
    <div className={`absolute top-0 right-0 w-32 h-32 ${colorClass} opacity-10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110`}></div>
    <div className="flex items-start justify-between relative z-10">
      <div>
        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1 tracking-wide uppercase">{title}</p>
        <h3 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{value}</h3>
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
    <div className="w-1.5 h-8 bg-gradient-to-b from-blue-500 to-indigo-400 rounded-full"></div>
    <div>
      <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{title}</h2>
      {subtitle && <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{subtitle}</p>}
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
        const [d, hData, fStats, nPlan, records, meds, apts, medLogs] = await Promise.all([
          API.get('/dashboard/summary').catch(() => null),
          API.get('/trackers/health-data').catch(() => ({})),
          API.get('/ai/fitness/stats').catch(() => ({})),
          API.get('/ai/nutrition/plan').catch(() => null),
          API.get('/records').catch(() => []),
          API.get('/medicines').catch(() => []),
          API.get('/appointments').catch(() => []),
          API.get('/medicines/today-logs').catch(() => [])
        ]);
        setDashboardSummary(d);
        setHealthData(hData || {});
        setFitnessStats(fStats || { steps: 0, calories_burned: 0, step_goal: 10000 });
        setNutritionPlan(nPlan || { tdee: 2200, protein_goal_grams: 84, carbs_goal_grams: 200, fat_goal_grams: 60 });
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
                  usePointStyle: true, pointStyle: 'circle', padding: 20,
                  font: { family: "'Inter', sans-serif", weight: '600', size: 12 }, color: '#64748b'
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
                ticks: { font: { family: "'Inter', sans-serif", weight: '500' }, color: '#94a3b8' }
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
      toast.success(newStatus === 'taken' ? 'Medicine logged as taken' : 'Medicine log removed');
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 max-w-7xl mx-auto">

      {/* ── Header / Hero Section ─────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden p-5 sm:p-6 flex flex-wrap justify-between items-center gap-6 group">

        {/* Abstract Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 opacity-5 rounded-full blur-3xl -mr-20 -mt-20 transition-transform duration-1000 group-hover:scale-110 pointer-events-none"></div>

        {/* Greeting block */}
        <div className="relative z-10 flex-1 min-w-[280px]">
          <div className="inline-block px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-full mb-1.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight leading-tight">
            {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{userName}</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium text-sm mt-1">
            {t('greeting_msg') || 'Keep up the great work with your personalized health goals!'}
          </p>
        </div>

        {/* Insights & Health Score block */}
        <div className="relative z-10 flex items-center gap-3 shrink-0">

          <div className="flex flex-col gap-2">
            <div className="bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-2xl border border-gray-100 dark:border-gray-600 flex items-center gap-2.5">
              <Flame className="w-4 h-4 text-orange-500" />
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-tight">Calories Burned</p>
                <p className="text-xs font-extrabold text-gray-800 dark:text-white leading-tight">{fitnessStats?.calories_burned || 0} kcal</p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-2xl border border-gray-100 dark:border-gray-600 flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-emerald-500" />
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-tight">Steps Goal</p>
                <p className="text-xs font-extrabold text-gray-800 dark:text-white leading-tight">{fitnessStats?.step_goal ? Math.min((fitnessStats.steps / fitnessStats.step_goal * 100), 100).toFixed(0) : 0}%</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 p-3 sm:p-4 rounded-[1.5rem] border border-indigo-100 dark:border-gray-500 shadow-inner">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] font-black text-indigo-400 dark:text-gray-300 uppercase tracking-widest block mb-0.5">Health Score</span>
              <div className="flex items-baseline gap-1 justify-end">
                <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{healthScore}</span>
                <span className="text-xs text-indigo-400 font-bold">/100</span>
              </div>
            </div>
            <div className="relative w-16 h-16 sm:w-20 sm:h-20">
              <svg width="100%" height="100%" viewBox="0 0 96 96" className="rotate-[-90deg]">
                <circle cx="48" cy="48" r="40" fill="none" className="stroke-indigo-100 dark:stroke-gray-500" strokeWidth="8" />
                <circle cx="48" cy="48" r="40" fill="none" className="stroke-indigo-500" strokeWidth="8" strokeDasharray="251" strokeDashoffset={251 - (251 * healthScore) / 100} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.5s ease-out' }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Activity className="w-6 h-6 text-indigo-500" />
              </div>
            </div>
          </div>

        </div>
      </div>



      {/* ── Main Quick Stats (Vitals & Activity) ────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={t('steps_today') || 'Steps Today'}
          value={(fitnessStats?.steps || 0).toLocaleString()}
          subtitle={`${t('goal') || 'Goal'}: ${(fitnessStats?.step_goal || 10000).toLocaleString()}`}
          icon={Activity}
          colorClass="bg-emerald-500 text-emerald-500"
        />
        <StatCard
          title={t('calories_burned') || 'Calories Burned'}
          value={fitnessStats?.calories_burned || 0}
          subtitle={t('kcal_active') || 'Kcal active'}
          icon={Flame}
          colorClass="bg-orange-500 text-orange-500"
        />
        <StatCard
          title={t('heart_rate_caps') || 'Heart Rate'}
          value={healthData?.heart_rate?.[(healthData?.heart_rate?.length || 1) - 1]?.value || '--'}
          subtitle={t('bpm_last') || 'bpm (Last reading)'}
          icon={HeartPulse}
          colorClass="bg-rose-500 text-rose-500"
        />
        <StatCard
          title={t('sleep_caps') || 'Sleep'}
          value={healthData?.sleep?.[(healthData?.sleep?.length || 1) - 1]?.value ? `${healthData?.sleep?.[(healthData?.sleep?.length || 1) - 1]?.value}h` : '--'}
          subtitle={t('last_night') || 'Last night'}
          icon={Moon}
          colorClass="bg-indigo-500 text-indigo-500"
        />
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Charts and Parameters */}
        <div className="lg:col-span-2 space-y-6">

          {/* Health Parameters Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4 w-full">
              <SectionHeader title={t('my_parameters') || 'My Parameters'} subtitle={t('track_metrics') || 'Track key health metrics over time'} className="mb-0" />
              <button
                onClick={() => setShowParamModal(true)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" /> {t('log_data') || 'Log Data'}
              </button>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6 w-full">
              <div className="flex flex-wrap items-center bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700">
                <button
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${activeParam === 'weight' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  onClick={() => setActiveParam('weight')}
                >
                  {t('weight') || 'Weight'}
                </button>
                <button
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${activeParam === 'bp' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  onClick={() => setActiveParam('bp')}
                >
                  {t('blood_pressure') || 'Blood Pressure'}
                </button>
                <button
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${activeParam === 'pulse' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
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

            <div className="h-80 w-full relative">
              <canvas id="params-chart"></canvas>
            </div>
          </div>

          {/* Quick Actions & Sharing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => navigate('/app/ai-fitness')}
              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[2rem] p-6 text-gray-900 dark:text-gray-100 shadow-sm hover:shadow-md hover:bg-cyan-50 dark:hover:bg-cyan-900/20 hover:border-cyan-200 dark:hover:border-cyan-800 transition-all duration-300 cursor-pointer group flex justify-between items-center"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-cyan-50 dark:bg-cyan-900/30 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-800/50 rounded-2xl flex items-center justify-center text-cyan-600 dark:text-cyan-400 transition-colors">
                  <Dumbbell className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xl group-hover:text-cyan-900 dark:group-hover:text-cyan-100 transition-colors">{t('start_workout') || 'Start Workout'}</h3>
                  <p className="text-gray-500 dark:text-gray-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 font-medium text-sm transition-colors">{t('ai_plan') || 'AI personalized plan'}</p>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-cyan-500 opacity-50 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[2rem] p-6 text-gray-900 dark:text-gray-100 shadow-sm flex flex-col justify-center hover:shadow-md hover:bg-pink-50 dark:hover:bg-pink-900/20 hover:border-pink-200 dark:hover:border-pink-800 transition-all duration-300 relative group overflow-hidden cursor-pointer" onClick={!sharedLink ? handleShareSummary : undefined}>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">

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

            {/* Today's Medications Card */}
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center mb-6">
                <SectionHeader title={t('medications') || 'Medications'} />
              </div>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {(() => {
                  if (!myMeds.length) return <p className="text-xs font-medium text-gray-400 py-2">No active medications.</p>;

                  const todayDoses = [];
                  const todayStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

                  myMeds.forEach(med => {
                    let slots = [];
                    if (med.frequency === 'once_daily') slots = ['Morning'];
                    else if (med.frequency === 'twice_daily') slots = ['Morning', 'Evening'];
                    else if (med.frequency === 'thrice_daily') slots = ['Morning', 'Afternoon', 'Evening'];
                    else slots = ['Anytime'];

                    slots.forEach(slot => {
                      const log = todayMedLogs.find(l => l.medicine_id === med.id && l.scheduled_time === slot);
                      todayDoses.push({
                        med,
                        slot,
                        status: log ? log.status : 'pending'
                      });
                    });
                  });

                  const currentSlot = (() => {
                    const hour = new Date().getHours();
                    if (hour < 12) return 'Morning';
                    if (hour < 18) return 'Afternoon';
                    return 'Evening';
                  })();
                  const filteredDoses = todayDoses.filter(d => d.slot === currentSlot || d.slot === 'Anytime');

                  if (!filteredDoses.length) return <p className="text-xs font-medium text-gray-400 py-2">No medications scheduled for this {currentSlot.toLowerCase()}.</p>;

                  const getSlotTime = (times, slot) => {
                    if (!times || !times.length) return 'Flexible';
                    if (slot === 'Morning') return times[0];
                    if (slot === 'Afternoon') return times.length > 1 ? times[1] : times[0];
                    if (slot === 'Evening') return times[times.length - 1];
                    return times[0];
                  };

                  return filteredDoses.map((dose, idx) => {
                    const isTaken = dose.status === 'taken';
                    return (
                      <div key={idx} className="flex items-start gap-4 group cursor-pointer" onClick={() => handleLogMedicine(dose.med.id, todayStr, dose.slot, dose.status)}>
                        <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 shadow-inner transition-colors ${isTaken ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 group-hover:border-indigo-400'}`}>
                          {isTaken && <Check className="w-3 h-3" />}
                        </div>
                        <div className={isTaken ? 'opacity-50' : ''}>
                          <p className={`text-sm font-bold transition-colors ${isTaken ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}`}>{dose.med.name} {dose.med.dosage}</p>
                          <p className="text-[11px] font-black text-indigo-500 uppercase tracking-wider mt-0.5">{dose.slot} • {getSlotTime(dose.med.times, dose.slot)}</p>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

          </div>

        </div>

        {/* Right Column: Nutrition, Appointments, Records */}
        <div className="space-y-6">

          {/* Nutrition Tracker */}
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <SectionHeader title={t('nutrition_caps') || 'Nutrition'} />
              <button onClick={() => navigate('/app/ai-nutrition')} className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-center text-gray-500 transition-colors">
                <UtensilsCrossed className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              let consumedProtein = 0, consumedCarbs = 0, consumedFats = 0, consumedCalories = 0;
              if (nutritionPlan && nutritionPlan.consumed_macros) {
                consumedProtein = nutritionPlan.consumed_macros.protein || 0;
                consumedCarbs = nutritionPlan.consumed_macros.carbs || 0;
                consumedFats = nutritionPlan.consumed_macros.fats || 0;
                consumedCalories = nutritionPlan.consumed_macros.calories || 0;
              }
              const goalProtein = nutritionPlan?.protein_goal_grams || 84;
              const goalCarbs = nutritionPlan?.carbs_goal_grams || 200;
              const goalFats = nutritionPlan?.fat_goal_grams || 60;
              const goalCalories = nutritionPlan?.tdee || 2200;

              return (
                <>
                  <div className="space-y-5">
                    <div>
                      <div className="flex justify-between text-sm font-bold mb-2">
                        <span className="flex items-center gap-2 text-rose-500"><Flame className="w-4 h-4" /> {t('protein') || 'Protein'}</span>
                        <span className="text-gray-900 dark:text-gray-100">{consumedProtein} / {goalProtein}g</span>
                      </div>
                      <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min((consumedProtein / goalProtein) * 100, 100)}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm font-bold mb-2">
                        <span className="flex items-center gap-2 text-amber-500"><Activity className="w-4 h-4" /> {t('carbs') || 'Carbs'}</span>
                        <span className="text-gray-900 dark:text-gray-100">{consumedCarbs} / {goalCarbs}g</span>
                      </div>
                      <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min((consumedCarbs / goalCarbs) * 100, 100)}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm font-bold mb-2">
                        <span className="flex items-center gap-2 text-indigo-500"><Droplet className="w-4 h-4" /> {t('fats') || 'Fats'}</span>
                        <span className="text-gray-900 dark:text-gray-100">{consumedFats} / {goalFats}g</span>
                      </div>
                      <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min((consumedFats / goalFats) * 100, 100)}%` }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 flex justify-between items-center border border-emerald-100 dark:border-emerald-800/50">
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2"><Target className="w-4 h-4" /> {t('calories') || 'Calories'}</span>
                    <span className="font-extrabold text-gray-900 dark:text-gray-100">{consumedCalories} / {goalCalories} <span className="text-xs text-gray-500 font-medium">kcal/day</span></span>
                  </div>
                </>
              );
            })()}
          </div>

          {/* My Appointments */}
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700">
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

          {/* Weekly Goals Tracker */}
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
            <div className="flex justify-between items-center mb-6">
              <SectionHeader title={t('weekly_goals') || 'Weekly Goals'} />
              <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-500 transition-transform hover:scale-110 cursor-pointer">
                <Target className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-6">
              {/* Goal 1 */}
              <div>
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><Dumbbell className="w-4 h-4 text-orange-500" /> {t('workouts') || 'Workouts'}</span>
                  <span className="text-gray-900 dark:text-gray-100">{fitnessStats?.workouts_this_week || 0} <span className="text-gray-400 font-medium">/ 5 Days</span></span>
                </div>
                <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(((fitnessStats?.workouts_this_week || 0) / 5) * 100, 100)}%` }}></div>
                </div>
              </div>

              {/* Goal 2 */}
              <div>
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><Moon className="w-4 h-4 text-cyan-500" /> {t('sleep_8h') || '8h Sleep'}</span>
                  <span className="text-gray-900 dark:text-gray-100">{
                    (healthData?.sleep || []).filter(s => s.value >= 8).length
                  } <span className="text-gray-400 font-medium">/ 7 Days</span></span>
                </div>
                <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min((((healthData?.sleep || []).filter(s => s.value >= 8).length) / 7) * 100, 100)}%` }}></div>
                </div>
              </div>

              {/* Goal 3 */}
              <div>
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><Brain className="w-4 h-4 text-purple-500" /> Mindfulness</span>
                  <span className="text-gray-900 dark:text-gray-100">{
                    (healthData?.mindfulness || []).length
                  } <span className="text-gray-400 font-medium">/ 3 Sessions</span></span>
                </div>
                <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-400 to-purple-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min((((healthData?.mindfulness || []).length) / 3) * 100, 100)}%` }}></div>
                </div>
              </div>

            </div>
          </div>        </div>

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

    </div>
  );
};

export default DashboardOverview;
