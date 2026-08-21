import React, { useState, useEffect } from 'react';
import { ClipboardList, Search, Clock, Monitor, Globe, Filter, User } from 'lucide-react';
import api from '../../utils/api';

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchAction, setSearchAction] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [displayCount, setDisplayCount] = useState(15);

  const showError = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 3000); };

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/audit/logs?limit=100${searchAction ? `&action=${searchAction}` : ''}`);
      setLogs(res.data);
    } catch (error) {
      showError('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const renderDiff = (prev, next) => {
    if (!prev && !next) return <div className="text-gray-500 dark:text-gray-400 italic p-4">No data changes recorded.</div>;
    
    return (
      <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900 rounded-xl p-4 overflow-x-auto text-xs font-mono">
        <div>
          <h4 className="text-red-500 font-bold mb-2">Previous Value</h4>
          <pre className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{prev ? JSON.stringify(prev, null, 2) : 'null'}</pre>
        </div>
        <div>
          <h4 className="text-green-500 font-bold mb-2">New Value</h4>
          <pre className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{next ? JSON.stringify(next, null, 2) : 'null'}</pre>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-visible w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <ClipboardList className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              Audit Logs
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              Track and review all administrative actions across the platform.
            </p>
          </div>
        </div>
      </div>
      
      {errorMsg && <div className="p-4 bg-red-100 text-red-700 rounded-xl mb-4">{errorMsg}</div>}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex gap-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search by action (e.g. 'Update User')" 
              value={searchAction}
              onChange={(e) => setSearchAction(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <button type="submit" className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium transition-colors">
            Search
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto h-[600px] overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-medium">Time</th>
                  <th className="px-6 py-4 font-medium">Admin</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                  <th className="px-6 py-4 font-medium">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {logs.slice(0, displayCount).map((log) => (
                  <tr 
                    key={log.id} 
                    onClick={() => setSelectedLog(log)}
                    className={`cursor-pointer transition-colors ${selectedLog?.id === log.id ? 'bg-teal-50 dark:bg-teal-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                  >
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      <div className="font-bold">{log.admin_name || 'Admin'}</div>
                      <div className="text-xs text-gray-500">{log.admin_email}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-teal-600 dark:text-teal-400">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {log.target_entity_type}: {log.target_entity_id || 'N/A'}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && !loading && (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No logs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {logs.length > displayCount && (
              <div className="p-4 flex justify-center border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                <button
                  onClick={() => setDisplayCount(prev => prev + 20)}
                  className="px-4 py-2 text-sm font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 rounded-lg transition-colors"
                >
                  See More ({logs.length - displayCount} more)
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          {selectedLog ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 sticky top-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Log Details</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                  <User className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-gray-900 dark:text-white block">{selectedLog.admin_name || 'Admin'}</span>
                    <span className="text-xs text-gray-500 block">{selectedLog.admin_email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                  <Monitor className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="truncate" title={selectedLog.device}>{selectedLog.device || 'Unknown Device'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <span>{selectedLog.ip_address || 'Unknown IP'}</span>
                </div>
                {Object.keys(selectedLog.details || {}).length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Extra Details</h4>
                    <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl overflow-x-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Data Diff</h4>
              {renderDiff(selectedLog.previous_value, selectedLog.new_value)}
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-900 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center h-64 text-gray-400 p-6 text-center">
              Select a log entry from the table to view its full details and data diffs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
