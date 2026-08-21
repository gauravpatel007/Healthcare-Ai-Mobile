import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../utils/api';
import { 
  Plus, Search, Edit2, Trash2, HeartPulse, Activity, ShieldAlert
} from 'lucide-react';
import CustomSelect from '../../components/ui/CustomSelect';

export default function AdminDiseaseDB() {
  const [diseases, setDiseases] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    symptoms: '',
    causes: '',
    treatment: '',
    severity: 'Mild',
    emergency_level: 'Low',
    risk_factors: '',
    home_remedies: '',
    doctor_recommendation: '',
    related_diseases: ''
  });

  useEffect(() => {
    fetchDiseases();
  }, []);

  const fetchDiseases = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminDiseases();
      setDiseases(data || []);
    } catch(e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        name: item.name || '',
        symptoms: (item.symptoms || []).join(', '),
        causes: (item.causes || []).join(', '),
        treatment: item.treatment || '',
        severity: item.severity || 'Mild',
        emergency_level: item.emergency_level || 'Low',
        risk_factors: (item.risk_factors || []).join(', '),
        home_remedies: (item.home_remedies || []).join(', '),
        doctor_recommendation: item.doctor_recommendation || '',
        related_diseases: (item.related_diseases || []).join(', ')
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        symptoms: '',
        causes: '',
        treatment: '',
        severity: 'Mild',
        emergency_level: 'Low',
        risk_factors: '',
        home_remedies: '',
        doctor_recommendation: '',
        related_diseases: ''
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      symptoms: formData.symptoms.split(',').map(s => s.trim()).filter(Boolean),
      causes: formData.causes.split(',').map(s => s.trim()).filter(Boolean),
      risk_factors: formData.risk_factors.split(',').map(s => s.trim()).filter(Boolean),
      home_remedies: formData.home_remedies.split(',').map(s => s.trim()).filter(Boolean),
      related_diseases: formData.related_diseases.split(',').map(s => s.trim()).filter(Boolean),
    };

    try {
      if (editingId) {
        await api.updateAdminDisease(editingId, payload);
      } else {
        await api.createAdminDisease(payload);
      }
      setShowModal(false);
      fetchDiseases();
    } catch(e) {
      console.error(e);
      alert("Failed to save disease.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this disease?")) return;
    try {
      await api.deleteAdminDisease(id);
      fetchDiseases();
    } catch(e) {
      console.error(e);
      alert("Failed to delete disease.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-visible w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <HeartPulse className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              Disease Database
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              Manage global disease data, symptoms, causes, and treatments.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            placeholder="Search diseases..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-rose-500/20 text-sm font-medium"
          />
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors w-full md:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          Add Disease
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
              <th className="p-4 pl-6">Disease</th>
              <th className="p-4">Details</th>
              <th className="p-4">Risk Profile</th>
              <th className="p-4 text-right pr-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {loading ? (
              <tr><td colSpan="4" className="p-8 text-center text-gray-400 font-medium">Loading diseases...</td></tr>
            ) : diseases.length === 0 ? (
              <tr><td colSpan="4" className="p-8 text-center text-gray-400 font-medium">No diseases found. Create one!</td></tr>
            ) : (
              diseases.map(item => (
                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                        <HeartPulse className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">{item.name}</div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1 max-w-xs">
                          {(item.symptoms || []).join(', ')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-xs text-gray-600 line-clamp-1 max-w-xs">
                      <span className="font-bold text-gray-700 dark:text-gray-300">Treatment: </span>{item.treatment || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-600 line-clamp-1 max-w-xs mt-1">
                      <span className="font-bold text-gray-700 dark:text-gray-300">Causes: </span>{(item.causes || []).join(', ') || 'N/A'}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                        <Activity className="w-3.5 h-3.5 text-amber-500" />
                        Severity: {item.severity}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                        <ShieldAlert className={`w-3.5 h-3.5 ${item.emergency_level === 'High' ? 'text-red-500' : 'text-emerald-500'}`} />
                        Emergency: {item.emergency_level}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleOpenModal(item)} className="p-2 text-gray-400 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 dark:bg-blue-900/30 dark:hover:bg-blue-900/30 dark:bg-blue-900/30 dark:hover:bg-blue-900/30 dark:bg-blue-900/30 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400 dark:text-red-400 dark:hover:text-red-400 dark:text-red-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 dark:hover:bg-red-900/30 dark:bg-red-900/30 dark:hover:bg-red-900/30 dark:bg-red-900/30 rounded-lg transition-colors">
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

      {/* Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 md:p-8 overflow-y-auto overflow-x-hidden custom-scrollbar">
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6">
                {editingId ? 'Edit Disease' : 'Add Disease'}
              </h2>

              <form onSubmit={handleSave} className="space-y-6">
                
                <div className="bg-gray-50/50 dark:bg-gray-700/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                  <h3 className="text-sm font-extrabold text-rose-700 uppercase tracking-wider">Basic Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Disease Name</label>
                      <input 
                        type="text" required
                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                        placeholder="e.g. Hypertension"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Severity</label>
                      <CustomSelect
                        value={formData.severity}
                        onChange={e => setFormData({...formData, severity: e.target.value})}
                        options={[
                          { value: "Mild", label: "Mild" },
                          { value: "Moderate", label: "Moderate" },
                          { value: "Severe", label: "Severe" },
                          { value: "Critical", label: "Critical" }
                        ]}
                        className="!bg-white dark:!bg-gray-800 border border-gray-200 dark:border-gray-600 !font-medium !py-3 !shadow-none !text-gray-900 dark:!text-white !text-base"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Emergency Level</label>
                      <CustomSelect
                        value={formData.emergency_level}
                        onChange={e => setFormData({...formData, emergency_level: e.target.value})}
                        options={[
                          { value: "Low", label: "Low" },
                          { value: "Medium", label: "Medium" },
                          { value: "High", label: "High" }
                        ]}
                        className="!bg-white dark:!bg-gray-800 border border-gray-200 dark:border-gray-600 !font-medium !py-3 !shadow-none !text-gray-900 dark:!text-white !text-base"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50/50 dark:bg-gray-700/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                  <h3 className="text-sm font-extrabold text-indigo-700 uppercase tracking-wider">Clinical Information (Comma Separated)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Symptoms</label>
                      <input 
                        type="text" 
                        value={formData.symptoms} onChange={e => setFormData({...formData, symptoms: e.target.value})}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        placeholder="Headache, Fever, Fatigue"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Causes</label>
                      <input 
                        type="text" 
                        value={formData.causes} onChange={e => setFormData({...formData, causes: e.target.value})}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        placeholder="Viral infection, Genetics"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Risk Factors</label>
                      <input 
                        type="text" 
                        value={formData.risk_factors} onChange={e => setFormData({...formData, risk_factors: e.target.value})}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        placeholder="Smoking, Age, Obesity"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50/50 dark:bg-gray-700/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                  <h3 className="text-sm font-extrabold text-teal-700 uppercase tracking-wider">Treatments & Advice</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Treatment Plan</label>
                      <textarea 
                        rows="2"
                        value={formData.treatment} onChange={e => setFormData({...formData, treatment: e.target.value})}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 outline-none resize-none"
                        placeholder="Standard treatment protocols..."
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Doctor's Recommendation</label>
                      <textarea 
                        rows="2"
                        value={formData.doctor_recommendation} onChange={e => setFormData({...formData, doctor_recommendation: e.target.value})}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 outline-none resize-none"
                        placeholder="When to see a doctor..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Home Remedies (Comma Separated)</label>
                      <input 
                        type="text" 
                        value={formData.home_remedies} onChange={e => setFormData({...formData, home_remedies: e.target.value})}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 outline-none"
                        placeholder="Rest, Hydration"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Related Diseases (Comma Separated)</label>
                      <input 
                        type="text" 
                        value={formData.related_diseases} onChange={e => setFormData({...formData, related_diseases: e.target.value})}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 outline-none"
                        placeholder="Flu, Common Cold"
                      />
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
                    className="flex-1 py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors shadow-sm"
                  >
                    Save Disease
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
