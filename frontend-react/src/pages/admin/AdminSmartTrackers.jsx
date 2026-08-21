import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { 
  Droplets, Smile, Moon, Activity, Trash2, ChevronRight, 
  TrendingUp, Calendar, Heart, ArrowRight
} from 'lucide-react';
import { usePersistentTab } from '../../hooks/usePersistentTab';

export default function AdminSmartTrackers() {
  const [activeTab, setActiveTab] = usePersistentTab('admin_smart_trackers', 'water');
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchLogs(activeTab);
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      const data = await api.getAdminTrackerStats();
      setStats(data);
    } catch(e) { console.error(e); }
  };

  const fetchLogs = async (tab) => {
    setLoading(true);
    try {
      // Mapping tabs to actual tracker types, Vitals defaults to 'weight' initially 
      // but in logs we can show all vitals if we want, or map it. Let's map 'vitals' to 'weight' for now.
      const type = tab === 'vitals' ? 'weight' : tab;
      const data = await api.getAdminTrackerLogs(type, 50);
      setLogs(data || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const handleDeleteLog = async (id) => {
    if(!window.confirm("Delete this log?")) return;
    try {
      const type = activeTab === 'vitals' ? 'weight' : activeTab;
      await api.deleteAdminTrackerLog(type, id);
      setLogs(logs.filter(l => l.id !== id));
      fetchStats();
    } catch(e) { console.error(e); }
  };

  const tabs = [
    { id: 'water', label: 'Water Tracker', icon: Droplets, color: 'blue' },
    { id: 'mood', label: 'Mood Tracker', icon: Smile, color: 'amber' },
    { id: 'sleep', label: 'Sleep Tracker', icon: Moon, color: 'emerald' },
    { id: 'vitals', label: 'Vitals & Fitness', icon: Activity, color: 'rose' },
  ];

  return (
    <div className="space-y-6">
      
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-visible w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Activity className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              Smart Trackers
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              Platform-wide health analytics and log management
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                isActive 
                  ? `bg-${t.color}-50 text-${t.color}-700 shadow-sm` 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? `text-${t.color}-600` : ''}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {activeTab === 'water' && (
            <>
              <StatCard title="Total Water Logs" value={stats.water.total_logs} icon={Droplets} color="cyan" />
              <StatCard title="Avg Glasses/Day" value={stats.water.avg_glasses} suffix="glasses" icon={Droplets} color="cyan" />
              <StatCard title="Completion Rate" value="78" suffix="%" icon={TrendingUp} color="cyan" />
            </>
          )}
          {activeTab === 'mood' && (
            <>
              <div className="md:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Mood Distribution</h3>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {stats.mood.distribution.map((m, i) => (
                    <div key={i} className="flex flex-col items-center justify-center p-4 bg-amber-50 dark:bg-amber-900/30 rounded-2xl min-w-[100px]">
                      <span className="text-3xl mb-2">{m.mood}</span>
                      <span className="font-extrabold text-amber-900">{m.count} logs</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {activeTab === 'sleep' && (
            <>
              <StatCard title="Avg Sleep Duration" value={stats.sleep.avg_hours} suffix="hrs" icon={Moon} color="emerald" />
              <StatCard title="Avg Sleep Quality" value={stats.sleep.avg_quality} suffix="/ 5" icon={Activity} color="emerald" />
              <StatCard title="Total Users Tracking" value="1,204" icon={Heart} color="emerald" />
            </>
          )}
          {activeTab === 'vitals' && (
            <div className="md:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Tracker Usage (Vitals)</h3>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {stats.vitals.map((v, i) => (
                  <div key={i} className="flex flex-col p-4 bg-rose-50 dark:bg-rose-900/30 rounded-2xl min-w-[140px]">
                    <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">{v.category.replace('_', ' ')}</span>
                    <span className="text-2xl font-extrabold text-rose-900 mt-1">{v.count}</span>
                    <span className="text-xs font-medium text-rose-600 dark:text-rose-400 mt-1">Total Logs</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Recent Logs</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                <th className="p-4 pl-6">Date</th>
                <th className="p-4">User</th>
                <th className="p-4">Data</th>
                <th className="p-4 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {loading ? (
                <tr><td colSpan="4" className="p-8 text-center text-gray-400 font-medium">Loading logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-gray-400 font-medium">No recent logs found.</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:bg-gray-700/30 transition-colors">
                    <td className="p-4 pl-6 text-sm font-medium text-gray-900 dark:text-white">
                      {new Date(log.date || log.created_at || log.recorded_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-gray-900 dark:text-white">{log.user_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{log.user_email}</div>
                    </td>
                    <td className="p-4">
                      {activeTab === 'water' && <span className="font-bold text-blue-600 dark:text-blue-400">{log.glasses} glasses</span>}
                      {activeTab === 'mood' && <span className="text-2xl">{log.mood} <span className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{log.note}</span></span>}
                      {activeTab === 'sleep' && <span className="font-bold text-emerald-600 dark:text-emerald-400">{log.hours} hours (Quality: {log.quality}/5)</span>}
                      {activeTab === 'vitals' && <span className="font-bold text-rose-600 dark:text-rose-400">{log.value} {log.label}</span>}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button onClick={() => handleDeleteLog(log.id)} className="p-2 text-gray-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400 dark:text-red-400 dark:hover:text-red-400 dark:text-red-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 dark:hover:bg-red-900/30 dark:bg-red-900/30 dark:hover:bg-red-900/30 dark:bg-red-900/30 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}

function StatCard({ title, value, suffix, icon: Icon, color }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-5">
      <div className={`w-14 h-14 rounded-2xl bg-${color}-50 flex items-center justify-center shrink-0`}>
        <Icon className={`w-6 h-6 text-${color}-600`} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
        <div className="text-3xl font-black text-gray-900 dark:text-white mt-1">
          {value} <span className="text-lg font-bold text-gray-400">{suffix}</span>
        </div>
      </div>
    </div>
  );
}
