import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../utils/api';
import { 
  Plus, Search, Edit2, Trash2, Dumbbell, 
  Clock, Flame, CheckCircle2, Archive
} from 'lucide-react';
import CustomSelect from '../../components/ui/CustomSelect';

export default function AdminExerciseLibrary() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    difficulty: 'Beginner',
    duration_seconds: 60,
    calories_burn: 10,
    muscle_groups: '',
    equipment: '',
    categories: '',
    status: 'Published'
  });

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminExercises();
      setExercises(data || []);
    } catch(e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleOpenModal = (exercise = null) => {
    if (exercise) {
      setEditingId(exercise.id);
      setFormData({
        title: exercise.title || '',
        description: exercise.description || '',
        difficulty: exercise.difficulty || 'Beginner',
        duration_seconds: exercise.duration_seconds || 60,
        calories_burn: exercise.calories_burn || 10,
        muscle_groups: (exercise.muscle_groups || []).join(', '),
        equipment: (exercise.equipment || []).join(', '),
        categories: (exercise.categories || []).join(', '),
        status: exercise.status || 'Published'
      });
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        description: '',
        difficulty: 'Beginner',
        duration_seconds: 60,
        calories_burn: 10,
        muscle_groups: '',
        equipment: '',
        categories: '',
        status: 'Published'
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Convert comma separated strings to arrays
    const payload = {
      ...formData,
      muscle_groups: formData.muscle_groups.split(',').map(s => s.trim()).filter(Boolean),
      equipment: formData.equipment.split(',').map(s => s.trim()).filter(Boolean),
      categories: formData.categories.split(',').map(s => s.trim()).filter(Boolean),
    };

    try {
      if (editingId) {
        await api.updateAdminExercise(editingId, payload);
      } else {
        await api.createAdminExercise(payload);
      }
      setShowModal(false);
      fetchExercises();
    } catch(e) {
      console.error(e);
      alert("Failed to save exercise.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this exercise?")) return;
    try {
      await api.deleteAdminExercise(id);
      fetchExercises();
    } catch(e) {
      console.error(e);
      alert("Failed to delete exercise.");
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            placeholder="Search exercises..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-rose-500/20 text-sm font-medium"
          />
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors w-full md:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          Add Exercise
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
              <th className="p-4 pl-6">Exercise</th>
              <th className="p-4">Details</th>
              <th className="p-4">Target</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-right pr-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {loading ? (
              <tr><td colSpan="5" className="p-8 text-center text-gray-400 font-medium">Loading exercises...</td></tr>
            ) : exercises.length === 0 ? (
              <tr><td colSpan="5" className="p-8 text-center text-gray-400 font-medium">No exercises found. Create one!</td></tr>
            ) : (
              exercises.map(ex => (
                <tr key={ex.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                        <Dumbbell className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">{ex.title}</div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md inline-block">
                          {ex.difficulty}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        {ex.duration_seconds}s
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                        {ex.calories_burn} kcal
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {(ex.muscle_groups || []).slice(0, 3).map((m, i) => (
                        <span key={i} className="text-[10px] font-bold px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 rounded-md whitespace-nowrap">
                          {m}
                        </span>
                      ))}
                      {(ex.muscle_groups?.length > 3) && (
                        <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 rounded-md">
                          +{ex.muscle_groups.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    {ex.status === 'Published' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Published
                      </span>
                    ) : ex.status === 'Archived' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold">
                        <Archive className="w-3.5 h-3.5" /> Archived
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-700 text-xs font-bold">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleOpenModal(ex)} className="p-2 text-gray-400 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 dark:bg-blue-900/30 dark:hover:bg-blue-900/30 dark:bg-blue-900/30 dark:hover:bg-blue-900/30 dark:bg-blue-900/30 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(ex.id)} className="p-2 text-gray-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400 dark:text-red-400 dark:hover:text-red-400 dark:text-red-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 dark:hover:bg-red-900/30 dark:bg-red-900/30 dark:hover:bg-red-900/30 dark:bg-red-900/30 rounded-lg transition-colors">
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
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 md:p-8">
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6">
                {editingId ? 'Edit Exercise' : 'Create Exercise'}
              </h2>

              <form onSubmit={handleSave} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Title</label>
                    <input 
                      type="text" required
                      value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-rose-500/20"
                      placeholder="e.g. Barbell Squat"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Description</label>
                    <textarea 
                      rows="3"
                      value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-rose-500/20 resize-none"
                      placeholder="Instructions..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Difficulty</label>
                    <CustomSelect
                      value={formData.difficulty}
                      onChange={e => setFormData({...formData, difficulty: e.target.value})}
                      options={[
                        { value: "Beginner", label: "Beginner" },
                        { value: "Intermediate", label: "Intermediate" },
                        { value: "Advanced", label: "Advanced" }
                      ]}
                      className="bg-gray-50 dark:bg-gray-900 border-none font-bold py-[10px]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Status</label>
                    <CustomSelect
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      options={[
                        { value: "Draft", label: "Draft" },
                        { value: "Published", label: "Published" },
                        { value: "Archived", label: "Archived" }
                      ]}
                      className="bg-gray-50 dark:bg-gray-900 border-none font-bold py-[10px]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Duration (seconds)</label>
                    <input 
                      type="number" required min="1"
                      value={formData.duration_seconds} onChange={e => setFormData({...formData, duration_seconds: parseInt(e.target.value) || 0})}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Calories Burned</label>
                    <input 
                      type="number" required min="1"
                      value={formData.calories_burn} onChange={e => setFormData({...formData, calories_burn: parseInt(e.target.value) || 0})}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Muscle Groups (comma separated)</label>
                    <input 
                      type="text" 
                      value={formData.muscle_groups} onChange={e => setFormData({...formData, muscle_groups: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-rose-500/20"
                      placeholder="Quads, Glutes, Hamstrings"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Equipment (comma separated)</label>
                    <input 
                      type="text" 
                      value={formData.equipment} onChange={e => setFormData({...formData, equipment: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-rose-500/20"
                      placeholder="Barbell, Squat Rack"
                    />
                  </div>
                  
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Categories (comma separated)</label>
                    <input 
                      type="text" 
                      value={formData.categories} onChange={e => setFormData({...formData, categories: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-rose-500/20"
                      placeholder="Strength, Powerlifting"
                    />
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
                    Save Exercise
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
