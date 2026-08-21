import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../utils/api';
import {
  Plus, Search, Edit2, Trash2, Thermometer, AlertCircle
} from 'lucide-react';

export default function AdminSymptoms() {
  const [symptoms, setSymptoms] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayCountHistory, setDisplayCountHistory] = useState(15);
  const [view, setView] = useState('dictionary'); // 'dictionary' or 'history'
  const [searchQuery, setSearchQuery] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    categories: '',
    severity_levels: '',
    body_parts: '',
    emergency_flags: false,
    medical_suggestions: ''
  });

  useEffect(() => {
    if (view === 'dictionary') {
      fetchSymptoms();
    } else {
      fetchHistory();
    }
  }, [view]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminSymptomHistory();
      setHistory(data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchSymptoms = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminSymptoms();
      setSymptoms(data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        name: item.name || '',
        categories: (item.categories || []).join(', '),
        severity_levels: item.severity_levels || '',
        body_parts: (item.body_parts || []).join(', '),
        emergency_flags: item.emergency_flags || false,
        medical_suggestions: item.medical_suggestions || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        categories: '',
        severity_levels: '',
        body_parts: '',
        emergency_flags: false,
        medical_suggestions: ''
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const payload = {
      ...formData,
      categories: formData.categories.split(',').map(s => s.trim()).filter(Boolean),
      body_parts: formData.body_parts.split(',').map(s => s.trim()).filter(Boolean),
    };

    try {
      if (editingId) {
        await api.updateAdminSymptom(editingId, payload);
      } else {
        await api.createAdminSymptom(payload);
      }
      setShowModal(false);
      fetchSymptoms();
    } catch (e) {
      console.error(e);
      alert("Failed to save symptom.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this symptom?")) return;
    try {
      await api.deleteAdminSymptom(id);
      fetchSymptoms();
    } catch (e) {
      console.error(e);
      alert("Failed to delete symptom.");
    }
  };

  const filteredSymptoms = symptoms.filter(s =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.categories || []).join(' ').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHistory = history.filter(h =>
    h.user_name?.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
    h.user_email?.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
    (h.symptoms || []).join(' ').toLowerCase().includes(historySearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-visible w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Thermometer className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              Symptom Checker
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              Manage dictionary of symptoms or view user check history.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 relative z-10 shrink-0 ml-auto pr-2 flex-wrap">
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
            <button
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'dictionary' ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              onClick={() => setView('dictionary')}
            >
              Dictionary
            </button>
            <button
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'history' ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              onClick={() => setView('history')}
            >
              History
            </button>
          </div>
        </div>
      </div>

      {view === 'dictionary' ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="relative w-full md:w-96">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symptoms..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-amber-500/20 text-sm font-medium"
              />
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors w-full md:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              Add Symptom
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                  <th className="p-4 pl-6">Symptom</th>
                  <th className="p-4">Categorization</th>
                  <th className="p-4">Medical Advice</th>
                  <th className="p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {loading ? (
                  <tr><td colSpan="4" className="p-8 text-center text-gray-400 font-medium">Loading symptoms...</td></tr>
                ) : filteredSymptoms.length === 0 ? (
                  <tr><td colSpan="4" className="p-8 text-center text-gray-400 font-medium">No symptoms found.</td></tr>
                ) : (
                  filteredSymptoms.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                            <Thermometer className="w-5 h-5 text-amber-500" />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                              {item.name}
                              {item.emergency_flags && (
                                <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-md">
                                  <AlertCircle className="w-3 h-3" />
                                  Emergency
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px] mt-0.5">
                              {(item.body_parts || []).join(', ') || 'No body parts'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {(item.categories || []).map((cat, i) => (
                            <span key={i} className="text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-md border border-amber-100">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                          {item.medical_suggestions || '—'}
                        </div>
                      </td>
                      <td className="p-4 text-right pr-6">
                        <div className="flex items-center justify-end gap-2 transition-opacity">
                          <button onClick={() => handleOpenModal(item)} className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:bg-amber-900/30 rounded-lg transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 dark:hover:bg-red-900/30 dark:bg-red-900/30 dark:hover:bg-red-900/30 dark:bg-red-900/30 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="relative w-full md:w-96">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                placeholder="Search history by name, email or symptom..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-amber-500/20 text-sm font-medium"
              />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                  <th className="p-4 pl-6">Date & User</th>
                  <th className="p-4">Symptoms & Details</th>
                  <th className="p-4">Predicted Conditions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {loading ? (
                  <tr><td colSpan="3" className="p-8 text-center text-gray-400 font-medium">Loading history...</td></tr>
                ) : filteredHistory.length === 0 ? (
                  <tr><td colSpan="3" className="p-8 text-center text-gray-400 font-medium">No symptom checks found.</td></tr>
                ) : (
                  filteredHistory.slice(0, displayCountHistory).map(item => (
                    <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 transition-colors">
                      <td className="p-4 pl-6 align-top">
                        <div className="font-bold text-gray-900 dark:text-white">{new Date(item.created_at).toLocaleString()}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.user_name}</div>
                        <div className="text-xs text-gray-400">{item.user_email}</div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex flex-wrap gap-1 mb-2">
                          {(item.symptoms || []).map((sym, i) => (
                            <span key={i} className="text-xs font-bold text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md">
                              {sym}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-4">
                          <span><strong>Duration:</strong> {item.duration || '—'}</span>
                          <span><strong>Severity:</strong> {item.severity || '—'}</span>
                          <span><strong>Urgency:</strong> {item.urgency || '—'}</span>
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="space-y-1">
                          {(item.predicted_conditions || []).map((cond, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="font-medium text-gray-800 dark:text-gray-300">{cond.condition}</span>
                              <span className="text-gray-500 dark:text-gray-400">{cond.probability}%</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {filteredHistory.length > displayCountHistory && (
              <div className="p-4 flex justify-center border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => setDisplayCountHistory(prev => prev + 20)}
                  className="px-4 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 rounded-lg transition-colors"
                >
                  See More ({filteredHistory.length - displayCountHistory} more)
                </button>
              </div>
            )}
          </div>
        </div>
      )}


      {showModal && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 md:p-8 overflow-y-auto overflow-x-hidden custom-scrollbar">
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6">
                {editingId ? 'Edit Symptom' : 'Add Symptom'}
              </h2>

              <form onSubmit={handleSave} className="space-y-6">

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Symptom Name</label>
                    <input
                      type="text" required
                      value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                      placeholder="e.g. Cough"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Severity Levels</label>
                      <input
                        type="text"
                        value={formData.severity_levels} onChange={e => setFormData({ ...formData, severity_levels: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                        placeholder="e.g. Mild to Severe"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Body Parts (comma separated)</label>
                      <input
                        type="text"
                        value={formData.body_parts} onChange={e => setFormData({ ...formData, body_parts: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                        placeholder="e.g. Head, Neck, Chest"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Categories (comma separated)</label>
                    <input
                      type="text"
                      value={formData.categories} onChange={e => setFormData({ ...formData, categories: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                      placeholder="e.g. Respiratory, Neurological"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Medical Suggestions / Advice</label>
                    <textarea
                      rows="3"
                      value={formData.medical_suggestions} onChange={e => setFormData({ ...formData, medical_suggestions: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none resize-none"
                      placeholder="What should the user do?"
                    />
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-100">
                    <input
                      type="checkbox"
                      id="emergency_flag"
                      checked={formData.emergency_flags}
                      onChange={(e) => setFormData({ ...formData, emergency_flags: e.target.checked })}
                      className="w-5 h-5 text-red-600 dark:text-red-400 rounded border-red-300 focus:ring-red-500"
                    />
                    <div>
                      <label htmlFor="emergency_flag" className="font-bold text-red-900 cursor-pointer">Emergency Symptom</label>
                      <p className="text-xs text-red-700 font-medium mt-0.5">Flag this symptom as requiring immediate medical attention.</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button" onClick={() => setShowModal(false)}
                    className="flex-1 py-3.5 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors shadow-sm"
                  >
                    Save Symptom
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
