import React, { useState, useEffect, useRef } from 'react';
import API from '../utils/api';
import {
  BarChart3,
  TrendingUp,
  Target,
  Activity,
  Pill,
  HeartPulse,
  Scale,
  Folder,
  Droplet,
  Stethoscope,
  Dumbbell,
  Flame,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileText,
  Image as ImageIcon,
  Syringe,
  Sparkles
} from 'lucide-react';
import { usePersistentTab } from '../hooks/usePersistentTab';
import { useLang } from '../contexts/LangContext';
import { useUnit } from '../contexts/UnitContext';

/* ─── Chart Tooltip Helper ─────────────────────────────────────── */
const getTooltipOpts = (isDark, weightUnit = 'kg') => ({
  backgroundColor: isDark ? '#1e293b' : '#ffffff',
  titleColor: '#9ca3af',
  titleFont: { family: "'Inter', sans-serif", weight: '500', size: 12 },
  bodyColor: isDark ? '#f3f4f6' : '#111827',
  bodyFont: { family: "'Inter', sans-serif", weight: '700', size: 13 },
  padding: 12,
  cornerRadius: 12,
  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
  borderWidth: 1,
  displayColors: false,
  callbacks: {
    title: function (context) { return context[0].label; },
    label: function (context) {
      let label = context.dataset.label || '';
      if (label) label += ': ';
      const val = context.parsed.y !== undefined ? context.parsed.y : context.parsed;
      if (val !== null && val !== undefined) {
        label += val;
        const l = label.toLowerCase();
        if (l.includes('weight')) label += ` ${weightUnit}`;
        else if (l.includes('heart') || l.includes('bpm')) label += ' bpm';
        else if (l.includes('blood') || l.includes('systolic') || l.includes('diastolic')) label += ' mmHg';
        else if (l.includes('step')) label += ' steps';
        else if (l.includes('calorie')) label += ' kcal';
        else if (l.includes('sleep')) label += ' hrs';
      }
      return label;
    }
  }
});

/* ─── Shared UI Components ─────────────────────────────────────── */

const SectionHeader = ({ title, subtitle, className = "mb-4" }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div className="w-1.5 h-8 bg-gradient-to-b from-blue-500 to-indigo-400 rounded-full"></div>
    <div>
      <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{title}</h2>
      {subtitle && <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{subtitle}</p>}
    </div>
  </div>
);

const StatCard = ({ title, value, subtitle, trend, trendValue, icon: Icon, colorClass, onClick }) => (
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
        <h3 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight flex items-baseline gap-1">{value}</h3>
      </div>
      <div className={`p-4 ${colorClass} bg-opacity-10 dark:bg-opacity-20 rounded-2xl shadow-sm transition-transform duration-300 ease-out group-hover:scale-125`}>
        <Icon className="w-7 h-7" style={{ color: 'currentColor' }} />
      </div>
    </div>
    <div className="mt-5 flex items-center text-sm gap-2">
      {subtitle && (
        <span className="font-semibold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-3 py-1 rounded-full">
          {subtitle}
        </span>
      )}
      {trend !== undefined && (
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${trend === 'up' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' :
          trend === 'down' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500' :
            'bg-gray-50 dark:bg-gray-900/30 text-gray-500'
          }`}>
          {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> :
            trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> :
              <Minus className="w-3 h-3" />}
          {trendValue}
        </span>
      )}
    </div>
  </div>
);

/* ─── Main Analytics Component ─────────────────────────────────── */

const Analytics = ({ voiceAction, onVoiceActionConsumed }) => {
  const { t } = useLang();
  const { displayWeight, weightUnit } = useUnit();

  // Hide right panel for more room
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

  const [activeTab, setActiveTab] = usePersistentTab('analytics', 'vitals');
  
  // Voice Action Listener
  useEffect(() => {
    if (voiceAction && voiceAction.target_feature === 'analytics' && voiceAction.action_name === 'open_tab' && voiceAction.data?.tab) {
      const tabId = voiceAction.data.tab.toLowerCase();
      const validTabs = ['vitals', 'adherence', 'risk', 'activity', 'lab_trends'];
      if (validTabs.includes(tabId)) {
        setActiveTab(tabId);
      } else {
        toast.error(`Unknown analytics tab: ${tabId}`);
      }
      if (onVoiceActionConsumed) onVoiceActionConsumed();
    }
  }, [voiceAction]);

  const [loading, setLoading] = useState(true);

  // Data states
  const [graphsData, setGraphsData] = useState({});
  const [medicines, setMedicines] = useState([]);
  const [medLogs, setMedLogs] = useState([]);
  const [riskData, setRiskData] = useState(null);
  const [fitnessStats, setFitnessStats] = useState({});
  const [healthData, setHealthData] = useState({});
  const [records, setRecords] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [profile, setProfile] = useState(null);

  const [labMetrics, setLabMetrics] = useState([]);

  // Sub-tab state for Tab 4
  const [activitySubTab, setActivitySubTab] = useState('fitness');

  // Chart refs
  const vitalsChartRef = useRef(null);
  const bpChartRef = useRef(null);
  const stepsChartRef = useRef(null);
  const caloriesChartRef = useRef(null);
  const recordsPieRef = useRef(null);
  const labTrendChartRef = useRef(null);
  const chartInstances = useRef({});

  const activeCalorieGoal = profile?.burn_calorie_goal || fitnessStats?.calorie_goal || 500;
  // Timeframe for vitals charts
  const [vitalsTimeframe, setVitalsTimeframe] = useState('1month');

  // Selected metric for Lab Trends chart
  const [selectedLabMetric, setSelectedLabMetric] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [graphs, meds, logs, risks, fitness, hData, recs, timeline, apts, userProfile, labs] = await Promise.all([
          API.get('/analytics/graphs').catch(() => ({})),
          API.get('/medicines').catch(() => []),
          API.get('/medicines/logs').catch(() => []),
          API.get('/analytics/risk-scores').catch(() => null),
          API.get('/ai/fitness/stats').catch(() => ({})),
          API.get('/trackers/health-data').catch(() => ({})),
          API.get('/records').catch(() => []),
          API.get('/analytics/timeline').catch(() => []),
          API.get('/appointments').catch(() => []),
          API.get(`/users/profile?_t=${Date.now()}`).catch(() => null),
          API.getUserLabMetrics().catch(() => [])
        ]);
        setGraphsData(graphs || {});
        setMedicines(meds || []);
        setMedLogs(logs || []);
        setRiskData(risks);
        setFitnessStats(fitness || {});
        setHealthData(hData || {});
        setRecords(recs || []);
        setAppointments(apts || []);
        setTimelineData(timeline || []);
        setProfile(userProfile);
        setLabMetrics(labs || []);
      } catch (e) {
        console.error('Analytics fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  /* ─── Chart rendering for Vitals tab ─── */
  useEffect(() => {
    if (activeTab !== 'vitals' || loading || !window.Chart) return;

    // Destroy old chart instances for this tab
    ['vitals', 'bp'].forEach(k => {
      if (chartInstances.current[k]) { chartInstances.current[k].destroy(); chartInstances.current[k] = null; }
    });

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
    const tickColor = isDark ? '#94a3b8' : '#94a3b8';

    const createGradient = (ctx, rgb) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, 250);
      gradient.addColorStop(0, `rgba(${rgb}, 0.4)`);
      gradient.addColorStop(1, `rgba(${rgb}, 0.0)`);
      return gradient;
    };

    const commonOpts = {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top', align: 'end',
          labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { family: "'Inter', sans-serif", weight: '600', size: 11 }, color: tickColor }
        },
        tooltip: getTooltipOpts(isDark, weightUnit)
      },
      scales: {
        x: { grid: { display: false, drawBorder: false }, ticks: { font: { family: "'Inter', sans-serif", weight: '500' }, color: tickColor } },
        y: { grid: { color: gridColor, drawBorder: false, borderDash: [5, 5] }, ticks: { font: { family: "'Inter', sans-serif", weight: '500' }, color: tickColor, padding: 8 }, beginAtZero: false }
      }
    };

    // Helper: generate unified chronological chart data for multiple datasets
    const getUnifiedChartData = (datasetsArgs) => {
      const getEmptyState = () => {
        const dummyLabels = vitalsTimeframe === '1month'
          ? ['Week 1', 'Week 2', 'Week 3', 'Week 4']
          : vitalsTimeframe === '3months' ? ['Month 1', 'Month 2', 'Month 3'] : ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'];
        const count = vitalsTimeframe === '3months' ? 3 : vitalsTimeframe === '1month' ? 4 : 6;
        return { labels: dummyLabels.slice(-count), dataArrays: datasetsArgs.map(() => Array(count).fill(null)) };
      };

      let allRecords = [];
      const now = new Date();
      let cutoffDate = new Date();

      if (vitalsTimeframe === '1month') {
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (vitalsTimeframe === '3months') {
        cutoffDate.setMonth(now.getMonth() - 3);
      } else {
        cutoffDate.setMonth(now.getMonth() - 6);
      }

      datasetsArgs.forEach((ds, dsIndex) => {
        if (!ds.entries) return;
        const filtered = ds.entries.filter(r => new Date(r.recorded_at || r.date) >= cutoffDate);
        filtered.sort((a, b) => new Date(a.recorded_at || a.date) - new Date(b.recorded_at || b.date));

        filtered.forEach(r => {
          const d = new Date(r.recorded_at || r.date);
          const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const existingIndex = allRecords.findIndex(x => x.dateKey === dateKey && x.dsIndex === dsIndex);
          if (existingIndex > -1) {
            allRecords[existingIndex] = { dateKey, value: ds.extractor(r), dsIndex, timestamp: d.getTime() };
          } else {
            allRecords.push({ dateKey, value: ds.extractor(r), dsIndex, timestamp: d.getTime() });
          }
        });
      });

      if (allRecords.length === 0) return getEmptyState();

      allRecords.sort((a, b) => a.timestamp - b.timestamp);
      const uniqueDateKeys = [...new Set(allRecords.map(r => r.dateKey))];
      const labels = uniqueDateKeys;

      const dataArrays = datasetsArgs.map((ds, dsIndex) => {
        const dataArr = [];
        uniqueDateKeys.forEach(dk => {
          const matching = allRecords.filter(r => r.dateKey === dk && r.dsIndex === dsIndex);
          if (matching.length > 0) {
            dataArr.push(matching[0].value);
          } else {
            dataArr.push(null);
          }
        });

        let currentLast = null;
        for (let i = 0; i < dataArr.length; i++) {
          if (dataArr[i] !== null) { currentLast = dataArr[i]; break; }
        }
        for (let i = 0; i < dataArr.length; i++) {
          if (dataArr[i] !== null) {
            currentLast = dataArr[i];
          } else {
            dataArr[i] = currentLast;
          }
        }
        return dataArr;
      });

      if (labels.length === 1) {
        labels.unshift('Start');
        dataArrays.forEach(arr => arr.unshift(arr[0]));
      }

      return { labels, dataArrays };
    };

    setTimeout(() => {
      // Vitals Trend Chart (Weight + Heart Rate)
      if (vitalsChartRef.current) {
        const ctx = vitalsChartRef.current.getContext('2d');
        const { labels, dataArrays } = getUnifiedChartData([
          { entries: healthData.weight, extractor: e => e.value },
          { entries: healthData.heart_rate, extractor: e => e.value }
        ]);
        const finalLabels = labels.length > 0 ? labels : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

        chartInstances.current.vitals = new window.Chart(ctx, {
          type: 'line',
          data: {
            labels: finalLabels,
            datasets: [
              {
                label: `${t('weight') || 'Weight'} (${weightUnit})`, data: dataArrays[0].map(v => v ? displayWeight(v).raw : null), borderColor: '#06b6d4', backgroundColor: createGradient(ctx, '6, 182, 212'),
                borderWidth: 3, tension: 0.45, pointBackgroundColor: '#ffffff', pointBorderColor: '#06b6d4', pointBorderWidth: 2, pointRadius: 3, pointHoverRadius: 5, fill: true
              },
              {
                label: 'Heart Rate (bpm)', data: dataArrays[1], borderColor: '#3b82f6', backgroundColor: createGradient(ctx, '59, 130, 246'),
                borderWidth: 3, tension: 0.45, pointBackgroundColor: '#ffffff', pointBorderColor: '#3b82f6', pointBorderWidth: 2, pointRadius: 3, pointHoverRadius: 5, fill: true
              }
            ]
          },
          options: commonOpts
        });
      }

      // BP Trend Chart (Systolic + Diastolic)
      if (bpChartRef.current) {
        const ctx = bpChartRef.current.getContext('2d');
        const { labels, dataArrays } = getUnifiedChartData([
          { entries: healthData.blood_pressure, extractor: e => e.systolic || e.value },
          { entries: healthData.blood_pressure, extractor: e => e.diastolic || e.secondary_value || 80 }
        ]);
        const finalLabels = labels.length > 0 ? labels : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

        chartInstances.current.bp = new window.Chart(ctx, {
          type: 'line',
          data: {
            labels: finalLabels,
            datasets: [
              {
                label: 'Systolic', data: dataArrays[0], borderColor: '#f97316', backgroundColor: createGradient(ctx, '249, 115, 22'),
                borderWidth: 3, tension: 0.45, pointBackgroundColor: '#ffffff', pointBorderColor: '#f97316', pointBorderWidth: 2, pointRadius: 3, pointHoverRadius: 5, fill: true
              },
              {
                label: 'Diastolic', data: dataArrays[1], borderColor: '#8b5cf6', backgroundColor: createGradient(ctx, '139, 92, 246'),
                borderWidth: 3, tension: 0.45, pointBackgroundColor: '#ffffff', pointBorderColor: '#8b5cf6', pointBorderWidth: 2, pointRadius: 3, pointHoverRadius: 5, fill: true
              }
            ]
          },
          options: commonOpts
        });
      }
    }, 80);

    return () => {
      ['vitals', 'bp'].forEach(k => {
        if (chartInstances.current[k]) { chartInstances.current[k].destroy(); chartInstances.current[k] = null; }
      });
    };
  }, [activeTab, loading, healthData, vitalsTimeframe]);

  /* ─── Chart rendering for Activity sub-tab ─── */
  useEffect(() => {
    if (activeTab !== 'activity' || activitySubTab !== 'fitness' || loading || !window.Chart) return;

    ['steps', 'calories'].forEach(k => {
      if (chartInstances.current[k]) { chartInstances.current[k].destroy(); chartInstances.current[k] = null; }
    });

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
    const tickColor = isDark ? '#94a3b8' : '#94a3b8';

    const createGradient = (ctx, rgb) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, 220);
      gradient.addColorStop(0, `rgba(${rgb}, 0.4)`);
      gradient.addColorStop(1, `rgba(${rgb}, 0.0)`);
      return gradient;
    };

    // Build last 7 days of steps + calories from healthData
    const last7Labels = [];
    const stepsArr = [];
    const calArr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      last7Labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));

      const daySteps = (healthData.steps || []).filter(e => {
        const ed = new Date(e.recorded_at || e.date);
        return ed.toDateString() === d.toDateString();
      });
      stepsArr.push(Math.max(0, daySteps.length > 0 ? daySteps.reduce((s, e) => s + (e.value || 0), 0) : 0));

      const dayCals = (healthData.calories || []).filter(e => {
        const ed = new Date(e.recorded_at || e.date);
        return ed.toDateString() === d.toDateString();
      });
      calArr.push(Math.max(0, dayCals.length > 0 ? dayCals.reduce((s, e) => s + (e.value || 0), 0) : 0));
    }

    // Fallback dummy if all zero
    const finalSteps = stepsArr.some(v => v > 0) ? stepsArr : [6200, 8100, 5400, 9200, 7600, 4800, 8500];
    const finalCals = calArr.some(v => v > 0) ? calArr : [320, 450, 280, 510, 390, 250, 420];

    setTimeout(() => {
      if (stepsChartRef.current) {
        const ctx = stepsChartRef.current.getContext('2d');
        chartInstances.current.steps = new window.Chart(ctx, {
          type: 'line',
          data: {
            labels: last7Labels,
            datasets: [{
              label: 'Steps', data: finalSteps, borderColor: '#10b981', backgroundColor: createGradient(ctx, '16, 185, 129'),
              borderWidth: 3, tension: 0.45, pointBackgroundColor: '#ffffff', pointBorderColor: '#10b981', pointBorderWidth: 2, pointRadius: 3, pointHoverRadius: 5, fill: true
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: getTooltipOpts(isDark, weightUnit) },
            scales: {
              x: { grid: { display: false }, ticks: { color: tickColor, font: { family: "'Inter', sans-serif", weight: '500' } } },
              y: { beginAtZero: true, min: 0, grid: { color: gridColor, borderDash: [5, 5], drawBorder: false }, ticks: { color: tickColor, font: { family: "'Inter', sans-serif", weight: '500' } } }
            }
          }
        });
      }

      if (caloriesChartRef.current) {
        const ctx = caloriesChartRef.current.getContext('2d');
        chartInstances.current.calories = new window.Chart(ctx, {
          type: 'bar',
          data: {
            labels: last7Labels,
            datasets: [{
              label: 'Calories', data: finalCals,
              backgroundColor: finalCals.map((_, i) => {
                const colors = ['rgba(249, 115, 22, 0.8)', 'rgba(249, 115, 22, 0.65)', 'rgba(249, 115, 22, 0.5)', 'rgba(249, 115, 22, 0.8)', 'rgba(249, 115, 22, 0.65)', 'rgba(249, 115, 22, 0.5)', 'rgba(249, 115, 22, 0.8)'];
                return colors[i % colors.length];
              }),
              borderRadius: 12, borderSkipped: false, barThickness: 28
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: getTooltipOpts(isDark, weightUnit) },
            scales: {
              x: { grid: { display: false }, ticks: { color: tickColor, font: { family: "'Inter', sans-serif", weight: '500' } } },
              y: { beginAtZero: true, min: 0, grid: { color: gridColor, borderDash: [5, 5], drawBorder: false }, ticks: { color: tickColor, font: { family: "'Inter', sans-serif", weight: '500' } } }
            }
          }
        });
      }
    }, 80);

    return () => {
      ['steps', 'calories'].forEach(k => {
        if (chartInstances.current[k]) { chartInstances.current[k].destroy(); chartInstances.current[k] = null; }
      });
    };
  }, [activeTab, activitySubTab, loading, healthData]);

  /* ─── Chart rendering for Records sub-tab ─── */
  useEffect(() => {
    if (activeTab !== 'activity' || activitySubTab !== 'records' || loading || !window.Chart) return;

    if (chartInstances.current.pie) { chartInstances.current.pie.destroy(); chartInstances.current.pie = null; }

    const isDark = document.documentElement.classList.contains('dark');
    const categories = {};
    (records || []).forEach(r => {
      const cat = r.category || 'Other';
      categories[cat] = (categories[cat] || 0) + 1;
    });

    const catLabels = Object.keys(categories).length > 0 ? Object.keys(categories) : ['Blood Test', 'Imaging', 'Prescription', 'Other'];
    const catValues = Object.values(categories).length > 0 ? Object.values(categories) : [3, 2, 4, 1];
    const catColors = ['#06b6d4', '#8b5cf6', '#f97316', '#10b981', '#ef4444', '#3b82f6', '#f59e0b'];

    setTimeout(() => {
      if (recordsPieRef.current) {
        chartInstances.current.pie = new window.Chart(recordsPieRef.current, {
          type: 'doughnut',
          data: {
            labels: catLabels,
            datasets: [{
              data: catValues,
              backgroundColor: catColors.slice(0, catLabels.length),
              borderWidth: 0, hoverOffset: 8
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: '65%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { family: "'Inter', sans-serif", weight: '600', size: 12 }, color: '#64748b' }
              },
              tooltip: getTooltipOpts(isDark, weightUnit)
            }
          }
        });
      }
    }, 80);

    return () => {
      if (chartInstances.current.pie) { chartInstances.current.pie.destroy(); chartInstances.current.pie = null; }
    };
  }, [activeTab, activitySubTab, loading, records]);

  /* ─── Chart rendering for Lab Trends tab ─── */
  useEffect(() => {
    if (activeTab !== 'lab_trends' || loading || !window.Chart) return;

    if (chartInstances.current.lab_trends) {
      chartInstances.current.lab_trends.destroy();
      chartInstances.current.lab_trends = null;
    }

    if (!selectedLabMetric) return;

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
    const tickColor = isDark ? '#94a3b8' : '#94a3b8';

    const createGradient = (ctx, rgb) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, 250);
      gradient.addColorStop(0, `rgba(${rgb}, 0.4)`);
      gradient.addColorStop(1, `rgba(${rgb}, 0.0)`);
      return gradient;
    };

    // Filter metrics matching the selected name
    const metricData = labMetrics.filter(m => m.metric_name === selectedLabMetric);
    // Sort by date ascending
    metricData.sort((a, b) => new Date(a.recorded_date) - new Date(b.recorded_date));

    if (metricData.length === 0) return;

    const labels = metricData.map(m => new Date(m.recorded_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const dataValues = metricData.map(m => parseFloat(m.value) || 0);
    const unit = metricData[metricData.length - 1].unit || '';

    // Handle single data point
    if (labels.length === 1) {
      labels.unshift('Start');
      dataValues.unshift(dataValues[0]);
    }

    setTimeout(() => {
      if (labTrendChartRef.current) {
        const ctx = labTrendChartRef.current.getContext('2d');

        chartInstances.current.lab_trends = new window.Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: `${selectedLabMetric} ${unit ? `(${unit})` : ''}`,
              data: dataValues,
              borderColor: '#8b5cf6',
              backgroundColor: createGradient(ctx, '139, 92, 246'),
              borderWidth: 3,
              tension: 0.45,
              pointBackgroundColor: '#ffffff',
              pointBorderColor: '#8b5cf6',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                position: 'top', align: 'end',
                labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { family: "'Inter', sans-serif", weight: '600', size: 12 }, color: tickColor }
              },
              tooltip: getTooltipOpts(isDark, weightUnit)
            },
            scales: {
              x: { grid: { display: false, drawBorder: false }, ticks: { font: { family: "'Inter', sans-serif", weight: '500' }, color: tickColor } },
              y: { grid: { color: gridColor, drawBorder: false, borderDash: [5, 5] }, ticks: { font: { family: "'Inter', sans-serif", weight: '500' }, color: tickColor, padding: 8 }, beginAtZero: false }
            }
          }
        });
      }
    }, 80);

    return () => {
      if (chartInstances.current.lab_trends) {
        chartInstances.current.lab_trends.destroy();
        chartInstances.current.lab_trends = null;
      }
    };
  }, [activeTab, loading, labMetrics, selectedLabMetric]);

  /* ─── Helper functions ─── */
  const getLatestValue = (entries, key = 'value') => {
    if (!entries || entries.length === 0) return '--';
    return entries[entries.length - 1][key] || '--';
  };

  const getTrend = (entries, key = 'value') => {
    if (!entries || entries.length < 2) return { trend: 'stable', value: '--' };
    const curr = entries[entries.length - 1][key] || 0;
    const prev = entries[entries.length - 2][key] || 0;
    const diff = curr - prev;
    if (diff > 0) return { trend: 'up', value: `+${diff.toFixed(1)}` };
    if (diff < 0) return { trend: 'down', value: diff.toFixed(1) };
    return { trend: 'stable', value: '0' };
  };

  /* ─── Medicine Adherence Calculations ─── */
  const activeMeds = medicines.filter(m => m.is_active);
  const totalScheduled = activeMeds.length * (medLogs.length > 0 ? 1 : 1); // simplified
  const takenCount = medLogs.filter(l => l.status === 'taken').length;
  const adherencePercent = activeMeds.length > 0 && medLogs.length > 0
    ? Math.round((takenCount / Math.max(medLogs.length, 1)) * 100)
    : activeMeds.length > 0 ? 85 : 0; // fallback 85% if no logs yet

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-gray-500 dark:text-gray-400 font-medium">{t('loading') || 'Loading Analytics...'}</p>
      </div>
    );
  }

  const tabs = [
    { id: 'vitals', icon: HeartPulse, label: t('health_vitals') || 'Health Vitals' },
    { id: 'adherence', icon: Pill, label: t('medicine_adherence') || 'Medicine Adherence' },
    { id: 'risk', icon: Target, label: t('health_risk_score') || 'Health Risk Score' },
    { id: 'activity', icon: Activity, label: t('activity_records') || 'Activity & Records' },
    { id: 'lab_trends', icon: FileText, label: t('Lab Trends') || 'Lab Trends' }
  ];

  const weightTrend = getTrend(healthData.weight);
  const hrTrend = getTrend(healthData.heart_rate);
  const bpTrend = getTrend(healthData.blood_pressure);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20">

      {/* ─── Header ─── */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-6 relative z-10 w-full">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <BarChart3 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1">
              {t('smart_analytics') || 'Smart Analytics'}
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              {t('deep_insights') || 'Deep insights into your health journey'}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Tab Bar ─── */}
      <div className="flex flex-wrap items-center bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 w-fit">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${isActive
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ─── TAB 1: HEALTH VITALS ─── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === 'vitals' && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard icon={Scale} title={t('weight') || 'Weight'} value={getLatestValue(healthData.weight) ? displayWeight(getLatestValue(healthData.weight)).value : '--'} subtitle={`${weightUnit} (${t('last_reading') || 'Last reading'})`} trend={weightTrend.trend} trendValue={weightTrend.value} colorClass="bg-cyan-500 text-cyan-500" />
            <StatCard icon={HeartPulse} title={t('heart_rate_caps') || 'Heart Rate'} value={getLatestValue(healthData.heart_rate)} subtitle={t('bpm_last') || 'bpm (Last reading)'} trend={hrTrend.trend} trendValue={hrTrend.value} colorClass="bg-rose-500 text-rose-500" />
            <StatCard icon={Activity} title={t('blood_pressure') || 'Blood Pressure'} value={`${getLatestValue(healthData.blood_pressure, 'systolic') || getLatestValue(healthData.blood_pressure)}/${getLatestValue(healthData.blood_pressure, 'diastolic') || getLatestValue(healthData.blood_pressure, 'secondary_value') || '--'}`} subtitle={t('mmhg_last') || 'mmHg (Last reading)'} trend={bpTrend.trend} trendValue={bpTrend.value} colorClass="bg-orange-500 text-orange-500" />
          </div>

          {/* Timeframe selector */}
          <div className="flex justify-end">
            <div className="flex bg-gray-50 dark:bg-gray-900/50 p-1 rounded-xl border border-gray-100 dark:border-gray-700">
              {[{ v: '1month', l: t('1_month') || '1 Month' }, { v: '3months', l: t('3_months') || '3 Months' }, { v: '6months', l: t('6_months') || '6 Months' }].map(tf => (
                <button key={tf.v} onClick={() => setVitalsTimeframe(tf.v)}
                  className={`px-3 py-1.5 text-xs font-bold whitespace-nowrap rounded-lg transition-all ${vitalsTimeframe === tf.v ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >{tf.l}</button>
              ))}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
              <SectionHeader title={t('vitals_trend') || 'Vitals Trend'} subtitle={t('weight_heart_rate') || 'Weight & Heart Rate'} className="mb-6" />
              <div className="h-[280px] relative"><canvas ref={vitalsChartRef}></canvas></div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
              <SectionHeader title={t('blood_pressure') || 'Blood Pressure'} subtitle={t('sys_dia') || 'Systolic & Diastolic'} className="mb-6" />
              <div className="h-[280px] relative"><canvas ref={bpChartRef}></canvas></div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ─── TAB 2: MEDICINE ADHERENCE ─── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === 'adherence' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Overall Adherence Gauge */}
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center">
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">{t('overall_adherence') || 'Overall Adherence'}</h3>
              <div className="relative w-44 h-44 mb-4">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-gray-100 dark:stroke-gray-700" />
                  <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                    stroke={adherencePercent >= 80 ? '#10b981' : adherencePercent >= 50 ? '#f59e0b' : '#ef4444'}
                    strokeDasharray="264" strokeDashoffset={264 - (264 * adherencePercent) / 100}
                    strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black" style={{ color: adherencePercent >= 80 ? '#10b981' : adherencePercent >= 50 ? '#f59e0b' : '#ef4444' }}>
                    {adherencePercent}%
                  </span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{t('taken') || 'Taken'}</span>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium text-center">
                {adherencePercent >= 80 ? (t('adherence_great') || 'Great consistency! Keep it up.') : adherencePercent >= 50 ? (t('adherence_medium') || 'Room for improvement.') : (t('adherence_low') || 'Try setting reminders.')}
              </p>
            </div>

            {/* Per-medicine adherence */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
              <SectionHeader title={t('per_medicine_adherence') || 'Per-Medicine Adherence'} subtitle={t('following_prescription') || "How well you're following each prescription"} className="mb-6" />
              <div className="space-y-5">
                {activeMeds.length === 0 ? (
                  <p className="text-gray-400 dark:text-gray-500 text-center py-8 font-medium">{t('no_meds_adherence') || 'No active medications found. Add medicines to track adherence.'}</p>
                ) : activeMeds.map((med, i) => {
                  const medSpecificLogs = medLogs.filter(l => l.medicine_id === med.id);
                  const taken = medSpecificLogs.filter(l => l.status === 'taken').length;
                  const total = Math.max(medSpecificLogs.length, 1);
                  const pct = Math.round((taken / total) * 100);

                  return (
                    <div key={med.id || i}>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 flex items-center justify-center">
                            <Pill className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{med.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{med.dosage}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${pct >= 80 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : pct >= 50 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-500'}`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 30-day heatmap */}
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
            <SectionHeader title={t('30_day_overview') || '30-Day Overview'} subtitle={t('medicine_intake_pattern') || 'Medicine intake pattern'} className="mb-6" />
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 30 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - (29 - i));
                const dayLogs = medLogs.filter(l => {
                  const ld = new Date(l.date || l.created_at);
                  return ld.toDateString() === d.toDateString();
                });
                const isPastDay = d.setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
                const hasTaken = dayLogs.some(l => l.status === 'taken');

                const missedNames = [];
                // Explicitly marked as missed or pending on past day
                dayLogs.forEach(l => {
                  if (l.status === 'missed' || (isPastDay && l.status === 'pending')) {
                    const m = medicines.find(med => med.id === l.medicine_id);
                    if (m && !missedNames.includes(m.name)) missedNames.push(m.name);
                  }
                });

                // Infer missed: if it's a past day, any active scheduled medicine without a taken log is missed
                if (isPastDay) {
                  activeMeds.forEach(m => {
                    const dStart = new Date(d);
                    const createdAt = new Date(m.created_at || m.start_date || dStart);
                    if (createdAt <= dStart && m.frequency !== 'as_needed') {
                      const wasTaken = dayLogs.some(l => l.medicine_id === m.id && l.status === 'taken');
                      if (!wasTaken && !missedNames.includes(m.name)) {
                        missedNames.push(m.name);
                      }
                    }
                  });
                }

                const hasMissed = missedNames.length > 0;
                const isToday = d.toDateString() === new Date().toDateString();

                let bg = 'bg-gray-100 dark:bg-gray-700'; // no data
                if (hasMissed && hasTaken) bg = 'bg-amber-400 dark:bg-amber-500';
                else if (hasMissed) bg = 'bg-rose-400 dark:bg-rose-500';
                else if (hasTaken) bg = 'bg-emerald-400 dark:bg-emerald-500';

                let titleStr = `${d.toLocaleDateString()} — `;
                if (hasTaken && !hasMissed) titleStr += t('taken') || 'All Taken';
                else if (hasMissed && hasTaken) titleStr += `${t('partial') || 'Partial'} (Missed: ${missedNames.join(', ')})`;
                else if (hasMissed) titleStr += `${t('missed') || 'Missed'} (${missedNames.join(', ')})`;
                else titleStr += t('no_data') || 'No data';

                return (
                  <div key={i} className={`w-7 h-7 rounded-lg ${bg} ${isToday ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-800' : ''} transition-all`}
                    title={titleStr}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs font-bold text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-400"></span> {t('taken') || 'Taken'}</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400"></span> {t('partial') || 'Partial'}</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-400"></span> {t('missed') || 'Missed'}</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-200 dark:bg-gray-600"></span> {t('no_data') || 'No data'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ─── TAB 3: HEALTH RISK SCORE ─── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === 'risk' && (
        <div className="space-y-6">
          {/* Hero Score - Premium Banner */}
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 px-8 py-6 lg:px-12 relative overflow-hidden group">
            <div className="relative z-10 flex flex-row items-center justify-between w-full gap-10">

              {/* Left Side: Text & Insights */}
              <div className="text-left flex flex-col justify-center flex-1">
                <h3 className="text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-5 tracking-tight leading-tight">
                  {t('holistic') || 'Holistic'} <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">{t('health_score_caps') || 'Health Score'}</span>
                </h3>
                <p className="text-gray-500 dark:text-gray-400 font-medium text-sm lg:text-base leading-relaxed mb-8 max-w-lg">
                  {t('score_description') || 'This score is dynamically calculated by analyzing your daily vitals, ongoing physical activity, and medical history. Maintaining a score above 80 significantly reduces your risk of chronic conditions.'}
                </p>
                <div className="flex items-center justify-start gap-8">
                  <div className="flex flex-col">
                    <span className="text-2xl font-black text-gray-900 dark:text-white">4+</span>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-1">{t('metrics_analyzed') || 'Metrics Analyzed'}</span>
                  </div>
                  <div className="w-px h-10 bg-gray-200 dark:bg-gray-700"></div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-black text-gray-900 dark:text-white">24/7</span>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-1">{t('continuous_tracking') || 'Continuous Tracking'}</span>
                  </div>
                </div>
              </div>

              {/* Right Side: Score Circle */}
              <div className="relative w-64 h-64 shrink-0 transition-transform duration-700 hover:scale-105 ml-auto">
                <svg className="w-full h-full transform -rotate-90 drop-shadow-sm" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" strokeWidth="6" className="stroke-gray-100 dark:stroke-gray-700" />
                  <circle cx="50" cy="50" r="42" fill="none"
                    stroke={riskData?.overall_score > 70 ? '#10b981' : riskData?.overall_score > 40 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="8" strokeDasharray="264"
                    strokeDashoffset={264 - (264 * (riskData?.overall_score || 0)) / 100}
                    strokeLinecap="round" className="transition-all duration-1500 ease-out" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-6xl font-black drop-shadow-sm" style={{ color: riskData?.overall_score > 70 ? '#10b981' : riskData?.overall_score > 40 ? '#f59e0b' : '#ef4444' }}>
                    {riskData?.overall_score || 0}
                  </span>
                  <span className="text-xs font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mt-2">{t('overall_score') || 'Overall Score'}</span>
                </div>
              </div>

            </div>
          </div>

          {/* Risk Breakdown Cards - Matches StatCard Style */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(riskData?.risks || []).map((r, i) => {
              const level = r.score > 60 ? 'High' : r.score > 35 ? 'Medium' : 'Low';

              const colorInfo = level === 'Low'
                ? { base: 'emerald', tagBg: 'bg-emerald-50 dark:bg-emerald-900/30', tagText: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-500', bg: 'bg-emerald-500' }
                : level === 'Medium'
                  ? { base: 'amber', tagBg: 'bg-amber-50 dark:bg-amber-900/30', tagText: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-500', bg: 'bg-amber-500' }
                  : { base: 'rose', tagBg: 'bg-rose-50 dark:bg-rose-900/30', tagText: 'text-rose-600 dark:text-rose-400', iconBg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-500', bg: 'bg-rose-500' };

              const tips = {
                'Heart Disease': 'Regular cardio exercise and low-sodium diet recommended.',
                'Diabetes': 'Monitor sugar intake and maintain healthy BMI.',
                'Hypertension': 'Reduce stress, limit sodium, exercise regularly.',
                'Kidney Disease': 'Stay hydrated and manage blood pressure.'
              };

              // Map backend emoji/icon to our Lucide theme icons
              const getThemeIcon = (name) => {
                if (name === 'Heart Disease') return <HeartPulse className={`w-8 h-8 ${colorInfo.text}`} strokeWidth={2} />;
                if (name === 'Diabetes') return <Activity className={`w-8 h-8 ${colorInfo.text}`} strokeWidth={2} />;
                if (name === 'Hypertension') return <Flame className={`w-8 h-8 ${colorInfo.text}`} strokeWidth={2} />;
                if (name === 'Kidney Disease') return <Droplet className={`w-8 h-8 ${colorInfo.text}`} strokeWidth={2} />;
                return <Activity className={`w-8 h-8 ${colorInfo.text}`} strokeWidth={2} />;
              };

              return (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 relative overflow-hidden group cursor-default flex flex-col justify-between">
                  {/* Decorative Blob */}
                  <div className={`absolute top-0 right-0 w-40 h-40 ${colorInfo.bg} opacity-10 rounded-bl-full -mr-10 -mt-10 transition-transform duration-700 group-hover:scale-110 pointer-events-none`}></div>

                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className={`p-3.5 ${colorInfo.iconBg} rounded-2xl shadow-sm transition-transform duration-300 ease-out group-hover:scale-110 flex items-center justify-center`}>
                          {getThemeIcon(r.name)}
                        </div>
                        <h4 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">{r.name}</h4>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${colorInfo.tagBg} ${colorInfo.tagText} shadow-sm uppercase tracking-wider border border-transparent`}>{level} Risk</span>
                    </div>

                    <div className="flex items-baseline justify-between mb-2">
                      <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('risk_score') || 'Risk Score'}</p>
                      <span className={`text-3xl font-black ${colorInfo.text}`}>{Math.round(r.score)}%</span>
                    </div>

                    <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-6 shadow-inner">
                      <div className={`h-full ${colorInfo.bg} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${r.score}%` }}></div>
                    </div>

                    <div className="mb-6">
                      <div className="flex flex-wrap gap-2">
                        {r.factors.map(f => (
                          <span key={f} className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 rounded-xl text-[10px] font-bold border border-gray-100 dark:border-gray-700/50 uppercase tracking-widest">{f}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 mt-auto bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-4 border border-indigo-100 dark:border-indigo-800/30 flex items-start gap-3 transition-colors group-hover:bg-indigo-100/50 dark:group-hover:bg-indigo-900/30">
                    <Sparkles className="w-5 h-5 shrink-0 text-indigo-500 mt-0.5" />
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 leading-relaxed">{tips[r.name] || (t('healthy_lifestyle') || 'Maintain a healthy lifestyle.')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ─── TAB 4: ACTIVITY & RECORDS ─── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === 'activity' && (
        <div className="space-y-6">
          {/* Sub-tab switcher */}
          <div className="flex items-center bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 w-fit">
            <button onClick={() => setActivitySubTab('fitness')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activitySubTab === 'fitness' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Dumbbell className="w-4 h-4" /> {t('fitness_activity') || 'Fitness & Activity'}
            </button>
            <button onClick={() => setActivitySubTab('records')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activitySubTab === 'records' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Folder className="w-4 h-4" /> {t('medical_records') || 'Medical Records'}
            </button>
          </div>

          {/* ─── Sub-Tab: Fitness & Activity ─── */}
          {activitySubTab === 'fitness' && (
            <div className="space-y-6">
              {/* Stat cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard icon={Activity} title={t('steps_today') || 'Steps Today'} value={(fitnessStats?.steps || 0).toLocaleString()} subtitle={`${t('goal') || 'Goal'}: ${(fitnessStats?.step_goal || 10000).toLocaleString()}`} colorClass="bg-emerald-500 text-emerald-500" />
                <StatCard icon={Flame} title={t('calories_burned') || 'Calories Burned'} value={fitnessStats?.calories_burned || 0} subtitle={t('kcal_active') || 'Kcal active'} colorClass="bg-orange-500 text-orange-500" />
                <StatCard icon={CalendarCheck} title={t('step_goal') || 'Step Goal'} value={`${Math.round(((fitnessStats?.steps || 0) / (fitnessStats?.step_goal || 10000)) * 100)}%`} subtitle={t('completed') || 'Completed'} colorClass="bg-indigo-500 text-indigo-500" />
              </div>

              {/* Fitness goal rings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Step Goal Ring */}
                <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-8">
                  <div className="relative w-28 h-28 shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-gray-100 dark:stroke-gray-700" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray="264"
                        strokeDashoffset={264 - (264 * Math.min((fitnessStats?.steps || 0) / (fitnessStats?.step_goal || 10000), 1))}
                        strokeLinecap="round" className="transition-all duration-1000" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Activity className="w-7 h-7 text-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-extrabold text-gray-900 dark:text-white">{t('step_goal') || 'Step Goal'}</h4>
                    <p className="text-3xl font-black text-emerald-500 mt-1">{(fitnessStats?.steps || 0).toLocaleString()}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{(t('of_steps') || 'of {count} steps').replace('{count}', (fitnessStats?.step_goal || 10000).toLocaleString())}</p>
                  </div>
                </div>
                {/* Calorie Goal Ring */}
                <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-8">
                  <div className="relative w-28 h-28 shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-gray-100 dark:stroke-gray-700" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#f97316" strokeWidth="8" strokeDasharray="264"
                        strokeDashoffset={264 - (264 * Math.min((fitnessStats?.calories_burned || 0) / activeCalorieGoal, 1))}
                        strokeLinecap="round" className="transition-all duration-1000" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Flame className="w-7 h-7 text-orange-500" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-extrabold text-gray-900 dark:text-white">{t('calorie_goal') || 'Calorie Goal'}</h4>
                    <p className="text-3xl font-black text-orange-500 mt-1">{fitnessStats?.calories_burned || 0}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{(t('of_kcal_target') || 'of {count} kcal target').replace('{count}', activeCalorieGoal)}</p>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                  <SectionHeader title={t('steps_trend') || 'Steps Trend'} subtitle={t('last_7_days') || 'Last 7 days'} className="mb-6" />
                  <div className="h-[240px] relative"><canvas ref={stepsChartRef}></canvas></div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                  <SectionHeader title={t('calories_burned') || 'Calories Burned'} subtitle={t('last_7_days') || 'Last 7 days'} className="mb-6" />
                  <div className="h-[240px] relative"><canvas ref={caloriesChartRef}></canvas></div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Sub-Tab: Medical Records ─── */}
          {activitySubTab === 'records' && (
            <div className="space-y-6">
              {/* Category count cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { cat: 'Blood Test', icon: Droplet, colorClass: 'bg-rose-500 text-rose-500' },
                  { cat: 'Imaging', icon: ImageIcon, colorClass: 'bg-sky-500 text-sky-500' },
                  { cat: 'Prescription', icon: FileText, colorClass: 'bg-purple-500 text-purple-500' },
                  { cat: 'Appointment', icon: Stethoscope, colorClass: 'bg-emerald-500 text-emerald-500' }
                ].map(({ cat, icon: CatIcon, colorClass }) => {
                  const count = cat === 'Appointment' ? appointments.length : records.filter(r => r.category === cat).length;
                  const catKey = cat === 'Appointment' ? 'appointment_cat' : cat.toLowerCase().replace(' ', '_');
                  return (
                    <StatCard
                      key={cat}
                      title={`${t(catKey) || cat}`}
                      value={count}
                      subtitle={t('total_records') || 'Total records'}
                      icon={CatIcon}
                      colorClass={colorClass}
                    />
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Donut chart */}
                <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                  <SectionHeader title={t('records_breakdown') || 'Records Breakdown'} subtitle={t('by_category') || 'By category'} className="mb-6" />
                  <div className="h-[280px] relative"><canvas ref={recordsPieRef}></canvas></div>
                </div>

                {/* Recent records */}
                <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                  <SectionHeader title={t('recent_records') || 'Recent Records'} subtitle={t('latest_medical_records') || 'Latest medical records'} className="mb-6" />
                  <div className="space-y-3">
                    {records.length === 0 ? (
                      <p className="text-gray-400 dark:text-gray-500 text-center py-8 font-medium">{t('no_records_uploaded') || 'No records uploaded yet.'}</p>
                    ) : records.slice(0, 5).map((r, i) => {
                      const catColor = {
                        'Blood Test': 'text-rose-500 bg-rose-50 dark:bg-rose-900/20',
                        'Imaging': 'text-sky-500 bg-sky-50 dark:bg-sky-900/20',
                        'Prescription': 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20',
                        'Appointment': 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      }[r.category] || 'text-gray-500 bg-gray-50 dark:bg-gray-900/20';

                      return (
                        <div key={r.id || i} className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${catColor}`}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{r.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{r.date || 'N/A'} · {r.hospital || ''}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${catColor}`}>{r.category}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ─── TAB 5: LAB TRENDS ─── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === 'lab_trends' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4 w-full text-left">
              <SectionHeader title={t('lab_trends') || 'Lab Trends'} subtitle={t('track_extracted_metrics') || 'Track AI-extracted metrics over time'} className="mb-0 w-full justify-start" />

              <div className="w-full md:w-64">
                <select
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  value={selectedLabMetric}
                  onChange={(e) => setSelectedLabMetric(e.target.value)}
                >
                  <option value="" disabled>{t('select_metric') || 'Select a metric'}</option>
                  {[...new Set(labMetrics.map(m => m.metric_name))].map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            {labMetrics.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-[2rem] p-12 text-center border border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-white dark:bg-gray-800 text-gray-300 dark:text-gray-500 rounded-full flex items-center justify-center mb-4 shadow-sm">
                  <Clock className="w-10 h-10 text-indigo-500 opacity-50" />
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">Coming Soon</h3>
                <p className="text-gray-500 dark:text-gray-400 font-medium max-w-sm">
                  This feature is currently under development and will be available in a future update.
                </p>
              </div>
            ) : !selectedLabMetric ? (
              <div className="h-[300px] flex items-center justify-center bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400 font-medium">Select a metric from the dropdown to view its trend.</p>
              </div>
            ) : (
              <div className="h-[400px] relative w-full">
                <canvas ref={labTrendChartRef}></canvas>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
