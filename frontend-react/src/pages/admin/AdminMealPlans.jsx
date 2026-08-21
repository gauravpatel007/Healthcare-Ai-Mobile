import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../utils/api';
import {
  Plus, Search, Edit2, Trash2, CalendarDays, Target, ShoppingCart, Users
} from 'lucide-react';
import CustomSelect from '../../components/ui/CustomSelect';

export default function AdminMealPlans({ activeTab }) {
  const [plans, setPlans] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(15);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignPlanId, setAssignPlanId] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '', description: '', goal: 'Maintenance',
    duration_days: 7, daily_calorie_target: 2000, status: 'Draft',
    meals_data: '', shopping_list: ''
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [plansData, usersData] = await Promise.all([
        api.getAdminMealPlans(),
        api.getAdminUsers().catch(() => [])
      ]);
      setPlans(plansData || []);
      setUsers(usersData || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        title: item.title || '',
        description: item.description || '',
        goal: item.goal || 'Maintenance',
        duration_days: item.duration_days || 7,
        daily_calorie_target: item.daily_calorie_target || 2000,
        status: item.status || 'Draft',
        meals_data: JSON.stringify(item.meals_data || [], null, 2),
        shopping_list: (item.shopping_list || []).join(', ')
      });
    } else {
      setEditingId(null);
      setFormData({
        title: '', description: '', goal: 'Maintenance',
        duration_days: 7, daily_calorie_target: 2000, status: 'Draft',
        meals_data: '[]', shopping_list: ''
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    let mealsDataParsed = [];
    try {
      mealsDataParsed = JSON.parse(formData.meals_data);
    } catch { mealsDataParsed = []; }

    const payload = {
      ...formData,
      duration_days: parseInt(formData.duration_days) || 7,
      daily_calorie_target: parseInt(formData.daily_calorie_target) || 2000,
      meals_data: mealsDataParsed,
      shopping_list: formData.shopping_list.split(',').map(s => s.trim()).filter(Boolean),
    };
    try {
      if (editingId) {
        await api.updateAdminMealPlan(editingId, payload);
      } else {
        await api.createAdminMealPlan(payload);
      }
      setShowModal(false);
      fetchAll();
    } catch (e) {
      console.error(e);
      alert('Failed to save meal plan.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this meal plan?')) return;
    try {
      await api.deleteAdminMealPlan(id);
      fetchAll();
    } catch (e) {
      console.error(e);
      alert('Failed to delete meal plan.');
    }
  };

  const openAssignModal = (planId) => {
    setAssignPlanId(planId);
    const plan = plans.find(p => p.id === planId);
    setSelectedUserIds(plan?.assigned_users || []);
    setShowAssignModal(true);
  };

  const handleAssign = async () => {
    try {
      await api.assignMealPlan(assignPlanId, selectedUserIds);
      setShowAssignModal(false);
      fetchAll();
    } catch (e) {
      console.error(e);
      alert('Failed to assign meal plan.');
    }
  };

  const toggleUserSelection = (uid) => {
    setSelectedUserIds(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const adminPlans = plans.filter(p => p.source !== 'AI');
  const historyPlans = plans.filter(p => p.source === 'AI');
  const currentList = activeTab === 'history' ? historyPlans : adminPlans;

  const filtered = currentList.filter(p =>
    p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.goal?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (activeTab === 'history' && p.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const goalColor = (goal) => {
    const map = {
      'Weight Loss': 'text-red-700 bg-red-50 border-red-100',
      'Muscle Gain': 'text-blue-700 bg-blue-50 border-blue-100',
      'Maintenance': 'text-emerald-700 bg-emerald-50 border-emerald-100',
      'Medical': 'text-purple-700 bg-purple-50 border-purple-100',
    };
    return map[goal] || map['Maintenance'];
  };

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search meal plans..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-teal-500/20 text-sm font-medium" />
        </div>
        <button onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors w-full md:w-auto justify-center">
          <Plus className="w-4 h-4" /> Add Meal Plan
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mt-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
              <th className="p-4 pl-6">Meal Plan</th>
              <th className="p-4">Goal & Calories</th>
              <th className="p-4">{activeTab === 'history' ? 'Generated By & Date' : 'Assignment'}</th>
              <th className="p-4 text-right pr-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {loading ? (
              <tr><td colSpan="4" className="p-8 text-center text-gray-400 font-medium">Loading meal plans...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="4" className="p-8 text-center text-gray-400 font-medium">No meal plans found. Create one!</td></tr>
            ) : (
              filtered.slice(0, displayCount).map(item => (
                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
                        <CalendarDays className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">{item.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.duration_days} days · {item.status}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${goalColor(item.goal)}`}>
                      {item.goal}
                    </span>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1">
                      <Target className="w-3 h-3" /> {item.daily_calorie_target || 2000} cal/day
                    </div>
                  </td>
                  <td className="p-4">
                    {activeTab === 'history' ? (
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">{item.user?.name || 'Unknown User'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.user?.email || 'No email provided'}</div>
                        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1.5 flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" /> {new Date(item.created_at).toLocaleString()}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-600">
                            {(item.assigned_users || []).length} users
                          </span>
                          <button onClick={() => openAssignModal(item.id)}
                            className="flex items-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 px-2 py-1 rounded-lg transition-colors">
                            <Users className="w-3 h-3" /> Assign
                          </button>
                        </div>
                        {(item.shopping_list || []).length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                            <ShoppingCart className="w-3 h-3" /> {item.shopping_list.length} items
                          </div>
                        )}
                      </>
                    )}
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
        {filtered.length > displayCount && (
          <div className="p-4 mt-2 flex justify-center border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setDisplayCount(prev => prev + 20)}
              className="px-4 py-2 text-sm font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 rounded-lg transition-colors"
            >
              See More ({filtered.length - displayCount} more)
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 md:p-8 overflow-y-auto overflow-x-hidden custom-scrollbar">
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6">
                {editingId ? 'Edit Meal Plan' : 'Add Meal Plan'}
              </h2>

              <form onSubmit={handleSave} className="space-y-6">

                <div className="bg-gray-50/50 dark:bg-gray-700/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                  <h3 className="text-sm font-extrabold text-teal-700 uppercase tracking-wider">Plan Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Plan Title</label>
                      <input type="text" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                        placeholder="e.g. 7-Day Keto Plan" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Goal</label>
                      <CustomSelect
                        value={formData.goal}
                        onChange={e => setFormData({ ...formData, goal: e.target.value })}
                        options={[
                          { value: "Weight Loss", label: "Weight Loss" },
                          { value: "Muscle Gain", label: "Muscle Gain" },
                          { value: "Maintenance", label: "Maintenance" },
                          { value: "Medical", label: "Medical" }
                        ]}
                        className="!bg-white dark:!bg-gray-800 border border-gray-200 dark:border-gray-600 !font-medium !py-3 !shadow-none !text-gray-900 dark:!text-white !text-base"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Description</label>
                    <textarea rows="2" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 outline-none resize-none"
                      placeholder="Plan overview..." />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Duration (days)</label>
                      <input type="number" min="1" value={formData.duration_days} onChange={e => setFormData({ ...formData, duration_days: e.target.value })}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Daily Calorie Target</label>
                      <input type="number" min="0" value={formData.daily_calorie_target} onChange={e => setFormData({ ...formData, daily_calorie_target: e.target.value })}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Status</label>
                      <CustomSelect
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                        options={[
                          { value: "Draft", label: "Draft" },
                          { value: "Published", label: "Published" }
                        ]}
                        className="!bg-white dark:!bg-gray-800 border border-gray-200 dark:border-gray-600 !font-medium !py-3 !shadow-none !text-gray-900 dark:!text-white !text-base"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50/50 dark:bg-gray-700/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                  <h3 className="text-sm font-extrabold text-indigo-700 uppercase tracking-wider">Meal Schedule (JSON)</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Format: <code className="bg-gray-200 px-1 rounded">[{`{"day":1,"meal_type":"Breakfast","recipe_title":"Oatmeal","servings":1}`}]</code>
                  </p>
                  <textarea rows="5" value={formData.meals_data} onChange={e => setFormData({ ...formData, meals_data: e.target.value })}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none" />
                </div>

                <div className="bg-gray-50/50 dark:bg-gray-700/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                  <h3 className="text-sm font-extrabold text-amber-700 uppercase tracking-wider">Shopping List (comma separated)</h3>
                  <textarea rows="2" value={formData.shopping_list} onChange={e => setFormData({ ...formData, shopping_list: e.target.value })}
                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/20 outline-none resize-none"
                    placeholder="2 eggs, 500g chicken, 1 bag spinach" />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="flex-1 py-3.5 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-colors">
                    Cancel
                  </button>
                  <button type="submit"
                    className="flex-1 py-3.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors shadow-sm">
                    Save Meal Plan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Assign Users Modal */}
      {showAssignModal && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" onClick={() => setShowAssignModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" /> Assign to Users
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select users to assign this meal plan to.</p>

              {users.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No users found.</p>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {users.map(u => (
                    <label key={u.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${
                      selectedUserIds.includes(u.id) ? 'bg-teal-50 border-teal-200' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                    }`}>
                      <input type="checkbox" checked={selectedUserIds.includes(u.id)}
                        onChange={() => toggleUserSelection(u.id)}
                        className="w-4 h-4 text-teal-600 dark:text-teal-400 rounded border-gray-300 focus:ring-teal-500" />
                      <div>
                        <div className="font-bold text-sm text-gray-900 dark:text-white">{u.name || u.email}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-6">
                <button onClick={() => setShowAssignModal(false)}
                  className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-colors">
                  Cancel
                </button>
                <button onClick={handleAssign}
                  className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors shadow-sm">
                  Assign ({selectedUserIds.length})
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
