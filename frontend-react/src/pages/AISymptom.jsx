import React, { useState, useRef, useEffect } from 'react';
import API from '../utils/api';
import { useLang } from '../contexts/LangContext';
import { 
  Stethoscope, 
  Mic, 
  Activity, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  X, 
  Search, 
  ChevronRight, 
  Info, 
  User, 
  Clock, 
  Thermometer,
  RefreshCcw,
  UserCheck
} from 'lucide-react';
import CustomSelect from '../components/ui/CustomSelect';

const AISymptom = ({ voiceAction, onVoiceActionConsumed }) => {
  const { t, lang } = useLang();
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  
  const [duration, setDuration] = useState('1-3 days');
  const [severity, setSeverity] = useState('Moderate');
  const [ageGroup, setAgeGroup] = useState('Adult (18-60)');
  
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [isValidatingSymptom, setIsValidatingSymptom] = useState(false);

  const resultsRef = useRef(null);

  const [dbSymptoms, setDbSymptoms] = useState([]);
  const [customSymptomsList, setCustomSymptomsList] = useState([]);

  useEffect(() => {
    const fetchSymptoms = async () => {
      try {
        const [adminRes, customRes] = await Promise.all([
          API.getAdminSymptoms(),
          API.getCustomSymptoms(lang)
        ]);
        let allSymptoms = [];
        if (adminRes && Array.isArray(adminRes)) {
          allSymptoms = [...allSymptoms, ...adminRes.map(s => s.name)];
        }
        if (customRes && Array.isArray(customRes)) {
          allSymptoms = [...allSymptoms, ...customRes];
          setCustomSymptomsList(customRes);
        }
        setDbSymptoms(allSymptoms);
      } catch (err) {
        console.error("Failed to fetch symptoms", err);
      }
    };
    fetchSymptoms();
  }, [lang]);

  const quickAddSymptoms = [...new Set(dbSymptoms)];
  const handleAddSymptom = async (s) => {
    // Normalize string: lowercase, remove trailing 's' if present
    let symptom = s.trim().toLowerCase();
    
    // Simple basic normalization for plural 's' at the end of symptoms to prevent duplicates
    if (symptom.endsWith('s') && !symptom.endsWith('ss') && symptom.length > 3) {
      symptom = symptom.slice(0, -1);
    }
    
    if (!symptom || selectedSymptoms.includes(symptom)) {
      setInputValue('');
      return;
    }
    
    // Quick local validation for known symptoms to save API calls
    if (quickAddSymptoms.map(x => x.toLowerCase()).includes(symptom)) {
      setSelectedSymptoms([...selectedSymptoms, symptom]);
      setInputValue('');
      return;
    }

    setIsValidatingSymptom(true);
    try {
      const res = await API.post('/ai/symptoms/validate', { symptom });
      if (res && res.is_valid) {
        setSelectedSymptoms([...selectedSymptoms, symptom]);
        setInputValue('');
        // User wants to add manually via UI, so we DO NOT automatically save it to DB here anymore.
      } else {
        alert(t("Please provide a valid medical symptom"));
      }
    } catch (err) {
      // If validation fails (e.g. network error), we still add it so user isn't blocked, or we can show error.
      // Let's add it to be safe, the analyze endpoint will catch it if it's really bad.
      setSelectedSymptoms([...selectedSymptoms, symptom]);
      setInputValue('');
    } finally {
      setIsValidatingSymptom(false);
    }
  };

  useEffect(() => {
    if (voiceAction && voiceAction.target_feature === 'ai-symptom') {
      if (voiceAction.action_name === 'check_symptoms' && voiceAction.data) {
        if (voiceAction.data.duration) setDuration(voiceAction.data.duration);
        if (voiceAction.data.severity) setSeverity(voiceAction.data.severity);
        if (voiceAction.data.age_group) setAgeGroup(voiceAction.data.age_group);
        if (voiceAction.data.symptoms && Array.isArray(voiceAction.data.symptoms)) {
          const rawSymptoms = voiceAction.data.symptoms.map(s => {
            let sym = s.toLowerCase().trim();
            if (sym.endsWith('s') && !sym.endsWith('ss') && sym.length > 3) {
              sym = sym.slice(0, -1);
            }
            return sym;
          });
          
          setIsValidatingSymptom(true);
          
          const validateAndAdd = async () => {
              const validSymptoms = [];
              for (const symptom of rawSymptoms) {
                  if (quickAddSymptoms.map(x => x.toLowerCase()).includes(symptom)) {
                      validSymptoms.push(symptom);
                  } else {
                      try {
                          const valRes = await API.post('/ai/symptoms/validate', { symptom });
                          if (valRes && valRes.is_valid) {
                              validSymptoms.push(symptom);
                              // User wants to add manually via UI, so we DO NOT automatically save it to DB here anymore.
                          }
                      } catch(e) {}
                  }
              }
              const newSymptoms = [...new Set([...selectedSymptoms, ...validSymptoms])];
              setSelectedSymptoms(newSymptoms);
              setIsValidatingSymptom(false);
              setTimeout(() => analyze(newSymptoms), 500);
          };
          validateAndAdd();
        }
      }
      if (onVoiceActionConsumed) onVoiceActionConsumed();
    }
  }, [voiceAction]);

  const handleRemoveSymptom = (symptom) => {
    setSelectedSymptoms(selectedSymptoms.filter(s => s !== symptom));
  };

  const handleSaveToDatabase = async (symptom, e) => {
    e.stopPropagation();
    try {
      await API.post('/ai/symptoms/custom', { symptom: symptom });
      setDbSymptoms(prev => {
        if (!prev.includes(symptom)) return [...prev, symptom];
        return prev;
      });
      setCustomSymptomsList(prev => {
        if (!prev.includes(symptom)) return [...prev, symptom];
        return prev;
      });
    } catch (err) {
      console.error("Failed to save to database", err);
    }
  };

  const handleDeleteFromDatabase = async (symptom, e) => {
    e.stopPropagation();
    try {
      await API.deleteCustomSymptom({ symptom: symptom });
      setDbSymptoms(prev => prev.filter(s => s !== symptom));
      setCustomSymptomsList(prev => prev.filter(s => s !== symptom));
    } catch (err) {
      console.error("Failed to delete from database", err);
    }
  };

  const startVoiceRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in your browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const speechResult = event.results[0][0].transcript;
      setInputValue(speechResult);
      setTimeout(() => handleAddSymptom(speechResult), 300);
    };
    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      alert('Could not recognize voice. Try again.');
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const analyze = async (overrideSymptoms = null) => {
    const symsToAnalyze = Array.isArray(overrideSymptoms) ? overrideSymptoms : selectedSymptoms;
    if (symsToAnalyze.length === 0) {
      alert('Please add at least one symptom');
      return;
    }

    setAnalyzing(true);
    setResults(null);
    setTimeout(() => {
      if (resultsRef.current) resultsRef.current.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      const res = await API.post('/ai/symptoms/analyze', {
        symptoms: symsToAnalyze,
        duration: duration,
        severity: severity,
        age_group: ageGroup,
        language: lang === 'hi' ? 'Hindi' : (lang === 'gu' ? 'Gujarati' : 'English')
      });
      setResults(res);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e) {
      alert(e.message || 'Failed to analyze symptoms');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-start gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Stethoscope className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1">{t("AI Symptom Checker")}</h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              {t("Enter your symptoms for AI-powered triage")}
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer - Now Full Width */}
      {showDisclaimer && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-5 flex gap-4 items-start shadow-sm relative">
          <button 
            onClick={() => setShowDisclaimer(false)}
            className="absolute top-4 right-4 text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
            title="Dismiss Disclaimer"
          >
            <X className="w-5 h-5" />
          </button>
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div className="pr-8">
            <h3 className="font-bold text-amber-800 dark:text-amber-400 mb-1">{t("Medical Disclaimer")}</h3>
            <p className="text-amber-700 dark:text-amber-500 text-sm font-medium">
              {t("symptom_disclaimer_1")} <strong>{t("not_medical_diagnosis")}</strong>. {t("symptom_disclaimer_2")}
            </p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 relative">
        {/* Main Input Column */}
        <div className="lg:col-span-2 space-y-6">

          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">{t("What symptoms are you experiencing?")}</h3>
            
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                {isValidatingSymptom ? <RefreshCcw className="w-5 h-5 text-indigo-500 animate-spin" /> : <Search className="w-5 h-5 text-gray-400" />}
              </div>
              <input 
                type="text" 
                className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl py-4 pl-12 pr-16 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                placeholder={isListening ? t("Listening... Speak your symptom") : isValidatingSymptom ? t("Validating symptom...") : t("Type a symptom (e.g., headache, fever...)")}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSymptom(inputValue) }}
                disabled={isValidatingSymptom}
              />
              <button 
                onClick={startVoiceRecognition}
                className={`absolute right-2 top-2 bottom-2 w-12 rounded-xl flex items-center justify-center transition-colors ${
                  isListening 
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse' 
                    : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                }`}
                title="Voice Input"
                disabled={isValidatingSymptom}
              >
                <Mic className="w-5 h-5" />
              </button>
            </div>

            {selectedSymptoms.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300">{t("Selected Symptoms")}</h4>
                  <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-2 py-0.5 rounded-full">
                    {selectedSymptoms.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedSymptoms.map(s => (
                    <div key={s} className="group flex items-center bg-indigo-600 text-white rounded-xl shadow-sm shadow-indigo-600/20">
                      <div className="px-4 py-2 font-medium capitalize">
                        {t(s)}
                      </div>
                      <div className="flex items-center pr-2">
                        {!quickAddSymptoms.map(x => x.toLowerCase()).includes(s.toLowerCase()) && (
                          <button
                            onClick={(e) => handleSaveToDatabase(s, e)}
                            className="p-1 hover:bg-indigo-700 rounded-lg transition-colors border-l border-indigo-500/30 pl-2 ml-1"
                            title={t("Save to my common symptoms")}
                          >
                            <Plus className="w-4 h-4 text-indigo-200 hover:text-white" />
                          </button>
                        )}
                        <button 
                          onClick={() => handleRemoveSymptom(s)}
                          className="p-1 ml-1 hover:bg-indigo-700 rounded-lg transition-colors"
                          title={t("Remove")}
                        >
                          <X className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">{t("Quick Add Common Symptoms")}</h4>
              <div className="flex flex-wrap gap-2">
                {quickAddSymptoms.map(s => (
                  <div key={s} className="group flex items-center bg-gray-50 hover:bg-indigo-50 dark:bg-gray-900/50 dark:hover:bg-indigo-900/30 border border-gray-200 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800 rounded-full transition-all">
                    <button 
                      onClick={() => handleAddSymptom(s)}
                      className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-4 py-2 text-sm font-medium flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t(s)}
                    </button>
                    {customSymptomsList.includes(s) && (
                      <button
                        onClick={(e) => handleDeleteFromDatabase(s, e)}
                        className="p-1.5 mr-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                        title={t("Remove from database")}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                
                <button 
                  onClick={async () => {
                    const symptomText = prompt(t("Enter new custom symptom to save to your list:"));
                    if (symptomText) {
                      let symptom = symptomText.trim().toLowerCase();
                      if (symptom.endsWith('s') && !symptom.endsWith('ss') && symptom.length > 3) {
                        symptom = symptom.slice(0, -1);
                      }
                      if (!quickAddSymptoms.includes(symptom)) {
                        setIsValidatingSymptom(true);
                        try {
                          const res = await API.post('/ai/symptoms/validate', { symptom });
                          if (res && res.is_valid) {
                             await API.post('/ai/symptoms/custom', { symptom });
                             setDbSymptoms(prev => [...prev, symptom]);
                             setCustomSymptomsList(prev => [...prev, symptom]);
                          } else {
                             alert(t("Please provide a valid medical symptom"));
                          }
                        } catch(e) {}
                        setIsValidatingSymptom(false);
                      }
                    }
                  }}
                  className="bg-transparent border border-dashed border-gray-300 hover:border-indigo-400 dark:border-gray-600 dark:hover:border-indigo-500 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("Add New")}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Sidebar Configuration */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-500" />
              {t("Patient Details")}
            </h3>

            <div className="space-y-5">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <Clock className="w-4 h-4 text-gray-400" /> {t("Duration")}
                </label>
                <CustomSelect
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  options={[
                    { value: "Less than 24 hours", label: t("Less than 24 hours") },
                    { value: "1-3 days", label: t("1-3 days") },
                    { value: "3-7 days", label: t("3-7 days") },
                    { value: "More than a week", label: t("More than a week") },
                    { value: "More than a month", label: t("More than a month") }
                  ]}
                  className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 font-medium py-[10px]"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <Thermometer className="w-4 h-4 text-gray-400" /> {t("Severity")}
                </label>
                <CustomSelect
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  options={[
                    { value: "Mild", label: t("Mild") },
                    { value: "Moderate", label: t("Moderate") },
                    { value: "Severe", label: t("Severe") }
                  ]}
                  className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 font-medium py-[10px]"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <User className="w-4 h-4 text-gray-400" /> {t("Age Group")}
                </label>
                <CustomSelect
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value)}
                  options={[
                    { value: "Child (0-12)", label: t("Child (0-12)") },
                    { value: "Teen (13-17)", label: t("Teen (13-17)") },
                    { value: "Adult (18-60)", label: t("Adult (18-60)") },
                    { value: "Senior (60+)", label: t("Senior (60+)") }
                  ]}
                  className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 font-medium py-[10px]"
                />
              </div>
            </div>

            <button 
              onClick={() => analyze()}
              disabled={analyzing}
              className={`w-full mt-6 py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-white transition-all shadow-lg shadow-indigo-500/20 ${analyzing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5'}`}
            >
              {analyzing ? (
                <>
                  <RefreshCcw className="w-5 h-5 animate-spin" />
                  {t("Analyzing...")}
                </>
              ) : (
                <>
                  <Activity className="w-5 h-5" />
                  {t("Analyze Symptoms")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      <div ref={resultsRef}>
        {results && (
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 animate-in slide-in-from-bottom-8 duration-500">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                {t("Triage Results")}
              </h2>
              
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold border ${
                results.urgency === 'High' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400' :
                results.urgency === 'Medium' ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-900/30 dark:text-amber-400' :
                'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-400'
              }`}>
                {results.urgency === 'High' ? <AlertCircle className="w-5 h-5" /> :
                 results.urgency === 'Medium' ? <AlertTriangle className="w-5 h-5" /> :
                 <CheckCircle2 className="w-5 h-5" />}
                {t(results.urgency)} {t("Urgency")}
              </div>
            </div>

            {results.urgency === 'High' && (
              <div className="bg-red-500 text-white rounded-2xl p-5 mb-8 flex gap-4 shadow-lg shadow-red-500/20 items-center">
                <AlertCircle className="w-8 h-8 shrink-0 animate-pulse" />
                <div>
                  <h3 className="font-extrabold text-lg">{t("Immediate Medical Attention Recommended")}</h3>
                  <p className="font-medium text-red-50">{t("Your symptoms suggest a potentially serious condition. Please contact emergency services or go to the nearest ER.")}</p>
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t("Possible Conditions")}</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {results.conditions.map(c => {
                      const isHighProb = c.probability > 70;
                      const isMedProb = c.probability > 40 && !isHighProb;
                      
                      return (
                        <div key={c.condition} className="bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-bold text-gray-900 dark:text-white">{t(c.condition)}</h4>
                            <span className={`text-sm font-extrabold ${isHighProb ? 'text-red-500' : isMedProb ? 'text-amber-500' : 'text-emerald-500'}`}>
                              {c.probability}%
                            </span>
                          </div>
                          
                          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${isHighProb ? 'bg-red-500' : isMedProb ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${c.probability}%` }}
                            ></div>
                          </div>
                          
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                            {t("Matched")} {c.matched_symptoms || selectedSymptoms.length} {t("of your symptoms")}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t("Recommendations")}</h3>
                  <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-6">
                    <ul className="space-y-3">
                      {results.recommendations.map((r, i) => (
                        <li key={i} className="flex gap-3 text-gray-700 dark:text-gray-300 font-medium">
                          <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0" />
                          {t(r)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{t("Recommended Specialists")}</h3>
                  <div className="space-y-3">
                    {results.specialists.map(s => (
                      <div key={s} className="flex items-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                          <UserCheck className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white">{t(s)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{t("Summary")}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400 font-medium">{t("Symptoms")}</span>
                      <span className="font-bold text-gray-900 dark:text-white">{selectedSymptoms.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400 font-medium">{t("Duration")}</span>
                      <span className="font-bold text-gray-900 dark:text-white">{t(duration)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400 font-medium">{t("Severity")}</span>
                      <span className="font-bold text-gray-900 dark:text-white">{t(severity)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default AISymptom;
