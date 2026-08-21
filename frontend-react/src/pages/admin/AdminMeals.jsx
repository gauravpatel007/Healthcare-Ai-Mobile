import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../utils/api';
import { Plus, Search, Edit2, Trash2, UtensilsCrossed, Flame } from 'lucide-react';
import CustomSelect from '../../components/ui/CustomSelect';

export default function AdminMeals() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(15);
  const [searchQuery, setSearchQuery] = useState('');

  // Form Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meal_type: 'Lunch',
    image_url: '',
    prep_time_minutes: 30,
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    fiber: 0,
    status: 'Published'
  });

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminRecipes();
      setRecipes(data || []);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        title: item.title,
        description: item.description || '',
        meal_type: item.meal_type || 'Lunch',
        image_url: item.image_url || '',
        prep_time_minutes: item.prep_time_minutes || 30,
        calories: item.calories || 0,
        protein: item.protein || 0,
        fat: item.fat || 0,
        carbs: item.carbs || 0,
        fiber: item.fiber || 0,
        status: item.status || 'Published'
      });
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        description: '',
        meal_type: 'Lunch',
        image_url: '',
        prep_time_minutes: 30,
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        fiber: 0,
        status: 'Published'
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.updateAdminRecipe(editingId, formData);
      } else {
        await api.createAdminRecipe(formData);
      }
      setShowModal(false);
      fetchRecipes();
    } catch (error) {
      console.error(error);
      alert('Failed to save meal.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this meal?')) return;
    try {
      await api.deleteAdminRecipe(id);
      fetchRecipes();
    } catch (error) {
      console.error(error);
      alert('Failed to delete meal.');
    }
  };

  const filtered = recipes.filter(r => 
    r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.meal_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search meals..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-teal-500/20 text-sm font-medium"
          />
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center w-full md:w-auto gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Meal
        </button>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mt-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
              <th className="p-4 pl-6">Meal Details</th>
              <th className="p-4">Type</th>
              <th className="p-4">Nutrition</th>
              <th className="p-4 text-right pr-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {loading ? (
              <tr><td colSpan="4" className="p-8 text-center text-gray-400 font-medium">Loading meals...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="4" className="p-8 text-center text-gray-400 font-medium">No meals found.</td></tr>
            ) : (
              filtered.slice(0, displayCount).map(item => (
                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <UtensilsCrossed className="w-5 h-5 text-orange-600" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">{item.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-[200px] truncate">{item.description || 'No description'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-xs font-bold px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 rounded-lg">
                      {item.meal_type}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-4 text-sm font-semibold">
                      <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                        <span className="text-gray-500 dark:text-gray-400 text-xs">Protein:</span> {item.protein || 0}g
                      </div>
                      <div className="flex items-center gap-1 text-orange-600">
                        <Flame className="w-3.5 h-3.5" /> {item.calories || 0} cal
                      </div>
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

      {showModal && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 md:p-8 overflow-y-auto overflow-x-hidden custom-scrollbar">
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6">
                {editingId ? 'Edit Meal' : 'Add Meal'}
              </h2>

              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Meal Name</label>
                    <input type="text" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      placeholder="e.g. Egg White Omelette" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Meal Type</label>
                    <CustomSelect
                      value={formData.meal_type}
                      onChange={e => setFormData({ ...formData, meal_type: e.target.value })}
                      options={[
                        { value: "Breakfast", label: "Breakfast" },
                        { value: "Lunch", label: "Lunch" },
                        { value: "Snack", label: "Snack" },
                        { value: "Dinner", label: "Dinner" }
                      ]}
                      className="!bg-white dark:!bg-gray-800 border border-gray-200 dark:border-gray-600 !font-medium !py-3 !shadow-none !text-gray-900 dark:!text-white !text-base"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Calories (kcal)</label>
                    <input type="number" required value={formData.calories} onChange={e => setFormData({ ...formData, calories: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Protein (g)</label>
                    <input type="number" required value={formData.protein} onChange={e => setFormData({ ...formData, protein: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none" />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Image URL (Optional)</label>
                    <input type="text" value={formData.image_url} onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      placeholder="https://..." />
                  </div>
                </div>

                <div className="flex gap-3 pt-6 border-t border-gray-100 dark:border-gray-700">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold py-3 px-4 rounded-xl transition-colors">
                    Cancel
                  </button>
                  <button type="submit"
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-teal-500/30">
                    Save Meal
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
