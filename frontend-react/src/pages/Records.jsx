import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import API from '../utils/api';
import { toast } from 'react-hot-toast';
import editIcon from '../../../Icons/edit sign.png';
import {
  FolderOpen, GitCompare, UploadCloud, Plus, Search, FileText, Edit, Trash2,
  Sparkles, Stethoscope, Building2, Calendar, Droplet, Scan, Pill, Activity, Syringe, X
} from 'lucide-react';
import CustomSelect from '../components/ui/CustomSelect';
import { useLang } from '../contexts/LangContext';

const Records = ({ voiceAction, onVoiceActionConsumed }) => {
  const { lang, t } = useLang();
  const langName = lang === 'hi' ? 'Hindi' : lang === 'gu' ? 'Gujarati' : 'English';
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
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);

  const [newRecord, setNewRecord] = useState({
    title: '',
    category: 'Blood Test',
    date: new Date().toISOString().split('T')[0],
    doctor: '',
    hospital: '',
    findings: '',
    family_member_id: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [showCompare, setShowCompare] = useState(false);
  const [showAIUpload, setShowAIUpload] = useState(false);
  const [aiUploadStatus, setAiUploadStatus] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryResult, setSummaryResult] = useState(null);

  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Listen for voice actions
  useEffect(() => {
    const handleVoice = async () => {
      if (voiceAction && voiceAction.target_feature === 'records') {
        if (voiceAction.action_name === 'open_add_modal') {
          setShowAddForm(true);
        } else if (voiceAction.action_name === 'compare_reports') {
          setCompareMode(true);
          toast.success('Compare mode enabled! Select 2 records to compare.');
        } else if (voiceAction.action_name === 'ai_summary' && voiceAction.data?.record_name) {
          const target = records.find(r =>
            r.title.toLowerCase().includes(voiceAction.data.record_name.toLowerCase())
          );
          if (target) {
            try {
              const res = await API.get(`/records/${target.id}/summary`);
              setSummaryResult(res);
              setShowSummary(true);
            } catch (e) {
              toast.error(`AI Summary for "${target.title}": Feature in progress.`);
            }
          } else {
            toast.error(`Could not find a record matching "${voiceAction.data.record_name}"`);
          }
        } else if (voiceAction.action_name === 'open_tab' && voiceAction.data?.tab) {
          const tabToOpen = voiceAction.data.tab;
          if (categories.includes(tabToOpen) || tabToOpen === 'All') {
            setCategory(tabToOpen);
          } else {
            // fallback
            const lowerTab = tabToOpen.toLowerCase();
            const matched = categories.find(c => c.toLowerCase() === lowerTab);
            if (matched) {
              setCategory(matched);
            } else {
              toast.error(`Unknown record category: ${tabToOpen}`);
            }
          }
        }
        if (onVoiceActionConsumed) onVoiceActionConsumed();
      }
    };
    handleVoice();
  }, [voiceAction, records]);

  const categories = ['All', 'Blood Test', 'Imaging', 'Prescription', 'Surgery', 'Vaccination', 'Other'];

  const categoryIcons = {
    'Blood Test': <Droplet className="w-8 h-8" />,
    'Imaging': <Scan className="w-8 h-8" />,
    'Prescription': <Pill className="w-8 h-8" />,
    'Surgery': <Activity className="w-8 h-8" />,
    'Vaccination': <Syringe className="w-8 h-8" />,
    'Other': <FileText className="w-8 h-8" />
  };

  const fetchRecords = async () => {
    try {
      const data = await API.request('/records');
      setRecords(data);
      setLoading(false);
    } catch (e) {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    // Fetch family members for the edit modal
    API.request('/family/members').then(data => {
      if (Array.isArray(data)) setFamilyMembers(data);
    }).catch(() => { });
  }, []);

  const filteredRecords = records.filter(r => {
    if (category !== 'All' && r.category !== category) return false;
    if (searchQuery && !r.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !(r.doctor || '').toLowerCase().includes(searchQuery.toLowerCase()) &&
      !(r.hospital || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const toggleCompareSelection = (record) => {
    if (selectedForCompare.find(r => r.id === record.id)) {
      setSelectedForCompare(selectedForCompare.filter(r => r.id !== record.id));
    } else {
      if (selectedForCompare.length >= 2) {
        toast.error('You can only compare 2 reports at a time.');
        return;
      }
      setSelectedForCompare([...selectedForCompare, record]);
    }
  };

  const handleCompareReports = async () => {
    if (!compareMode) {
      setCompareMode(true);
      setSelectedForCompare([]);
      return;
    }

    if (selectedForCompare.length !== 2) {
      toast.error('Please select exactly 2 records to compare');
      return;
    }

    const [r1, r2] = selectedForCompare;
    setShowCompare(true);
    setCompareResult({ type: 'loading' });
    setCompareMode(false);
    setSelectedForCompare([]);

    try {
      const res = await API.request('/records/compare', {
        method: 'POST',
        body: { record_id_1: r1.id, record_id_2: r2.id, language: langName }
      });
      setCompareResult({ type: 'success', data: res });
    } catch (e) {
      setCompareResult({ type: 'error', message: 'Failed to compare records' });
    }
  };

  const handleAISummary = async (record) => {
    setShowSummary(true);
    setSummaryResult({ type: 'loading', recordTitle: record.title });
    try {
      const res = await API.request(`/records/${record.id}/ai-summary?language=${langName}`, { method: 'POST' });
      setSummaryResult({ type: 'success', data: res, recordTitle: record.title });
    } catch (e) {
      setSummaryResult({ type: 'error', message: 'Failed to generate summary', recordTitle: record.title });
    }
  };

  const handleAnalyzeRecord = async (record) => {
    setIsAnalyzing(true);
    setShowAnalysis(true);
    setAnalysisResult(null);
    try {
      const res = await API.analyzeMedicalDocument(record.id);
      if (res.success) {
        toast.success('Analysis complete!');
        // Update the record in state so it shows as analyzed
        setRecords(records.map(r => r.id === record.id ? { ...r, ai_analyzed: true } : r));
        handleViewAnalysis(record);
      } else {
        toast.error('Analysis failed');
        setShowAnalysis(false);
      }
    } catch (e) {
      toast.error(e.message || 'AI Analysis Failed');
      setShowAnalysis(false);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleViewAnalysis = async (record) => {
    setShowAnalysis(true);
    setIsAnalyzing(true);
    try {
      const data = await API.getDocumentMetrics(record.id);
      setAnalysisResult(data);
    } catch (e) {
      toast.error('Failed to load analysis');
      setShowAnalysis(false);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteRecord = async (id) => {
    if (window.confirm('Delete this record?')) {
      try {
        await API.delete(`/records/${id}`);
        setRecords(records.filter(r => r.id !== id));
      } catch (e) {
        toast.error('Failed to delete record');
      }
    }
  };

  const openEditModal = (record) => {
    setEditRecord({ ...record });
    setShowEditForm(true);
  };

  const handleUpdateRecord = async () => {
    if (!editRecord.title || !editRecord.category || !editRecord.date) {
      toast.error('Title, Category, and Date are required');
      return;
    }
    try {
      const updated = await API.request(`/records/${editRecord.id}`, {
        method: 'PUT',
        body: editRecord
      });
      setRecords(records.map(r => r.id === updated.id ? updated : r));
      setShowEditForm(false);
      setEditRecord(null);
      toast.success('Record updated');
    } catch (e) {
      toast.error(`Failed to update. Date sent: ${editRecord.date}. Error: ${e.message}`);
    }
  };

  const handleSaveRecord = async () => {
    if (!newRecord.title || !newRecord.category || !newRecord.date) {
      toast.error('Title, Category, and Date are required');
      return;
    }
    const formData = new FormData();
    formData.append('title', newRecord.title);
    formData.append('category', newRecord.category);
    formData.append('date', newRecord.date);
    if (newRecord.doctor) formData.append('doctor', newRecord.doctor);
    if (newRecord.hospital) formData.append('hospital', newRecord.hospital);
    if (newRecord.findings) formData.append('findings', newRecord.findings);
    if (selectedFile) formData.append('file', selectedFile);

    try {
      const added = await API.request('/records', {
        method: 'POST',
        body: formData
      });
      setRecords([...records, added]);
      setShowAddForm(false);
      setNewRecord({ title: '', category: 'Blood Test', date: new Date().toISOString().split('T')[0], doctor: '', hospital: '', findings: '' });
      setSelectedFile(null);
      toast.success('Record saved');
    } catch (e) {
      toast.error('Failed to upload record: ' + (e.message || 'Unknown error'));
    }
  };

  if (loading) return <div className="empty-state"><span className="spinner"></span> {t("Loading Records...")}</div>;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20">
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center w-full gap-6 flex-wrap md:flex-nowrap">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
              <FolderOpen className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
                {t("Medical Records Vault")}
              </h1>
              <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse shrink-0"></span>
                {records.length} {t("records stored securely")}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 relative z-10 shrink-0 ml-auto pr-2 flex-wrap">
            {compareMode && (
              <button
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                onClick={() => { setCompareMode(false); setSelectedForCompare([]); }}
              >
                {t("Cancel")}
              </button>
            )}
            <button
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${compareMode ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-700' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'}`}
              onClick={handleCompareReports}
            >
              <GitCompare className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">{compareMode ? `${t("Compare")} (${selectedForCompare.length}/2)` : t("Compare Reports")}</span>
            </button>
            <button
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
              onClick={() => setShowAIUpload(true)}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">{t("AI Upload")}</span>
            </button>
            <button
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:shadow-lg"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">{t("Add Record")}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
        <div className="flex flex-wrap items-center justify-start gap-2 w-full md:w-auto">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${category === c ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              {t(c)}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-72 shrink-0">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent outline-none transition-all dark:text-white"
            placeholder={t("Search records...")}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredRecords.length > 0 ? filteredRecords.map(r => (
          <div key={r.id} className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 relative overflow-hidden group flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 opacity-[0.03] dark:opacity-[0.05] rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 pointer-events-none"></div>

            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner text-2xl">
                  {categoryIcons[r.category] || '📋'}
                </div>
                <div>
                  <span className="inline-block bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-1">
                    {t(r.category)}
                  </span>
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {r.date}
                  </div>
                </div>
                {compareMode && (
                  <div className="ml-2 flex items-center">
                    <input type="checkbox" checked={!!selectedForCompare.find(s => s.id === r.id)} onChange={() => toggleCompareSelection(r)} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEditModal(r)} className="p-2.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Edit Record">
                  <Edit className="w-5 h-5" />
                </button>
                <button onClick={() => deleteRecord(r.id)} className="p-2.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="Delete Record">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-grow mb-5 relative z-10">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight mb-3" title={r.title}>
                {r.title && r.title.length > 40 ? `${r.title.substring(0, 20)}...${r.title.substring(r.title.length - 10)}` : r.title}
              </h4>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {r.doctor && (
                  <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-100 dark:border-gray-600">
                    <Stethoscope className="w-3.5 h-3.5 text-indigo-500" />
                    {r.doctor}
                  </span>
                )}
                {r.hospital && (
                  <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-100 dark:border-gray-600">
                    <Building2 className="w-3.5 h-3.5 text-purple-500" />
                    {r.hospital}
                  </span>
                )}
              </div>
              {r.findings && (
                <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-3.5 rounded-xl border-l-2 border-indigo-500 text-sm font-medium text-gray-700 dark:text-gray-300 italic shadow-sm">
                  "{r.findings}"
                </div>
              )}
            </div>

            <div className="mt-auto relative z-10 flex flex-col gap-2">
              {r.file_path && !r.ai_analyzed && (
                <button
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30 py-2.5 px-4 rounded-xl font-bold text-sm hover:from-blue-100 hover:to-cyan-100 dark:hover:from-blue-900/40 dark:hover:to-cyan-900/40 transition-all shadow-sm"
                  onClick={() => handleAISummary(r)}
                  disabled={summaryResult?.type === 'loading'}
                >
                  <Sparkles className="w-4 h-4" />
                  {t("Analyze Report with AI ✨")}
                </button>
              )}
              {r.ai_analyzed && (
                <button
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30 py-2.5 px-4 rounded-xl font-bold text-sm hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/40 dark:hover:to-teal-900/40 transition-all shadow-sm"
                  onClick={() => handleAISummary(r)}
                >
                  <Activity className="w-4 h-4" />
                  {t("View AI Analysis")}
                </button>
              )}
            </div>
          </div>
        )) : (
          <div className="col-span-full bg-white dark:bg-gray-800 rounded-[2.5rem] p-12 text-center border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center">
            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-700 text-gray-300 dark:text-gray-500 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-2">{t("No Records Found")}</h3>
            <p className="text-gray-500 dark:text-gray-400 font-medium mb-6 max-w-sm">{t("Upload your medical reports, prescriptions, and scans to keep them organized and accessible.")}</p>
            <button
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:bg-blue-700 hover:shadow-lg"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="w-4 h-4" />
              {t("Add Your First Record")}
            </button>
          </div>
        )}
      </div>

      {/* Add Record Modal */}
      {showAddForm && createPortal(
        <div 
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setShowAddForm(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 shrink-0">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 m-0">
                <FileText className="w-5 h-5 text-blue-500" /> {t("Add Medical Record")}
              </h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-1.5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t("Title")}</label>
                <input type="text" className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white text-gray-900" value={newRecord.title} onChange={e => setNewRecord({ ...newRecord, title: e.target.value })} placeholder={t("e.g. Annual Blood Test")} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t("Category")}</label>
                  <CustomSelect
                    value={newRecord.category}
                    onChange={e => setNewRecord({ ...newRecord, category: e.target.value })}
                    options={categories.filter(c => c !== 'All').map(c => ({ value: c, label: t(c) }))}
                    className="!bg-gray-50 dark:!bg-gray-900/50 border border-gray-200 dark:border-gray-700 !py-3 !shadow-none !text-gray-900 dark:!text-white !text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t("Date")}</label>
                  <input type="date" className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white text-gray-900" value={newRecord.date} onChange={e => setNewRecord({ ...newRecord, date: e.target.value })} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t("Doctor (Optional)")}</label>
                  <input type="text" className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white text-gray-900" value={newRecord.doctor} onChange={e => setNewRecord({ ...newRecord, doctor: e.target.value })} placeholder={t("Dr. Smith")} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t("Hospital (Optional)")}</label>
                  <input type="text" className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white text-gray-900" value={newRecord.hospital} onChange={e => setNewRecord({ ...newRecord, hospital: e.target.value })} placeholder={t("City Clinic")} />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t("Key Findings (Optional)")}</label>
                <textarea className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none dark:text-white text-gray-900" rows={3} value={newRecord.findings} onChange={e => setNewRecord({ ...newRecord, findings: e.target.value })} placeholder={t("Enter key findings, test results, diagnosis...")}></textarea>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t("Upload Document (PDF/Image)")}</label>
                <input type="file" className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white text-gray-900" onChange={e => setSelectedFile(e.target.files[0])} />
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowAddForm(false)} className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">{t("Cancel")}</button>
              <button onClick={handleSaveRecord} className="px-5 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex items-center gap-2">
                {t("Save Record")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showEditForm && editRecord && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) setShowEditForm(false) }}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <img src={editIcon} alt="Edit" className="w-5 h-5" /> {t("Edit Medical Record")}
              </h3>
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" onClick={() => setShowEditForm(false)}>✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1 block">{t("Report Title")}</label>
                <input type="text" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white" value={editRecord.title} onChange={e => setEditRecord({ ...editRecord, title: e.target.value })} placeholder={t("e.g., Complete Blood Count")} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="flex flex-col">
                  <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1 block">{t("Category")}</label>
                  <CustomSelect
                    value={editRecord.category}
                    onChange={e => setEditRecord({ ...editRecord, category: e.target.value })}
                    options={categories.slice(1).map(opt => ({ value: opt, label: t(opt) }))}
                    className="w-full !bg-gray-50 dark:!bg-gray-900 !border !border-gray-200 dark:!border-gray-700 !rounded-xl !text-gray-900 dark:!text-white !font-normal !text-[0.9rem] !py-3 !px-4 !shadow-none !h-[48px]"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1 block">{t("Date")}</label>
                  <input type="date" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white h-[48px]" value={editRecord.date} onChange={e => setEditRecord({ ...editRecord, date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="flex flex-col">
                  <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1 block">{t("Doctor")}</label>
                  <input type="text" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white" value={editRecord.doctor || ''} onChange={e => setEditRecord({ ...editRecord, doctor: e.target.value })} placeholder={t("Dr. Name")} />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1 block">{t("Hospital/Lab")}</label>
                  <input type="text" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white" value={editRecord.hospital || ''} onChange={e => setEditRecord({ ...editRecord, hospital: e.target.value })} placeholder={t("Hospital name")} />
                </div>
              </div>
              <div className="flex flex-col mt-4">
                <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">{t("Key Findings")}</label>
                <textarea className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white min-h-[80px]" value={editRecord.findings || ''} onChange={e => setEditRecord({ ...editRecord, findings: e.target.value })} placeholder={t("Enter key findings, test results...")}></textarea>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-100 dark:border-gray-700 shrink-0">
              <button className="px-6 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors" onClick={() => setShowEditForm(false)}>{t("Cancel")}</button>
              <button className="px-6 py-3 rounded-xl font-bold text-white shadow-sm transition-colors bg-blue-600 hover:bg-blue-700" onClick={handleUpdateRecord}>{t("Update Record")}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showAIUpload && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget && aiUploadStatus?.type !== 'loading') { setShowAIUpload(false); setAiUploadStatus(null); } }}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">🤖 {t("AI Report Parser")}</h3>
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" onClick={() => setShowAIUpload(false)}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 md:p-8 text-center">
              <div className="text-5xl mb-4">📄</div>
              <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">{t("Upload Your Lab Report")}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-[90%] mx-auto leading-relaxed">
                {t("Upload a PDF of your blood test or lab report. Our AI will automatically extract key health metrics like Hemoglobin, Blood Sugar, Cholesterol, and more.")}
              </p>
              <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-10 cursor-pointer transition-colors bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-center"
                onClick={() => document.getElementById('ai-report-file').click()}>
                <div className="text-4xl mb-3">⬆️</div>
                <p className="font-semibold mb-2 text-gray-900 dark:text-white text-lg">{t("Click to select or drag & drop")}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("PDF files only · Max 10MB")}</p>
              </div>
              <input type="file" id="ai-report-file" accept=".pdf" style={{ display: 'none' }} onChange={async (e) => {
                if (e.target.files.length) {
                  setAiUploadStatus({ type: 'loading', message: 'Analyzing report...' });
                  const formData = new FormData();
                  formData.append('file', e.target.files[0]);
                  try {
                    const res = await API.request('/records/upload-ai', {
                      method: 'POST',
                      body: formData
                    });
                    if (res.success) {
                      setAiUploadStatus({ type: 'success', data: res });
                      fetchRecords();
                    } else {
                      setAiUploadStatus({ type: 'error', message: res.error || 'Failed to analyze' });
                    }
                  } catch (err) {
                    setAiUploadStatus({ type: 'error', message: err.message || 'Failed to upload and analyze report.' });
                  }
                }
              }} />
              {aiUploadStatus && aiUploadStatus.type === 'loading' && (
                <div className="mt-5 p-5 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-center">
                  <div className="spinner mx-auto mb-3"></div>
                  <p className="font-semibold text-indigo-900 dark:text-indigo-200 mb-1">🤖 {t("AI is analyzing your report...")}</p>
                  <p className="text-sm text-indigo-600 dark:text-indigo-400">{t("Extracting health metrics")}</p>
                </div>
              )}
              {aiUploadStatus && aiUploadStatus.type === 'error' && (
                <div className="mt-5 p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded-xl text-left">
                  <p className="font-semibold text-red-700 dark:text-red-400 m-0">❌ {aiUploadStatus.message}</p>
                </div>
              )}
              {aiUploadStatus && aiUploadStatus.type === 'success' && (
                <div className="mt-5 p-5 bg-green-50 dark:bg-green-900/30 rounded-2xl text-center">
                  <p className="font-bold text-green-700 dark:text-green-400 mb-2">✅ {aiUploadStatus.data.message}</p>
                  {(aiUploadStatus.data.metrics_extracted || 0) > 0 ? (
                    <>
                      <div className="mt-3 text-left">
                        {Object.entries(aiUploadStatus.data.metrics || {}).map(([key, val], idx) => (
                          <div key={idx} className="flex justify-between py-2.5 border-b border-green-200 dark:border-green-800">
                            <span className="font-medium text-gray-800 dark:text-gray-200">{key}</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">{val}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-4 text-center">
                        {aiUploadStatus.data.health_entries_created || 0} health entries saved to your dashboard.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 m-0">No metrics could be extracted. The report has been saved as a record.</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-800/50">
              <button
                className={`px-6 py-3 rounded-full font-semibold border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors ${aiUploadStatus?.type === 'loading' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                onClick={() => { setShowAIUpload(false); setAiUploadStatus(null); }}
                disabled={aiUploadStatus?.type === 'loading'}
              >{t("Cancel")}</button>
              {(aiUploadStatus?.type === 'success' || aiUploadStatus?.type === 'error') && (
                <button
                  className="px-8 py-3 rounded-full font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-colors border-none"
                  onClick={() => { setShowAIUpload(false); setAiUploadStatus(null); }}
                >{t("Done")}</button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showCompare && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) setShowCompare(false) }}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">📊 {t("AI Report Comparison")}</h3>
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" onClick={() => setShowCompare(false)}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              {compareResult?.type === 'loading' && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-10">
                  <div className="spinner mx-auto mb-4"></div>
                  <p className="font-semibold text-gray-900 dark:text-white mb-1">{t("Comparing recent blood tests...")}</p>
                  <p className="text-sm">{t("Our AI is analyzing the changes.")}</p>
                </div>
              )}
              {compareResult?.type === 'error' && (
                <div className="text-center text-red-600 dark:text-red-400 py-10">
                  <p className="font-semibold">❌ {compareResult.message}</p>
                </div>
              )}
              {compareResult?.type === 'success' && (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">📅 {new Date(compareResult.data.record_1.date).toLocaleDateString()}</p>
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{compareResult.data.record_1.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{compareResult.data.record_1.findings || 'No data'}</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">📅 {new Date(compareResult.data.record_2.date).toLocaleDateString()}</p>
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{compareResult.data.record_2.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{compareResult.data.record_2.findings || 'No data'}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border-l-4 border-emerald-500">
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold mb-2">🤖 {t("AI COMPARISON")}</p>
                    <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed space-y-2"
                      dangerouslySetInnerHTML={{ __html: window.marked ? window.marked.parse(compareResult.data.comparison) : compareResult.data.comparison.replace(/\n/g, '<br>') }}>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end p-6 border-t border-gray-100 dark:border-gray-700 shrink-0">
              <button className="px-6 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors" onClick={() => setShowCompare(false)}>{t("Close")}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showSummary && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) setShowSummary(false) }}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">✨ {t("AI Summary")}: {summaryResult?.recordTitle}</h3>
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" onClick={() => setShowSummary(false)}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              {summaryResult?.type === 'loading' && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-10">
                  <div className="spinner mx-auto mb-4"></div>
                  <p className="font-semibold text-gray-900 dark:text-white mb-1">{t("Analyzing")} {summaryResult.recordTitle}...</p>
                  <p className="text-sm">{t("Our medical AI is extracting key insights.")}</p>
                </div>
              )}
              {summaryResult?.type === 'error' && (
                <div className="text-center text-red-600 dark:text-red-400 py-10">
                  <p className="font-semibold">❌ {summaryResult.message}</p>
                </div>
              )}
              {summaryResult?.type === 'success' && (
                <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed space-y-3"
                  dangerouslySetInnerHTML={{ __html: window.marked ? window.marked.parse(summaryResult.data.summary) : summaryResult.data.summary.replace(/\n/g, '<br>') }}>
                </div>
              )}
            </div>
            <div className="flex justify-end p-6 border-t border-gray-100 dark:border-gray-700 shrink-0">
              <button className="px-6 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors" onClick={() => setShowSummary(false)}>{t("Close")}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showAnalysis && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget && !isAnalyzing) setShowAnalysis(false) }}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">🤖 {t("AI Document Analysis")}</h3>
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" onClick={() => !isAnalyzing && setShowAnalysis(false)}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
              {isAnalyzing && !analysisResult && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-10">
                  <div className="spinner mx-auto mb-4"></div>
                  <p className="font-semibold text-gray-900 dark:text-white mb-1">{t("Analyzing document...")}</p>
                  <p className="text-sm">{t("Our AI is extracting key metrics and generating a summary.")}</p>
                </div>
              )}
              {analysisResult && (
                <div>
                  <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 mb-6">
                    <h4 className="text-emerald-700 dark:text-emerald-400 font-bold mb-3 flex items-center gap-2">✨ {t("AI Summary")}</h4>
                    <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed space-y-2"
                      dangerouslySetInnerHTML={{ __html: window.marked && analysisResult.ai_summary ? window.marked.parse(analysisResult.ai_summary) : (analysisResult.ai_summary || '').replace(/\n/g, '<br>') }}>
                    </div>
                  </div>

                  <h4 className="font-bold text-gray-900 dark:text-white mb-4 text-lg">Extracted Lab Metrics</h4>
                  {analysisResult.metrics && analysisResult.metrics.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            <th className="p-4 text-sm font-bold text-gray-600 dark:text-gray-300">Metric</th>
                            <th className="p-4 text-sm font-bold text-gray-600 dark:text-gray-300">Value</th>
                            <th className="p-4 text-sm font-bold text-gray-600 dark:text-gray-300">Range</th>
                            <th className="p-4 text-sm font-bold text-gray-600 dark:text-gray-300">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysisResult.metrics.map((m, idx) => (
                            <tr key={idx} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                              <td className="p-4 font-semibold text-gray-900 dark:text-white">{m.metric_name}</td>
                              <td className="p-4 text-gray-800 dark:text-gray-200">{m.value} {m.unit}</td>
                              <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">{m.reference_range || '-'}</td>
                              <td className="p-4">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${m.status && m.status.toLowerCase() === 'normal' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                    m.status && m.status.toLowerCase().includes('high') ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                      m.status && m.status.toLowerCase().includes('low') ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                  }`}>
                                  {m.status || 'Unknown'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No structured metrics found in this document.</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end p-6 border-t border-gray-100 dark:border-gray-700 shrink-0">
              <button className={`px-6 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 transition-colors ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`} disabled={isAnalyzing} onClick={() => setShowAnalysis(false)}>{t("Close")}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Records;
