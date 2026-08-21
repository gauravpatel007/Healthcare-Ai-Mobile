import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Loader2, Camera, Calendar, User, Activity, X, Filter, Mail, ChevronDown } from 'lucide-react';
import API from '../../utils/api';
import CustomSelect from '../../components/ui/CustomSelect';

export default function AdminScannedMeals() {
  const [scannedMeals, setScannedMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(16);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    date: '',
    email: '',
    minCalories: '',
    maxCalories: '',
    minProtein: '',
    maxProtein: '',
    sortBy: 'newest'
  });

  const toggleExpand = (id) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedIds(newSet);
  };

  useEffect(() => {
    fetchScannedMeals();
  }, []);

  const fetchScannedMeals = async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/diet/scanned-meals');
      setScannedMeals(res);
    } catch (error) {
      console.error("Failed to fetch scanned meals", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMeals = scannedMeals.filter(meal => {
    const matchSearch = meal.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meal.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meal.user_email?.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;

    if (filters.date) {
      const mealDate = new Date(meal.recorded_at).toISOString().split('T')[0];
      if (mealDate !== filters.date) return false;
    }
    if (filters.email && !meal.user_email?.toLowerCase().includes(filters.email.toLowerCase())) {
      return false;
    }
    if (filters.minCalories && meal.calories < parseInt(filters.minCalories)) return false;
    if (filters.maxCalories && meal.calories > parseInt(filters.maxCalories)) return false;
    if (filters.minProtein && meal.protein < parseInt(filters.minProtein)) return false;
    if (filters.maxProtein && meal.protein > parseInt(filters.maxProtein)) return false;

    return true;
  }).sort((a, b) => {
    switch (filters.sortBy) {
      case 'newest': return new Date(b.recorded_at) - new Date(a.recorded_at);
      case 'oldest': return new Date(a.recorded_at) - new Date(b.recorded_at);
      case 'highest_cal': return (b.calories || 0) - (a.calories || 0);
      case 'lowest_cal': return (a.calories || 0) - (b.calories || 0);
      case 'highest_pro': return (b.protein || 0) - (a.protein || 0);
      case 'lowest_pro': return (a.protein || 0) - (b.protein || 0);
      case 'alphabetically': return (a.name || '').localeCompare(b.name || '');
      default: return 0;
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Full Screen Image Modal */}
      {selectedImage && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={selectedImage}
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300"
            alt="Enlarged meal"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
      {/* Search and Filter Bar */}
      <div className="flex gap-4 h-[60px]">
        <div className="bg-white dark:bg-gray-800 px-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex-1 flex items-center transition-all focus-within:border-indigo-500/50 dark:focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10 h-full">
          <Search className="w-5 h-5 text-gray-400 mr-3 shrink-0" />
          <input
            type="text"
            placeholder="Search scanned meals by name, user, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 w-full h-full"
          />
        </div>
        <button
          onClick={() => setShowFilterModal(true)}
          className="bg-white dark:bg-gray-800 px-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center shrink-0 text-indigo-500 h-full focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50"
          title="Filters & Sort"
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Filter Modal */}
      {showFilterModal && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowFilterModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg shadow-2xl border border-gray-100 dark:border-gray-700 p-6 animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Filter className="w-6 h-6 text-indigo-500" />
                Filter & Sort Meals
              </h3>
              <button onClick={() => setShowFilterModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 pr-2">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sort By</label>
                <CustomSelect
                  value={filters.sortBy}
                  onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                  options={[
                    { value: "newest", label: "Newest First" },
                    { value: "oldest", label: "Oldest First" },
                    { value: "highest_cal", label: "Highest Calories" },
                    { value: "lowest_cal", label: "Lowest Calories" },
                    { value: "highest_pro", label: "Highest Protein" },
                    { value: "lowest_pro", label: "Lowest Protein" },
                    { value: "alphabetically", label: "Alphabetically (A-Z)" }
                  ]}
                  className="!bg-gray-50 dark:!bg-gray-900 border border-gray-200 dark:border-gray-700 !font-normal !py-3 !shadow-none !text-gray-700 dark:!text-gray-200 !text-base"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Date</label>
                <input
                  type="date"
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none text-gray-700 dark:text-gray-200"
                  value={filters.date}
                  onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email</label>
                <input
                  type="email"
                  placeholder="Filter by user email"
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none text-gray-700 dark:text-gray-200"
                  value={filters.email}
                  onChange={(e) => setFilters({ ...filters, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Min Calories</label>
                  <input type="number" placeholder="e.g. 100" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none" value={filters.minCalories} onChange={(e) => setFilters({ ...filters, minCalories: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Max Calories</label>
                  <input type="number" placeholder="e.g. 500" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none" value={filters.maxCalories} onChange={(e) => setFilters({ ...filters, maxCalories: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Min Protein (g)</label>
                  <input type="number" placeholder="e.g. 10" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none" value={filters.minProtein} onChange={(e) => setFilters({ ...filters, minProtein: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Max Protein (g)</label>
                  <input type="number" placeholder="e.g. 50" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none" value={filters.maxProtein} onChange={(e) => setFilters({ ...filters, maxProtein: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setFilters({ date: '', email: '', minCalories: '', maxCalories: '', minProtein: '', maxProtein: '', sortBy: 'newest' })}
                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl font-bold transition-colors"
              >
                Clear Filters
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : filteredMeals.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
          <div className="bg-purple-50 dark:bg-gray-700 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Camera className="w-10 h-10 text-purple-500 dark:text-purple-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Scanned Meals Found</h3>
          <p className="text-gray-500 dark:text-gray-400">Users haven't scanned any meals yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredMeals.slice(0, displayCount).map((meal) => (
              <div key={meal.id} className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 group flex flex-col">
                <div className="h-48 w-full relative overflow-hidden bg-gray-100 dark:bg-gray-900">
                  {meal.image_url ? (
                    <img
                      src={API.getMediaUrl(meal.image_url)}
                      alt={meal.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                      onClick={() => setSelectedImage(API.getMediaUrl(meal.image_url))}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera className="w-12 h-12 text-gray-300 dark:text-gray-700" />
                    </div>
                  )}
                  <div className="absolute top-4 right-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-gray-700 dark:text-gray-300 shadow-sm border border-white/20 uppercase tracking-wider">
                    {meal.meal_type || 'Scanned Snack'}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <h3
                    className={`font-bold text-lg text-gray-900 dark:text-white mb-3 cursor-pointer transition-all ${expandedIds.has(meal.id) ? '' : 'line-clamp-1'}`}
                    onClick={() => toggleExpand(meal.id)}
                    title={expandedIds.has(meal.id) ? "Click to collapse" : "Click to expand"}
                  >
                    {meal.name}
                  </h3>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-2xl flex items-center gap-2">
                      <Activity className="w-4 h-4 text-orange-500" />
                      <div>
                        <div className="text-[10px] font-bold text-orange-500/70 uppercase">Calories</div>
                        <div className="font-bold text-orange-600 dark:text-orange-400 text-sm">{meal.calories} kcal</div>
                      </div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center font-bold text-blue-500 text-xs">P</div>
                      <div>
                        <div className="text-[10px] font-bold text-blue-500/70 uppercase">Protein</div>
                        <div className="font-bold text-blue-600 dark:text-blue-400 text-sm">{meal.protein}g</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700/50 space-y-2">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400" title={meal.user_email}>
                      <Mail className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                      <span className="truncate">{meal.user_email || 'No email provided'}</span>
                    </div>
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-500">
                      <Calendar className="w-4 h-4 mr-2 opacity-70" />
                      {new Date(meal.recorded_at).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {filteredMeals.length > displayCount && (
            <div className="p-4 mt-4 flex justify-center">
              <button
                onClick={() => setDisplayCount(prev => prev + 20)}
                className="px-6 py-3 text-sm font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 rounded-xl transition-colors"
              >
                See More ({filteredMeals.length - displayCount} more)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
