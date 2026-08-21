import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import API from '../utils/api';
import { useLang } from '../contexts/LangContext';
import { 
  SmilePlus, 
  Sparkles, 
  Brain, 
  Activity, 
  BookHeart, 
  Wind,
  Heart,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  X,
  Save,
  Check,
  Mic,
  MicOff
} from 'lucide-react';

const meditations = [
  { name: 'Deep Breathing', duration: '5 min', icon: '🌬️', desc: 'Inhale 4s, hold 7s, exhale 8s' },
  { name: 'Body Scan', duration: '10 min', icon: '🧘', desc: 'Progressive muscle relaxation' },
  { name: 'Mindful Walking', duration: '15 min', icon: '🚶', desc: 'Focus on each step and breath' },
  { name: 'Gratitude Meditation', duration: '5 min', icon: '🙏', desc: "Reflect on 3 things you're grateful for" },
  { name: 'Loving Kindness', duration: '10 min', icon: '💗', desc: 'Send love to yourself and others' },
  { name: 'Sleep Meditation', duration: '15 min', icon: '🌙', desc: 'Guided relaxation for sleep' }
];

const screeningQuestions = [
  'Do you feel down, depressed, or hopeless?',
  'Do you have trouble falling or staying asleep?',
  'Do you feel tired or have little energy?',
  'Do you have poor appetite or overeating?',
  'Do you have trouble concentrating?',
  'Do you feel anxious or worried?'
];

const AFFIRMATIONS = [
  "You are capable of amazing things.",
  "Every day is a fresh start. Take a deep breath.",
  "You are stronger than you think you are.",
  "Embrace the glorious mess that you are.",
  "Your potential to succeed is infinite.",
  "Breathe in courage, exhale doubt.",
  "You deserve to be happy and at peace."
];

const AIMental = ({ voiceAction, onVoiceActionConsumed }) => {
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [moods, setMoods] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [stress, setStress] = useState(null);
  const [journalEntry, setJournalEntry] = useState('');
  const [journalAnalysis, setJournalAnalysis] = useState(null);
  
  const [selectedMood, setSelectedMood] = useState('');
  const [screeningAnswers, setScreeningAnswers] = useState({});
  const [screeningResult, setScreeningResult] = useState(null);

  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const [proactiveAction, setProactiveAction] = useState(null);

  const dailyAffirmation = AFFIRMATIONS[new Date().getDay() % AFFIRMATIONS.length];

  const [activeMeditation, setActiveMeditation] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [moodHistory, moodAnalysis, stressRes] = await Promise.all([
          API.get('/ai/mental/mood/history'),
          API.get('/ai/mental/mood/analysis'),
          API.get('/ai/mental/stress')
        ]);
        setMoods(moodHistory || []);
        setAnalysis(moodAnalysis);
        setStress(stressRes);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogMood = async (emoji) => {
    setSelectedMood(emoji);
    try {
      const res = await API.post('/ai/mental/mood', { mood: emoji, note: '' });
      if (res) {
        setMoods([res, ...moods]);
        const [moodAnalysis, stressRes] = await Promise.all([
          API.get('/ai/mental/mood/analysis'),
          API.get('/ai/mental/stress')
        ]);
        setAnalysis(moodAnalysis);
        setStress(stressRes);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveJournal = async () => {
    if (!journalEntry.trim()) {
      alert('Please write something first');
      return;
    }
    
    try {
      const res = await API.post('/ai/mental/journal', { 
        content: journalEntry,
        language: lang === 'hi' ? 'Hindi' : (lang === 'gu' ? 'Gujarati' : 'English')
      });
      if (res) {
        setJournalAnalysis({ sentiment: res.sentiment, ai_analysis: res.ai_analysis });
        setJournalEntry('');
        
        if (res.proactive_action) {
          setProactiveAction(res.proactive_action);
        }
        
        const moodHistory = await API.get('/ai/mental/mood/history');
        if (moodHistory) setMoods(moodHistory);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to save journal');
    }
  };

  const handleVoiceRecord = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser doesn't support voice recording.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang === 'hi' ? 'hi-IN' : (lang === 'gu' ? 'gu-IN' : 'en-US');

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setJournalEntry(prev => (prev ? prev + ' ' + finalTranscript : finalTranscript));
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  const handleStartMeditation = (meditation) => {
    setActiveMeditation(meditation);
    setTimerSeconds(0);
    setTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (voiceAction && voiceAction.target_feature === 'ai-mental') {
      if (voiceAction.action_name === 'start_meditation' && voiceAction.data?.meditation) {
        const target = meditations.find(m => m.name.toLowerCase().includes(voiceAction.data.meditation.toLowerCase()));
        if (target) {
          handleStartMeditation(target);
          setTimeout(() => toggleTimer(), 500); // Auto-start the timer
        }
      } else if (voiceAction.action_name === 'log_mood' && voiceAction.data?.mood) {
        const moodMap = {
          'great': '😄', 'good': '🙂', 'okay': '😐', 'low': '😔', 'sad': '😢', 'angry': '😡', 'anxious': '😰'
        };
        const moodLabel = voiceAction.data.mood.toLowerCase();
        const emoji = moodMap[moodLabel];
        if (emoji) {
          handleLogMood(emoji);
        }
      }
      if (onVoiceActionConsumed) onVoiceActionConsumed();
    }
  }, [voiceAction]);

  const toggleTimer = () => {
    if (timerRunning) {
      clearInterval(timerRef.current);
      setTimerRunning(false);
    } else {
      setTimerRunning(true);
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    }
  };

  const formatTimer = (seconds) => {
    const min = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = (seconds % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

  const handleScreeningAnswer = (index, value) => {
    setScreeningAnswers({ ...screeningAnswers, [index]: parseInt(value) });
  };

  const evaluateScreening = async () => {
    const answersArr = screeningQuestions.map((_, i) => screeningAnswers[i] || 0);
    try {
      const res = await API.post('/ai/mental/screening', { answers: answersArr });
      if (res) setScreeningResult(res);
    } catch (e) {
      console.error(e);
      alert('Failed to evaluate screening');
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
    </div>
  );

  const moodValues = { '😄': 5, '🙂': 4, '😐': 3, '😔': 2, '😢': 1, '😡': 1, '😰': 2 };
  const uniqueMoodsMap = new Map();
  [...moods].forEach(m => {
    const dateStr = new Date(m.created_at || m.date).toDateString();
    if (!uniqueMoodsMap.has(dateStr)) {
      uniqueMoodsMap.set(dateStr, m);
    }
  });
  
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7Days.push(d.toDateString());
  }

  const recentMoods = last7Days.map(dateStr => {
    if (uniqueMoodsMap.has(dateStr)) {
      return uniqueMoodsMap.get(dateStr);
    }
    return { isSkipped: true, dateStr: dateStr };
  });

  const hasData = recentMoods.some(m => !m.isSkipped);
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

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-start gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <SmilePlus className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1">{t("AI Mental Health")}</h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              {t("Track your mood, manage stress, and find peace")}
            </p>
          </div>
        </div>
      </div>

      {/* Mood Logger */}
      <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-32 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-8">{t("How are you feeling right now?")}</h3>
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8 relative z-10">
          {[
            { emoji: '😄', label: t('Great'), color: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30 ring-emerald-500' },
            { emoji: '🙂', label: t('Good'), color: 'hover:bg-teal-50 dark:hover:bg-teal-900/30 ring-teal-500' },
            { emoji: '😐', label: t('Okay'), color: 'hover:bg-gray-50 dark:hover:bg-gray-700/50 ring-gray-400' },
            { emoji: '😔', label: t('Low'), color: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30 ring-indigo-400' },
            { emoji: '😢', label: t('Sad'), color: 'hover:bg-blue-50 dark:hover:bg-blue-900/30 ring-blue-500' },
            { emoji: '😡', label: t('Angry'), color: 'hover:bg-red-50 dark:hover:bg-red-900/30 ring-red-500' },
            { emoji: '😰', label: t('Anxious'), color: 'hover:bg-amber-50 dark:hover:bg-amber-900/30 ring-amber-500' }
          ].map(m => (
            <div key={m.emoji} className="flex flex-col items-center gap-2 group">
              <button 
                className={`w-16 h-16 sm:w-20 sm:h-20 text-4xl sm:text-5xl rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${m.color} ${selectedMood === m.emoji ? 'ring-4 ring-offset-4 dark:ring-offset-gray-800 scale-110' : 'ring-1 ring-gray-200 dark:ring-gray-700 hover:scale-110 bg-white dark:bg-gray-800'} `}
                onClick={() => handleLogMood(m.emoji)}
              >
                {m.emoji}
              </button>
              <span className={`text-sm font-semibold transition-colors ${selectedMood === m.emoji ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'}`}>
                {m.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Row: Mood History & Stress Level */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Mood History & Analysis */}
        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-full">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-indigo-500" /> 
              {t("Mood History (Last 7 Days)")}
            </h4>
            
            {hasData ? (
              <div className="flex justify-between items-end h-40 mb-6 border-b border-gray-100 dark:border-gray-700 pb-2">
                {recentMoods.map((m, i) => {
                  if (m.isSkipped) {
                    const d = new Date(m.dateStr);
                    return (
                      <div key={i} className="flex flex-col items-center justify-end h-full flex-1 group opacity-40">
                        <span className="text-2xl mb-2 invisible">😐</span>
                        <div className="w-full max-w-[32px] rounded-t-xl bg-gray-200 dark:bg-gray-700 h-2"></div>
                        <span className="text-[10px] sm:text-xs font-semibold text-gray-400 mt-3 uppercase tracking-wider">
                          {d.toLocaleDateString('en', { weekday: 'short' })}
                        </span>
                      </div>
                    );
                  }

                  const height = (moodValues[m.mood] || 3) * 20;
                  let d = new Date();
                  try {
                    if (m.created_at || m.date) d = new Date(m.created_at || m.date);
                  } catch (e) { }

                  return (
                    <div key={i} className="flex flex-col items-center justify-end h-full flex-1 group">
                      <span className="text-2xl mb-2 transition-transform group-hover:scale-125 origin-bottom">{m.mood}</span>
                      <div 
                        className="w-full max-w-[32px] rounded-t-xl bg-gradient-to-t from-indigo-600 to-indigo-400 dark:from-indigo-500 dark:to-indigo-300 transition-all duration-500 ease-out group-hover:opacity-80" 
                        style={{ height: `${height}px` }}
                      ></div>
                      <span className="text-[10px] sm:text-xs font-semibold text-gray-400 mt-3 uppercase tracking-wider">
                        {d.toLocaleDateString('en', { weekday: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center mb-6">
                <p className="text-gray-400 font-medium">{t("No mood data yet. Start tracking!")}</p>
              </div>
            )}
            
            <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Brain className="w-24 h-24" />
              </div>
              <h5 className="flex items-center gap-2 text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2 relative z-10">
                <Sparkles className="w-4 h-4" /> {t("AI Mood Analysis")}
              </h5>
              <p className="text-sm text-gray-700 dark:text-gray-300 font-medium leading-relaxed relative z-10">
                {analysis ? t(analysis.analysis) : t("Start tracking your mood daily to get personalized insights!")}
              </p>
            </div>
        </div>

        {/* Stress Level */}
        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center h-full">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
              <Wind className="w-5 h-5 text-teal-500" />
              {t("Current Stress Level")}
            </h4>
            
            {stress ? (
              <div className="flex flex-col items-center justify-center gap-3 h-full pb-0">
                <div className="relative w-48 h-48 shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="96" cy="96" r="80" fill="none" className="stroke-gray-50 dark:stroke-gray-800" strokeWidth="16" />
                    <circle 
                      cx="96" cy="96" r="80" fill="none" 
                      className={`${stress.stress_level > 70 ? 'stroke-red-500' : stress.stress_level > 40 ? 'stroke-amber-500' : 'stroke-emerald-500'} transition-all duration-1500 ease-out`} 
                      strokeWidth="16" 
                      strokeDasharray="502" 
                      strokeDashoffset={502 - (502 * stress.stress_level) / 100} 
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-5xl font-extrabold tracking-tight ${stress.stress_level > 70 ? 'text-red-500' : stress.stress_level > 40 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {stress.stress_level}
                    </span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">{t("Score")}</span>
                  </div>
                </div>
                
                <div className={`px-6 py-4 rounded-2xl border ${
                  stress.stress_level > 70 
                    ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30 text-red-700 dark:text-red-400' 
                    : stress.stress_level > 40 
                      ? 'bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30 text-amber-700 dark:text-amber-400' 
                      : 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                } max-w-sm w-full text-center flex flex-col items-center gap-2 animate-in slide-in-from-bottom-4 fade-in duration-700 shadow-sm`}>
                  <div className="flex items-center gap-2 font-bold text-base">
                    {stress.stress_level > 70 ? <AlertTriangle className="w-5 h-5" /> : stress.stress_level > 40 ? <Activity className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    <span>{stress.stress_level > 70 ? t('High Stress Detected') : stress.stress_level > 40 ? t('Moderate Stress') : t('Low Stress Levels')}</span>
                  </div>
                  <p className="text-sm font-medium opacity-90 leading-relaxed">
                    {t(stress.advice)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-36 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin"></div>
              </div>
            )}
          </div>
      </div>

      {/* Bottom Row: Mood Journal */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col mb-6">
        <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <BookHeart className="w-5 h-5 text-pink-500" />
              {t("Mood Journal")}
            </h4>
            <div className="relative flex-1 flex flex-col">
              <textarea 
                className="w-full flex-1 min-h-[120px] bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none font-medium text-sm"
                value={journalEntry} 
                onChange={(e) => setJournalEntry(e.target.value)}
                placeholder={t("Write about your day, feelings, or thoughts... The AI will analyze your journal for insights.")}
              ></textarea>
              <div className="flex justify-between items-center mt-4">
                <span className="text-xs font-semibold text-gray-400 flex items-center gap-1"><Sparkles className="w-3 h-3"/> {t("AI Analyzed")}</span>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleVoiceRecord}
                    className={`p-2.5 rounded-xl transition-all ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
                    title="Record Voice Journal"
                  >
                    {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={handleSaveJournal}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 transition-transform hover:-translate-y-0.5 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> {t("Save Entry")}
                  </button>
                </div>
              </div>
            </div>

            {journalAnalysis && (
              <div className={`mt-5 p-4 rounded-xl border ${
                journalAnalysis.sentiment === 'Positive' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' :
                journalAnalysis.sentiment === 'Needs Attention' ? 'bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30' :
                'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30'
              } animate-in fade-in slide-in-from-top-2`}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className={`w-4 h-4 ${
                    journalAnalysis.sentiment === 'Positive' ? 'text-emerald-500' :
                    journalAnalysis.sentiment === 'Needs Attention' ? 'text-amber-500' :
                    'text-blue-500'
                  }`} />
                  <span className={`text-xs font-extrabold uppercase tracking-wider ${
                    journalAnalysis.sentiment === 'Positive' ? 'text-emerald-600 dark:text-emerald-400' :
                    journalAnalysis.sentiment === 'Needs Attention' ? 'text-amber-600 dark:text-amber-400' :
                    'text-blue-600 dark:text-blue-400'
                  }`}>
                    {t(journalAnalysis.sentiment)}
                  </span>
                </div>
                <div className="text-sm">
                  {renderMarkdown(journalAnalysis.ai_analysis)}
                </div>
              </div>
            )}
      </div>

      {/* Meditations */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <Wind className="w-6 h-6 text-indigo-500" /> {t("Meditation & Relaxation")}
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {meditations.map(m => (
            <div 
              key={m.name} 
              className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 flex items-center justify-between group cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
              onClick={() => handleStartMeditation(m)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  {m.icon}
                </div>
                <div>
                  <h5 className="font-bold text-gray-900 dark:text-white">{t(m.name)}</h5>
                  <p className="text-xs font-medium text-gray-500">{t(m.duration)} • {t(m.desc)}</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                <Play className="w-4 h-4 fill-current" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mental Health Quick Check */}
      <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-[2.5rem] p-6 lg:p-8 shadow-sm">
        <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <Activity className="w-6 h-6 text-indigo-500" /> {t("Quick Health Check")}
        </h4>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-8">
          {t("Answer honestly for self-awareness. This is not a diagnosis.")}
        </p>

        <div className="space-y-4 mb-8">
          {screeningQuestions.map((q, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-800/80 rounded-2xl p-5 border border-indigo-100 dark:border-gray-700">
              <p className="font-bold text-gray-900 dark:text-white mb-4 flex gap-3 text-sm lg:text-base">
                <span className="text-indigo-500 shrink-0">{idx + 1}.</span>
                {t(q)}
              </p>
              <div className="flex flex-wrap gap-2">
                {['Not at all', 'Several days', 'More than half the days', 'Nearly every day'].map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleScreeningAnswer(idx, i)}
                    className={`px-4 py-2 text-xs lg:text-sm font-bold rounded-xl transition-all ${
                      screeningAnswers[idx] === i 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {t(opt)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <button 
          onClick={evaluateScreening}
          disabled={Object.keys(screeningAnswers).length < screeningQuestions.length}
          className="w-full sm:w-auto mx-auto flex items-center justify-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-3.5 rounded-xl font-bold shadow-md hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          <Check className="w-5 h-5" />
          {t("Evaluate Screening")}
        </button>

        {screeningResult && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-4">
              <div className="text-5xl">
                {screeningResult.percentage <= 25 ? '✅' : screeningResult.percentage <= 50 ? '⚠️' : '🚨'}
              </div>
              <div>
                <h4 className={`text-xl font-extrabold mb-1 ${
                  screeningResult.percentage <= 25 ? 'text-emerald-500' : 
                  screeningResult.percentage <= 50 ? 'text-amber-500' : 
                  'text-red-500'
                }`}>
                  {t(screeningResult.result)}
                </h4>
                <div className="inline-block px-3 py-1 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-400">
                  {t("Score")}: {screeningResult.score} / {screeningResult.max_score}
                </div>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl">
              {t(screeningResult.advice)}
            </p>
          </div>
        )}
      </div>

      {/* Meditation Timer Modal */}
      {activeMeditation && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) handleStartMeditation(null) }}>
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative">
            
            {/* Ambient Background */}
            <div className={`absolute inset-0 opacity-20 pointer-events-none transition-all duration-[3000ms] ease-in-out ${timerRunning ? 'scale-110 bg-indigo-500' : 'scale-100 bg-transparent'}`}></div>

            <div className="relative z-10 flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Wind className="w-5 h-5 text-indigo-500" /> {activeMeditation.name}
              </div>
              <button 
                onClick={() => handleStartMeditation(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 flex items-center justify-center text-gray-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative z-10 p-8 text-center">
              <div className={`text-6xl mb-6 transition-transform duration-[4000ms] ease-in-out ${timerRunning ? 'scale-125' : 'scale-100'}`}>
                {activeMeditation.icon}
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-8 max-w-[250px] mx-auto leading-relaxed">
                {t("Find a comfortable position, close your eyes, and focus on your breath.")}
              </p>
              
              <div className="text-[5rem] font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tighter mb-8 tabular-nums drop-shadow-sm">
                {formatTimer(timerSeconds)}
              </div>

              <div className="flex items-center justify-center gap-4">
                <button 
                  onClick={toggleTimer} 
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 ${timerRunning ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'}`}
                >
                  {timerRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                </button>
                <button 
                  onClick={() => { setTimerRunning(false); if (timerRef.current) clearInterval(timerRef.current); setTimerSeconds(0); }} 
                  className="px-6 py-3 rounded-full font-bold text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                >
                  {t("Reset")}
                </button>
              </div>
            </div>

            <div className="relative z-10 p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 grid grid-cols-2 gap-4">
              <button 
                onClick={() => handleStartMeditation(null)}
                className="w-full px-6 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t("Cancel")}
              </button>
              <button 
                onClick={async () => { 
                  try {
                    const durationNum = parseInt(activeMeditation.duration) || 5;
                    await API.post('/trackers/health-entry', {
                      category: 'mindfulness',
                      value: durationNum,
                      label: activeMeditation.name
                    });
                    // Note: Optional toast could go here.
                  } catch (e) {
                    console.error('Error saving meditation', e);
                  }
                  handleStartMeditation(null); 
                }} 
                className="w-full justify-center px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all hover:-translate-y-0.5 flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> {t("Save Session")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Proactive Intervention Modal */}
      {proactiveAction && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) setProactiveAction(null) }}>
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl p-8 text-center relative">
            <button 
              onClick={() => setProactiveAction(null)}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 flex items-center justify-center text-gray-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
              {proactiveAction === 'alert_emergency' ? '🚨' : '🧘'}
            </div>
            
            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-4">
              {proactiveAction === 'alert_emergency' 
                ? t("We're here for you") 
                : t("Take a deep breath")}
            </h3>
            
            <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed font-medium">
              {proactiveAction === 'alert_emergency' 
                ? t("Your recent journal entries indicate you might be going through a tough time. We've notified your emergency contact so they can check in on you. Remember, you are not alone.") 
                : t("Your recent entries suggest you've been feeling stressed or down. Taking a few minutes to meditate can make a big difference.")}
            </p>

            <div className="flex flex-col gap-3">
              {proactiveAction === 'suggest_meditation' && (
                <button 
                  onClick={() => {
                    setProactiveAction(null);
                    handleStartMeditation(meditations[0]); // Deep Breathing
                  }}
                  className="w-full px-6 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-transform hover:-translate-y-0.5"
                >
                  {t("Start Breathing Exercise")}
                </button>
              )}
              <button 
                onClick={() => setProactiveAction(null)}
                className="w-full px-6 py-3.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t("I'm Okay, Thanks")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default AIMental;
