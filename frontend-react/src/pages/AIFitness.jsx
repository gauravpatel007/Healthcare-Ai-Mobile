import React, { useState, useEffect } from 'react';
import API from '../utils/api';
import { useLang } from '../contexts/LangContext';
import {
  Activity,
  Footprints,
  Ruler,
  Flame,
  Timer,
  HeartPulse,
  Dumbbell,
  PersonStanding,
  Plus,
  Minus,
  CheckCircle,
  CalendarDays,
  Target,
  X,
  RefreshCcw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import MedicalDisclaimer from '../components/MedicalDisclaimer';

const StatCard = ({ title, value, subtitle, icon: Icon, colorClass, onClick }) => (
  <div
    onClick={onClick}
    tabIndex={0}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e); } }}
    className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 relative overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

const AIFitness = ({ voiceAction, onVoiceActionConsumed }) => {
  const { t } = useLang();
  const [stats, setStats] = useState({ steps: 0, calories_burned: 0, active_minutes: 0, distance_km: 0, step_goal: 10000 });
  const [currentCategory, setCurrentCategory] = useState('cardio');
  const [customMinusVal, setCustomMinusVal] = useState('');
  const [customAddVal, setCustomAddVal] = useState('');
  const [exercises, setExercises] = useState([]);
  const [weeklyPlan, setWeeklyPlan] = useState([]);
  const [selectedDayPlan, setSelectedDayPlan] = useState(null);
  const [dayPlanDetails, setDayPlanDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  const regenerateWeeklyPlan = async () => {
    setIsGeneratingPlan(true);
    try {
      const planRes = await API.post('/ai/fitness/regenerate-plan');
      if (planRes?.plan) setWeeklyPlan(planRes.plan);
    } catch (e) {
      console.error(e);
      toast.error(t('Failed to regenerate workout plan'));
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const getMockGymSets = (workoutName) => {
    const w = workoutName.toLowerCase();
    if (w.includes('rest')) return [
      { name: 'Light Walk', sets: '1', reps: '15 min' },
      { name: 'Dynamic Stretching', sets: '2', reps: '10 min' },
      { name: 'Foam Rolling', sets: '1', reps: '5 min' }
    ];
    if (w.includes('upper body')) return [
      { name: 'Barbell Bench Press', sets: '4', reps: '8-10' },
      { name: 'Lat Pulldowns', sets: '3', reps: '10-12' },
      { name: 'Overhead Dumbbell Press', sets: '3', reps: '10' },
      { name: 'Bicep Curls', sets: '3', reps: '12' },
      { name: 'Tricep Extensions', sets: '3', reps: '12' }
    ];
    if (w.includes('lower body')) return [
      { name: 'Barbell Squats', sets: '4', reps: '8' },
      { name: 'Romanian Deadlifts', sets: '3', reps: '10' },
      { name: 'Leg Press', sets: '3', reps: '10-12' },
      { name: 'Leg Curls', sets: '3', reps: '12' },
      { name: 'Calf Raises', sets: '4', reps: '15' }
    ];
    if (w.includes('yoga') || w.includes('flexibility')) return [
      { name: 'Sun Salutations', sets: '3', reps: '5 mins' },
      { name: 'Warrior Sequence', sets: '2', reps: '10 mins' },
      { name: 'Downward Dog Hold', sets: '3', reps: '1 min' },
      { name: "Child's Pose", sets: '1', reps: '5 mins' }
    ];
    if (w.includes('hiit')) return [
      { name: 'Jump Squats', sets: '4', reps: '45s work / 15s rest' },
      { name: 'Burpees', sets: '4', reps: '45s work / 15s rest' },
      { name: 'Mountain Climbers', sets: '4', reps: '45s work / 15s rest' },
      { name: 'High Knees', sets: '4', reps: '45s work / 15s rest' },
      { name: 'Plank Hold', sets: '4', reps: '60s' }
    ];
    if (w.includes('full body')) return [
      { name: 'Deadlifts', sets: '4', reps: '5' },
      { name: 'Pull-ups', sets: '3', reps: 'Max' },
      { name: 'Push-ups', sets: '3', reps: '15-20' },
      { name: 'Dumbbell Lunges', sets: '3', reps: '10 per leg' },
      { name: 'Russian Twists', sets: '3', reps: '20' }
    ];
    return [
      { name: 'Treadmill Warmup', sets: '1', reps: '10 min' },
      { name: 'Rowing Intervals', sets: '5', reps: '500m' },
      { name: 'Jump Rope', sets: '3', reps: '3 mins' },
      { name: 'Cool Down Jog', sets: '1', reps: '10 min' }
    ];
  };

  const handleDayClick = async (d) => {
    setSelectedDayPlan(d);
    if (d.rest) {
      setDayPlanDetails(getMockGymSets('rest'));
      return;
    }
    
    setIsLoadingDetails(true);
    setDayPlanDetails(null);
    try {
      const res = await API.post('/ai/fitness/generate-workout-details', { workout_name: d.workout });
      if (res?.exercises) {
        setDayPlanDetails(res.exercises);
      } else {
        setDayPlanDetails(getMockGymSets(d.workout));
      }
    } catch (e) {
      console.error(e);
      setDayPlanDetails(getMockGymSets(d.workout));
    } finally {
      setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const statsRes = await API.get('/ai/fitness/stats');
        if (statsRes) setStats(statsRes);
      } catch (e) {
        console.error(e);
      }
    };
    const fetchWeeklyPlan = async () => {
      try {
        const planRes = await API.get('/ai/fitness/weekly-plan');
        if (planRes?.plan) setWeeklyPlan(planRes.plan);
      } catch (e) {
        console.error(e);
      }
    };
    fetchStats();
    fetchWeeklyPlan();
  }, []);

  useEffect(() => {
    const fetchWorkouts = async () => {
      try {
        const workoutRes = await API.get(`/ai/fitness/workout?category=${currentCategory}`);
        if (workoutRes?.exercises) setExercises(workoutRes.exercises);
      } catch (e) {
        console.error(e);
      }
    };
    fetchWorkouts();
  }, [currentCategory]);

  const refreshStats = async () => {
    try {
      const statsRes = await API.get('/ai/fitness/stats');
      if (statsRes) setStats(statsRes);
    } catch (e) {
      console.error(e);
    }
  };

  const addSteps = async (count) => {
    if (count === 0) return;
    try {
      await API.post(`/ai/fitness/steps?steps=${count}`);
      await refreshStats();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCustomMinus = (e) => {
    if (e.key === 'Enter') {
      const count = parseInt(customMinusVal, 10);
      if (!isNaN(count) && count > 0) {
        if (count > stats.steps) {
          toast.error(t('err_steps_exceed'));
        } else {
          addSteps(-count);
        }
      }
      setCustomMinusVal('');
    }
  };

  const logExercise = async (name, calories) => {
    try {
      await API.post(`/ai/fitness/log?exercise_name=${encodeURIComponent(name)}&duration_minutes=30&calories=${calories}`);
      await refreshStats();
      toast.success(`${name} logged! Burned ${calories} calories`);
    } catch (e) {
      console.error(e);
      toast.error(t('err_log_exercise'));
    }
  };

  useEffect(() => {
    if (voiceAction && voiceAction.target_feature === 'ai-fitness') {
      if (voiceAction.action_name === 'add_steps' && voiceAction.data?.steps) {
        addSteps(voiceAction.data.steps);
      } else if (voiceAction.action_name === 'remove_steps' && voiceAction.data?.steps) {
        if (voiceAction.data.steps > stats.steps) {
          toast.error(t('err_steps_exceed') || 'Cannot remove more steps than you have today.');
        } else {
          addSteps(-voiceAction.data.steps);
        }
      } else if (voiceAction.action_name === 'regenerate_plan') {
        const regenerate = async () => {
          try {
            const planRes = await API.post('/ai/fitness/regenerate-plan');
            if (planRes?.plan) setWeeklyPlan(planRes.plan);
            toast.success('Workout plan regenerated successfully!');
          } catch (e) {
            console.error(e);
            toast.error('Failed to regenerate workout plan');
          }
        };
        regenerate();
      } else if (voiceAction.action_name === 'log_exercise' && voiceAction.data?.exercise) {
        logExercise(voiceAction.data.exercise, voiceAction.data.calories || 150);
      }
      if (onVoiceActionConsumed) onVoiceActionConsumed();
    }
  }, [voiceAction, stats.steps]);

  const stepProgress = Math.min(100, (stats.steps / stats.step_goal) * 100);
  const strokeDashoffset = 565 - (565 * stepProgress) / 100;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20">

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-hidden w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Activity className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              {t('fit_title')}
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse shrink-0"></span>
              {t('fit_subtitle')}
            </p>
          </div>
        </div>
      </div>

      <MedicalDisclaimer />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          title={t('steps_today')}
          value={stats.steps.toLocaleString()}
          subtitle={`${t('goal_prefix')} ${stats.step_goal.toLocaleString()}`}
          icon={Footprints}
          colorClass="bg-emerald-500 text-emerald-500"
        />

        <StatCard
          title={t('distance')}
          value={stats.distance_km}
          subtitle={t('distance_km')}
          icon={Ruler}
          colorClass="bg-sky-500 text-sky-500"
        />

        <StatCard
          title={t('calories')}
          value={stats.calories_burned}
          subtitle={t('kcal_active')}
          icon={Flame}
          colorClass="bg-orange-500 text-orange-500"
        />

        <StatCard
          title={t('active_minutes')}
          value={stats.active_minutes}
          subtitle={t('duration_label')}
          icon={Timer}
          colorClass="bg-purple-500 text-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Step Counter */}
        <div className="lg:col-span-1 flex flex-col h-full">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center relative overflow-hidden flex-1 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Footprints className="w-5 h-5 text-emerald-500" />
                {t('step_counter')}
              </h3>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t('goal_prefix')} {stats.step_goal.toLocaleString()}
              </span>
            </div>

            <div className="relative w-48 h-48 mx-auto mb-8">
              <svg width="192" height="192" viewBox="0 0 200 200" className="transform -rotate-90 drop-shadow-sm">
                <circle cx="100" cy="100" r="90" fill="none" className="stroke-gray-100 dark:stroke-gray-700" strokeWidth="12" />
                <circle
                  cx="100" cy="100" r="90" fill="none"
                  stroke={stats.steps >= stats.step_goal ? 'currentColor' : 'currentColor'}
                  className={stats.steps >= stats.step_goal ? 'text-emerald-500' : 'text-blue-500'}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray="565"
                  strokeDashoffset={strokeDashoffset}
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {stats.steps.toLocaleString()}
                </div>
                <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mt-1">{t('steps_label')}</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full">
              <label className={`flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 rounded-xl px-4 py-3 cursor-text transition-colors w-full focus-within:ring-2 focus-within:ring-rose-500/20 border border-gray-100 dark:border-gray-800 ${stats.steps <= 0 ? 'opacity-50' : 'opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                <Minus className="w-4 h-4 text-rose-500 shrink-0 mr-2" />
                <input
                  type="number"
                  className="flex-1 bg-transparent border-0 outline-none focus:ring-0 text-gray-900 dark:text-white font-bold text-center p-0"
                  value={customMinusVal}
                  onChange={(e) => setCustomMinusVal(e.target.value)}
                  placeholder="0"
                  disabled={stats.steps <= 0}
                  onKeyDown={handleCustomMinus}
                />
              </label>

              <button onClick={() => addSteps(1000)} className="bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold py-3 px-5 rounded-xl transition-colors flex items-center justify-center gap-1 w-full">
                <Plus className="w-4 h-4" /> 1K
              </button>

              <button onClick={() => addSteps(5000)} className="bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold py-3 px-5 rounded-xl transition-colors flex items-center justify-center gap-1 w-full">
                <Plus className="w-4 h-4" /> 5K
              </button>

              <label className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 rounded-xl px-4 py-3 cursor-text transition-colors w-full focus-within:ring-2 focus-within:ring-emerald-500/20 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-800">
                <Plus className="w-4 h-4 text-emerald-500 shrink-0 mr-2" />
                <input
                  type="number"
                  className="flex-1 bg-transparent border-0 outline-none focus:ring-0 text-gray-900 dark:text-white font-bold text-center p-0"
                  value={customAddVal}
                  onChange={(e) => setCustomAddVal(e.target.value)}
                  placeholder="0"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const count = parseInt(customAddVal, 10);
                      if (!isNaN(count) && count > 0) addSteps(count);
                      setCustomAddVal('');
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Workouts */}
        <div className="lg:col-span-2 flex flex-col gap-6 h-full">

          {/* Categories */}
          <div className="flex items-center bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 w-full overflow-x-auto">
            {[
              { id: 'cardio', label: t('cat_cardio'), icon: HeartPulse },
              { id: 'strength', label: t('cat_strength'), icon: Dumbbell },
              { id: 'yoga', label: t('cat_yoga'), icon: PersonStanding }
            ].map(cat => (
              <button
                key={cat.id}
                className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap ${currentCategory === cat.id
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                onClick={() => setCurrentCategory(cat.id)}
              >
                <cat.icon className="w-4 h-4" />
                {cat.label}
              </button>
            ))}
          </div>

          {/* Exercise Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 flex-1">
            {exercises.map((e, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="w-12 h-12 bg-gray-50 dark:bg-gray-700/50 rounded-2xl flex items-center justify-center text-2xl mb-4">
                    {e.icon}
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white mb-1">{t(e.name)}</h4>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">{e.duration || e.reps}</p>
                </div>

                <div className="space-y-4 mt-auto">
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg text-xs font-bold flex items-center gap-1">
                      <Flame className="w-3 h-3" /> {e.calories} cal
                    </span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${e.difficulty === 'Easy' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                      e.difficulty === 'Hard' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' :
                        'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                      }`}>
                      {e.difficulty}
                    </span>
                  </div>

                  <button
                    className="w-full py-3 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white dark:bg-blue-900/30 dark:hover:bg-blue-600 dark:text-blue-400 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                    onClick={() => logExercise(e.name, e.calories)}
                  >
                    <CheckCircle className="w-4 h-4" /> {t('log_workout_btn')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly Plan (Horizontally Stretched at Bottom) */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-500 shrink-0" />
            {t('weekly_workout_plan')}
          </h3>
          <button
            onClick={regenerateWeeklyPlan}
            disabled={isGeneratingPlan}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold text-sm transition-all border border-indigo-100 dark:border-indigo-800 disabled:opacity-50"
          >
            <RefreshCcw className={`w-4 h-4 shrink-0 ${isGeneratingPlan ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('regenerate')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {weeklyPlan.map((d, i) => (
            <div
              key={i}
              onClick={() => handleDayClick(d)}
              className="flex flex-col p-5 rounded-[2rem] bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/50 dark:hover:bg-gray-800 transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-700 cursor-pointer hover:shadow-md hover:-translate-y-1 group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-inner ${d.rest
                  ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-500'
                  : 'bg-blue-50 dark:bg-blue-900/30 text-blue-500'
                  }`}>
                  {d.icon}
                </div>
                <span className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm ${d.rest
                  ? 'bg-white dark:bg-gray-800 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30'
                  : 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30'
                  }`}>
                  {d.duration}
                </span>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-1">{t(d.day)}</h4>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t(d.workout)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Workout Plan Modal */}
      {selectedDayPlan && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-md transition-opacity"
            onClick={() => setSelectedDayPlan(null)}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col transform transition-all">

            {/* Header */}
            <div className={`p-6 lg:p-8 flex items-center justify-between border-b ${selectedDayPlan.rest
              ? 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30'
              : 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30'
              }`}>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${selectedDayPlan.rest
                  ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-500'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-500'
                  }`}>
                  {selectedDayPlan.icon}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{t(selectedDayPlan.day)}</h3>
                  <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-1">{t(selectedDayPlan.workout)} • {selectedDayPlan.duration}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDayPlan(null)}
                className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body: Gym Sets */}
            <div className="p-6 lg:p-8 overflow-y-auto max-h-[60vh]">
              <div className="flex items-center gap-2 mb-6 text-indigo-600 dark:text-indigo-400">
                <Activity className="w-5 h-5" />
                <h4 className="font-bold text-lg">{t('ai_generated_plan')}</h4>
              </div>

              <div className="space-y-4">
                {isLoadingDetails ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
                    <p className="text-gray-500 font-medium">{t('Generating activities...')}</p>
                  </div>
                ) : (
                  (dayPlanDetails || []).map((set, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                      <div>
                        <h5 className="font-bold text-gray-900 dark:text-white mb-1">{t(set.name)}</h5>
                        <span className="text-xs font-semibold px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg">
                          {set.sets} {t('sets_label')}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{set.reps}</div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">
                          {selectedDayPlan.rest || set.reps.includes('min') ? t('duration_col') : t('reps_col')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default AIFitness;
