import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../utils/api';
import {
  Plus, Search, Edit2, Trash2, UtensilsCrossed, Clock, Flame
} from 'lucide-react';
import CustomSelect from '../../components/ui/CustomSelect';

export default function AdminRecipes() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '', description: '', meal_type: 'Lunch', image_url: '',
    prep_time_minutes: 30, calories: 0, protein: 0, fat: 0,
    carbs: 0, fiber: 0, vitamins: '', ingredients: '', instructions: '',
    status: 'Published'
  });

  useEffect(() => { fetchRecipes(); }, []);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminRecipes();
      setRecipes(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        title: item.title || '',
        description: item.description || '',
        meal_type: item.meal_type || 'Lunch',
        image_url: item.image_url || '',
        prep_time_minutes: item.prep_time_minutes || 30,
        calories: item.calories || 0,
        protein: item.protein || 0,
        fat: item.fat || 0,
        carbs: item.carbs || 0,
        fiber: item.fiber || 0,
        vitamins: (item.vitamins || []).join(', '),
        ingredients: (item.ingredients || []).join(', '),
        instructions: item.instructions || '',
        status: item.status || 'Published'
      });
    } else {
      setEditingId(null);
      setFormData({
        title: '', description: '', meal_type: 'Lunch', image_url: '',
        prep_time_minutes: 30, calories: 0, protein: 0, fat: 0,
        carbs: 0, fiber: 0, vitamins: '', ingredients: '', instructions: '',
        status: 'Published'
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      prep_time_minutes: parseInt(formData.prep_time_minutes) || 30,
      calories: parseInt(formData.calories) || 0,
      protein: parseInt(formData.protein) || 0,
      fat: parseInt(formData.fat) || 0,
      carbs: parseInt(formData.carbs) || 0,
      fiber: parseInt(formData.fiber) || 0,
      vitamins: formData.vitamins.split(',').map(s => s.trim()).filter(Boolean),
      ingredients: formData.ingredients.split(',').map(s => s.trim()).filter(Boolean),
    };
    try {
      if (editingId) {
        await api.updateAdminRecipe(editingId, payload);
      } else {
        await api.createAdminRecipe(payload);
      }
      setShowModal(false);
      fetchRecipes();
    } catch (e) {
      console.error(e);
      alert('Failed to save recipe.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this recipe?')) return;
    try {
      await api.deleteAdminRecipe(id);
      fetchRecipes();
    } catch (e) {
      console.error(e);
      alert('Failed to delete recipe.');
    }
  };

  const filtered = recipes.filter(r =>
    r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.meal_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const mealColor = (type) => {
    const colors = {
      'Breakfast': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
      'Lunch': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
      'Dinner': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100' },
      'Snack': { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-100' },
    };
    return colors[type] || colors['Lunch'];
  };

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium"
          />
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors w-full md:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          Add Recipe
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mt-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
              <th className="p-4 pl-6">Recipe</th>
              <th className="p-4">Nutrition</th>
              <th className="p-4">Details</th>
              <th className="p-4 text-right pr-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {loading ? (
              <tr><td colSpan="4" className="p-8 text-center text-gray-400 font-medium">Loading recipes...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="4" className="p-8 text-center text-gray-400 font-medium">No recipes found. Create one!</td></tr>
            ) : (
              filtered.map(item => {
                const mc = mealColor(item.meal_type);
                return (
                  <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                          <UtensilsCrossed className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white">{item.title}</div>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${mc.bg} ${mc.text} border ${mc.border}`}>
                            {item.meal_type}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2 text-xs font-bold">
                        <span className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded-md">
                          <Flame className="w-3 h-3" /> {item.calories || 0} cal
                        </span>
                        <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md">P: {item.protein || 0}g</span>
                        <span className="text-yellow-600 bg-yellow-50 px-2 py-1 rounded-md">F: {item.fat || 0}g</span>
                        <span className="text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded-md">C: {item.carbs || 0}g</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        <Clock className="w-3.5 h-3.5" /> {item.prep_time_minutes || 0} min
                      </div>
                      <div className="text-xs text-gray-400 mt-1 truncate max-w-[180px]">
                        Fiber: {item.fiber || 0}g · {(item.ingredients || []).length} ingredients
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 md:p-8">
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6">
                {editingId ? 'Edit Recipe' : 'Add Recipe'}
              </h2>

              <form onSubmit={handleSave} className="space-y-6">

                {/* Basic Info */}
                <div className="bg-gray-50/50 dark:bg-gray-700/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                  <h3 className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Basic Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Recipe Title</label>
                      <input type="text" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                        placeholder="e.g. Grilled Chicken Salad" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Meal Type</label>
                      <CustomSelect
                        value={formData.meal_type}
                        onChange={e => setFormData({ ...formData, meal_type: e.target.value })}
                        options={[
                          { value: "Breakfast", label: "Breakfast" },
                          { value: "Lunch", label: "Lunch" },
                          { value: "Dinner", label: "Dinner" },
                          { value: "Snack", label: "Snack" }
                        ]}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 font-medium py-[8px]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Description</label>
                      <textarea rows="2" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"
                        placeholder="Short description..." />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Prep Time (min)</label>
                      <input type="number" value={formData.prep_time_minutes} onChange={e => setFormData({ ...formData, prep_time_minutes: e.target.value })}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Image URL</label>
                    <input type="text" value={formData.image_url} onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      placeholder="https://example.com/image.jpg" />
                  </div>
                </div>

                {/* Nutrition */}
                <div className="bg-gray-50/50 dark:bg-gray-700/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                  <h3 className="text-sm font-extrabold text-orange-700 uppercase tracking-wider">Nutritional Information (per serving)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                      { key: 'calories', label: 'Calories', color: 'orange' },
                      { key: 'protein', label: 'Protein (g)', color: 'blue' },
                      { key: 'fat', label: 'Fat (g)', color: 'yellow' },
                      { key: 'carbs', label: 'Carbs (g)', color: 'purple' },
                      { key: 'fiber', label: 'Fiber (g)', color: 'green' },
                    ].map(field => (
                      <div key={field.key} className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-600">{field.label}</label>
                        <input type="number" min="0" value={formData[field.key]} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-gray-900 dark:text-white font-bold text-center focus:ring-2 focus:ring-orange-500/20 outline-none" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Vitamins (comma separated)</label>
                    <input type="text" value={formData.vitamins} onChange={e => setFormData({ ...formData, vitamins: e.target.value })}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-orange-500/20 outline-none"
                      placeholder="Vitamin A, Vitamin C, Iron" />
                  </div>
                </div>

                {/* Recipe Details */}
                <div className="bg-gray-50/50 dark:bg-gray-700/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                  <h3 className="text-sm font-extrabold text-indigo-700 uppercase tracking-wider">Recipe Details</h3>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Ingredients (comma separated)</label>
                    <textarea rows="2" value={formData.ingredients} onChange={e => setFormData({ ...formData, ingredients: e.target.value })}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
                      placeholder="2 eggs, 200g chicken breast, 1 cup rice" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Instructions</label>
                    <textarea rows="3" value={formData.instructions} onChange={e => setFormData({ ...formData, instructions: e.target.value })}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
                      placeholder="Step by step cooking instructions..." />
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
                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 font-medium py-[8px]"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="flex-1 py-3.5 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-colors">
                    Cancel
                  </button>
                  <button type="submit"
                    className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-sm">
                    Save Recipe
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
