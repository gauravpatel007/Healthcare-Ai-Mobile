import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import api from '../../utils/api';
import { 
  Plus, Search, Edit2, Trash2, Pill, User, Clock, CheckCircle, X
} from 'lucide-react';
import CustomSelect from '../../components/ui/CustomSelect';

export default function AdminMedicineDB() {
  const [medicines, setMedicines] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [displayCount, setDisplayCount] = useState(15);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    type: 'tablet',
    frequency: 'once_daily',
    purpose: '',
    total_pills: 30,
    remaining: 30,
    user_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [medsData, usersData] = await Promise.all([
        api.getAdminMedicines(),
        api.getAdminUsers()
      ]);
      setMedicines(medsData || []);
      setUsers(usersData || []);
    } catch(e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleOpenModal = (med = null) => {
    if (med) {
      setEditingId(med.id);
      setFormData({
        name: med.name || '',
        dosage: med.dosage || '',
        type: med.type || 'tablet',
        frequency: med.frequency || 'once_daily',
        purpose: med.purpose || '',
        total_pills: med.total_pills || 30,
        remaining: med.remaining || 30,
        user_id: med.user_id || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        dosage: '',
        type: 'tablet',
        frequency: 'once_daily',
        purpose: '',
        total_pills: 30,
        remaining: 30,
        user_id: users.length > 0 ? users[0].id : ''
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.updateAdminMedicine(editingId, formData);
      } else {
        await api.createAdminMedicine(formData);
      }
      setShowModal(false);
      fetchData();
    } catch(e) {
      console.error(e);
      alert("Failed to save medicine.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this medicine? It will be removed from the DB and user side immediately.")) return;
    try {
      await api.deleteAdminMedicine(id);
      fetchData();
    } catch(e) {
      console.error(e);
      alert("Failed to delete medicine.");
    }
  };

  const filteredMedicines = useMemo(() => {
    return medicines.filter(m => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (m.name || '').toLowerCase().includes(q) ||
             (m.purpose || '').toLowerCase().includes(q) ||
             (m.user_name || '').toLowerCase().includes(q) ||
             (m.user_email || '').toLowerCase().includes(q) ||
             (m.dosage || '').toLowerCase().includes(q);
    });
  }, [medicines, search]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-visible w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Pill className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              Medicine Database
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              Manage all user medications directly in the database.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search medicines, users, dosage..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-teal-500/20 text-sm font-medium outline-none dark:text-white"
          />
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors w-full md:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          Add Medicine
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
              <th className="p-4 pl-6">Medicine & User</th>
              <th className="p-4">Details</th>
              <th className="p-4">Stock & Frequency</th>
              <th className="p-4 text-right pr-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {loading ? (
              <tr><td colSpan="4" className="p-8 text-center text-gray-400 font-medium">Loading medicines...</td></tr>
            ) : filteredMedicines.length === 0 ? (
              <tr><td colSpan="4" className="p-8 text-center text-gray-400 font-medium">No medicines found.</td></tr>
            ) : (
              filteredMedicines.slice(0, displayCount).map(med => (
                <tr key={med.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
                        <Pill className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white text-base">{med.name}</div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{med.user_email || 'Unknown User'}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-xs font-bold text-gray-800 dark:text-gray-300">
                      {med.dosage ? `${med.dosage} • ${med.type}` : med.type}
                    </div>
                    {med.purpose && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 max-w-xs mt-0.5">
                        {med.purpose}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md w-fit">
                        <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        {med.remaining} / {med.total_pills} Pills Left
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {(med.frequency || 'once_daily').replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleOpenModal(med)} className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Edit Medicine">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(med.id)} className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Delete Medicine">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filteredMedicines.length > displayCount && (
          <div className="p-4 flex justify-center border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setDisplayCount(prev => prev + 20)}
              className="px-4 py-2 text-sm font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 rounded-lg transition-colors"
            >
              See More ({filteredMedicines.length - displayCount} more)
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6">
                {editingId ? 'Edit Medicine' : 'Add Medicine'}
              </h2>

              <form onSubmit={handleSave} className="space-y-6">
                
                {!editingId && users.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Assign to User</label>
                    <CustomSelect
                      value={formData.user_id}
                      onChange={e => setFormData({...formData, user_id: e.target.value})}
                      options={users.map(u => ({ value: u.id, label: `${u.name || u.email} (${u.email})` }))}
                      className="!bg-white dark:!bg-gray-800 border border-gray-200 dark:border-gray-600 !font-medium !py-3 !shadow-none !text-gray-900 dark:!text-white !text-base"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Medicine Name *</label>
                    <input 
                      type="text" required
                      value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      placeholder="e.g. AWS, Paracetamol"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Dosage</label>
                    <input 
                      type="text"
                      value={formData.dosage} onChange={e => setFormData({...formData, dosage: e.target.value})}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      placeholder="e.g. 100, 500mg"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Type</label>
                    <CustomSelect
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value})}
                      options={[
                        { value: "tablet", label: "Tablet 💊" },
                        { value: "capsule", label: "Capsule 🔵" },
                        { value: "syrup", label: "Syrup 🧴" },
                        { value: "injection", label: "Injection 💉" },
                        { value: "drops", label: "Drops 💧" },
                        { value: "cream", label: "Cream 🧴" }
                      ]}
                      className="!bg-white dark:!bg-gray-800 border border-gray-200 dark:border-gray-600 !font-medium !py-3 !shadow-none !text-gray-900 dark:!text-white !text-base"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Frequency</label>
                    <CustomSelect
                      value={formData.frequency}
                      onChange={e => setFormData({...formData, frequency: e.target.value})}
                      options={[
                        { value: "once_daily", label: "Once Daily" },
                        { value: "twice_daily", label: "Twice Daily" },
                        { value: "thrice_daily", label: "Thrice Daily" },
                        { value: "once_weekly", label: "Once Weekly" },
                        { value: "as_needed", label: "As Needed" }
                      ]}
                      className="!bg-white dark:!bg-gray-800 border border-gray-200 dark:border-gray-600 !font-medium !py-3 !shadow-none !text-gray-900 dark:!text-white !text-base"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Total Pills</label>
                    <input 
                      type="number" min="1"
                      value={formData.total_pills} onChange={e => setFormData({...formData, total_pills: e.target.value})}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Remaining Pills</label>
                    <input 
                      type="number" min="0"
                      value={formData.remaining} onChange={e => setFormData({...formData, remaining: e.target.value})}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Purpose / Instructions</label>
                  <textarea 
                    rows="2"
                    value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none resize-none"
                    placeholder="e.g. qqqqqq"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" onClick={() => setShowModal(false)}
                    className="flex-1 py-3.5 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors shadow-sm"
                  >
                    Save Medicine
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
