import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, HeartPulse, Brain, Check, Info, FileText, Share2, Activity } from 'lucide-react';
import API from '../utils/api';
import CustomSelect from './ui/CustomSelect';

const ORGANS = [
  { id: 'heart', label: 'Heart' },
  { id: 'lungs', label: 'Lungs' },
  { id: 'liver', label: 'Liver' },
  { id: 'kidneys', label: 'Kidneys' },
  { id: 'pancreas', label: 'Pancreas' },
  { id: 'intestines', label: 'Intestines' },
  { id: 'corneas', label: 'Corneas' },
  { id: 'skin', label: 'Skin Tissue' },
  { id: 'bone', label: 'Bone & Marrow' }
];

const OrganDonorModal = ({ isOpen, onClose, profile, onSave }) => {
  const [activeTab, setActiveTab] = useState('preferences'); // 'preferences' | 'ai'
  const [organDonor, setOrganDonor] = useState(false);
  const [preferences, setPreferences] = useState({});
  
  // AI State
  const [questionnaire, setQuestionnaire] = useState({
    smoking: 'No',
    alcohol: 'Occasional',
    recent_infections: 'No',
    surgeries: 'None'
  });
  const [aiReport, setAiReport] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setOrganDonor(!!profile.organ_donor);
      setPreferences(profile.organ_preferences || {});
    }
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const toggleOrgan = (id) => {
    setPreferences(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSave = async () => {
    try {
      const payload = {
        organ_donor: organDonor,
        organ_preferences: preferences
      };
      await API.put('/emergency/organ-preferences', payload);
      
      if (organDonor) {
        // Simulate Next of Kin notification toast
        const emergencyContacts = profile?.emergency_contacts || [];
        const contactNames = emergencyContacts.map(c => c.name).join(', ') || 'Emergency Contacts';
        alert(`✅ Preferences saved!\n📱 Next-of-Kin (${contactNames}) have been automatically notified of your donor wishes via SMS/Email.`);
      } else {
        alert('✅ Preferences saved successfully.');
      }
      
      onSave(payload);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to save preferences.');
    }
  };

  const runAiScreening = async () => {
    try {
      setAiLoading(true);
      const payload = {
        questionnaire_answers: questionnaire
      };
      const res = await API.post('/emergency/organ-suitability', payload);
      setAiReport(res.report);
    } catch (e) {
      console.error(e);
      setAiReport("Failed to generate AI screening report. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
              <HeartPulse size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Organ Donor Registration</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Advanced Granular Preferences</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 mb-6 shrink-0">
          <button
            className={`flex-1 pb-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'preferences' ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
            onClick={() => setActiveTab('preferences')}
          >
            Donation Preferences
          </button>
          <button
            className={`flex-1 pb-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'ai' ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
            onClick={() => setActiveTab('ai')}
          >
            AI Suitability Pre-Screen
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          
          {activeTab === 'preferences' && (
            <div className="flex flex-col gap-6">
              
              {/* Master Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">Registered Donor Status</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enable to register as a donor.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={organDonor} onChange={(e) => setOrganDonor(e.target.checked)} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                </label>
              </div>

              {/* Granular Selection */}
              <div className={`transition-opacity duration-300 ${organDonor ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <h4 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Check size={16} className="text-green-500" /> Select Specific Organs & Tissues
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  You can choose exactly what you are comfortable donating.
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {ORGANS.map(organ => {
                    const isSelected = preferences[organ.id];
                    return (
                      <button
                        key={organ.id}
                        onClick={() => toggleOrgan(organ.id)}
                        className={`p-3 rounded-xl border text-sm font-bold transition-all text-left flex justify-between items-center ${isSelected ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' : 'bg-white border-gray-200 text-gray-600 hover:border-green-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600'}`}
                      >
                        {organ.label}
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-green-500 bg-green-500' : 'border-gray-300 dark:border-gray-600'}`}>
                          {isSelected && <Check size={10} className="text-white" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="flex flex-col gap-6">
              
              {!aiReport ? (
                <>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex gap-3">
                    <Brain className="text-blue-500 shrink-0 mt-0.5" size={20} />
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      Our Medical AI will cross-reference your health profile (Age: {profile?.age}, Blood: {profile?.blood_type}, Conditions) with a quick questionnaire to evaluate donation suitability.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Smoking History</label>
                      <CustomSelect
                        value={questionnaire.smoking}
                        onChange={(e) => setQuestionnaire({...questionnaire, smoking: e.target.value})}
                        options={[
                          { value: "No", label: "No" },
                          { value: "Occasional", label: "Occasional" },
                          { value: "Frequent", label: "Frequent" },
                          { value: "Former Smoker", label: "Former Smoker" }
                        ]}
                        className="!bg-gray-50 dark:!bg-gray-900 border border-gray-200 dark:border-gray-700 !font-normal !py-3 !shadow-none !text-gray-900 dark:!text-white !text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Alcohol Consumption</label>
                      <CustomSelect
                        value={questionnaire.alcohol}
                        onChange={(e) => setQuestionnaire({...questionnaire, alcohol: e.target.value})}
                        options={[
                          { value: "None", label: "None" },
                          { value: "Occasional", label: "Occasional" },
                          { value: "Frequent", label: "Frequent" },
                          { value: "Heavy", label: "Heavy" }
                        ]}
                        className="!bg-gray-50 dark:!bg-gray-900 border border-gray-200 dark:border-gray-700 !font-normal !py-3 !shadow-none !text-gray-900 dark:!text-white !text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Recent Infections (Last 6 Months)</label>
                      <input type="text" value={questionnaire.recent_infections} onChange={(e) => setQuestionnaire({...questionnaire, recent_infections: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none transition-shadow" placeholder="e.g. None, Flu, COVID-19" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Major Surgeries</label>
                      <input type="text" value={questionnaire.surgeries} onChange={(e) => setQuestionnaire({...questionnaire, surgeries: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none transition-shadow" placeholder="e.g. None, Appendectomy" />
                    </div>
                  </div>

                  <button
                    onClick={runAiScreening}
                    disabled={aiLoading}
                    className={`w-full py-4 rounded-xl font-bold text-white shadow-sm transition-colors flex justify-center items-center gap-2 ${aiLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}
                  >
                    {aiLoading ? (
                      <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Generating Report...</>
                    ) : (
                      <><Brain size={20} /> Run AI Pre-Screening</>
                    )}
                  </button>
                </>
              ) : (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <FileText className="text-blue-500" /> AI Suitability Report
                    </h4>
                    <button onClick={() => setAiReport(null)} className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400">
                      Retake Questionnaire
                    </button>
                  </div>
                  
                  <div className="p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 prose dark:prose-invert max-w-none text-sm leading-relaxed mb-4">
                    {aiReport.split('\n').map((para, i) => (
                      <p key={i} className="mb-2 last:mb-0">{para}</p>
                    ))}
                  </div>

                  <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
                    <Info size={14} className="shrink-0 mt-0.5" />
                    Disclaimer: This AI-generated report is for informational purposes only. Final suitability is determined by medical professionals at the time of donation.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex gap-3 shrink-0 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-4 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-4 rounded-xl font-bold text-white shadow-sm transition-colors bg-green-600 hover:bg-green-700 flex justify-center items-center gap-2"
          >
            <Check size={20} /> Save Preferences
          </button>
        </div>
        
      </div>
    </div>
  , document.body);
};

export default OrganDonorModal;
