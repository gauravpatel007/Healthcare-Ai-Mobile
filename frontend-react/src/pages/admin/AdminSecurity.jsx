import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Lock, UserX, LogOut, CheckCircle, XCircle, Search, RefreshCw, Smartphone, Key } from 'lucide-react';
import api from '../../utils/api';
import { usePersistentTab } from '../../hooks/usePersistentTab';

export default function AdminSecurity() {
  const [activeTab, setActiveTab] = usePersistentTab('admin_security', 'logins'); // logins, blocked, policy
  const [logins, setLogins] = useState([]);
  const [displayCountLogins, setDisplayCountLogins] = useState(15);
  const [blockedIps, setBlockedIps] = useState([]);
  const [policy, setPolicy] = useState({
    min_length: 8,
    require_uppercase: true,
    require_numbers: true,
    require_symbols: true,
  });
  const [loading, setLoading] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [newIpReason, setNewIpReason] = useState('');
  const [forceLogoutUserId, setForceLogoutUserId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };
  const showError = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 3000); };

  useEffect(() => {
    if (activeTab === 'logins') fetchLogins();
    if (activeTab === 'blocked') fetchBlockedIps();
    if (activeTab === 'policy') fetchPolicy();
  }, [activeTab]);

  const fetchLogins = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/security/logins');
      setLogins(res.data);
    } catch (error) {
      showError('Failed to fetch logins');
    } finally {
      setLoading(false);
    }
  };

  const fetchBlockedIps = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/security/blocked-ips');
      setBlockedIps(res.data);
    } catch (error) {
      showError('Failed to fetch blocked IPs');
    } finally {
      setLoading(false);
    }
  };

  const fetchPolicy = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/security/policy');
      setPolicy(res.data);
    } catch (error) {
      showError('Failed to fetch password policy');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockIp = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/security/blocked-ips', { ip_address: newIp, reason: newIpReason });
      showSuccess('IP blocked successfully');
      setNewIp('');
      setNewIpReason('');
      fetchBlockedIps();
    } catch (error) {
      showError(error.response?.data?.detail || 'Failed to block IP');
    }
  };

  const handleUnblockIp = async (id) => {
    try {
      await api.delete(`/admin/security/blocked-ips/${id}`);
      showSuccess('IP unblocked successfully');
      fetchBlockedIps();
    } catch (error) {
      showError('Failed to unblock IP');
    }
  };

  const handleForceLogout = async (e) => {
    e.preventDefault();
    if (!forceLogoutUserId) return;
    try {
      await api.post(`/admin/security/force-logout/${forceLogoutUserId}`);
      showSuccess('User session invalidated successfully');
      setForceLogoutUserId('');
    } catch (error) {
      showError(error.response?.data?.detail || 'Failed to force logout');
    }
  };

  const handleUpdatePolicy = async (e) => {
    e.preventDefault();
    try {
      await api.put('/admin/security/policy', policy);
      showSuccess('Password policy updated');
    } catch (error) {
      showError('Failed to update policy');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-visible w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Shield className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              Security Management
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              Monitor access, block threats, and manage policies.
            </p>
          </div>
        </div>
      </div>
      
      {errorMsg && <div className="p-4 bg-red-100 text-red-700 rounded-xl">{errorMsg}</div>}
      {successMsg && <div className="p-4 bg-green-100 text-green-700 rounded-xl">{successMsg}</div>}

      <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-600 dark:border-gray-700">
        <button 
          onClick={() => setActiveTab('logins')}
          className={`pb-4 px-2 font-medium text-sm transition-colors relative ${activeTab === 'logins' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> Login History</div>
          {activeTab === 'logins' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full"></span>}
        </button>
        <button 
          onClick={() => setActiveTab('blocked')}
          className={`pb-4 px-2 font-medium text-sm transition-colors relative ${activeTab === 'blocked' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Access Control</div>
          {activeTab === 'blocked' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full"></span>}
        </button>
        <button 
          onClick={() => setActiveTab('policy')}
          className={`pb-4 px-2 font-medium text-sm transition-colors relative ${activeTab === 'policy' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <div className="flex items-center gap-2"><Lock className="w-4 h-4" /> Password Policy</div>
          {activeTab === 'policy' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full"></span>}
        </button>
      </div>

      {activeTab === 'logins' && (
        <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Logins</h2>
            <button onClick={fetchLogins} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-700 rounded-full transition-colors">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">IP Address</th>
                  <th className="px-6 py-4 font-medium">Device / User Agent</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {logins.slice(0, displayCountLogins).map((login) => (
                  <tr key={login.id} className="hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{login.email}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{login.ip_address}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 max-w-xs truncate" title={login.user_agent}>{login.user_agent}</td>
                    <td className="px-6 py-4">
                      {login.status === 'Success' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle className="w-3.5 h-3.5" /> Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <XCircle className="w-3.5 h-3.5" /> {login.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">
                      {new Date(login.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logins.length > displayCountLogins && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-center bg-gray-50 dark:bg-gray-900 dark:bg-gray-800/50">
                <button
                  onClick={() => setDisplayCountLogins(prev => prev + 20)}
                  className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                >
                  See More ({logins.length - displayCountLogins} more)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'blocked' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500" /> Block IP Address
              </h2>
              <form onSubmit={handleBlockIp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IP Address</label>
                  <input type="text" value={newIp} onChange={(e) => setNewIp(e.target.value)} required placeholder="e.g. 192.168.1.1" className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                  <input type="text" value={newIpReason} onChange={(e) => setNewIpReason(e.target.value)} placeholder="e.g. Malicious activity" className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none" />
                </div>
                <button type="submit" className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors">Block IP</button>
              </form>
            </div>

            <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <LogOut className="w-5 h-5 text-orange-500" /> Force Logout User
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Instantly invalidate all active sessions for a specific user ID.</p>
              <form onSubmit={handleForceLogout} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User ID</label>
                  <input type="text" value={forceLogoutUserId} onChange={(e) => setForceLogoutUserId(e.target.value)} required placeholder="Enter User ID" className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <button type="submit" className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors">Invalidate Sessions</button>
              </form>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Blocked IPs List</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">IP Address</th>
                    <th className="px-6 py-4 font-medium">Reason</th>
                    <th className="px-6 py-4 font-medium">Blocked At</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {blockedIps.map((ip) => (
                    <tr key={ip.id} className="hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{ip.ip_address}</td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{ip.reason || '-'}</td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{new Date(ip.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleUnblockIp(ip.id)} className="text-red-500 hover:text-red-700 font-medium text-sm">Unblock</button>
                      </td>
                    </tr>
                  ))}
                  {blockedIps.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No blocked IPs found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'policy' && (
        <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 max-w-2xl">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-500" /> Global Password Policy
          </h2>
          <form onSubmit={handleUpdatePolicy} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Minimum Length</label>
              <input 
                type="number" min="6" max="32"
                value={policy.min_length} 
                onChange={(e) => setPolicy({...policy, min_length: parseInt(e.target.value)})}
                className="w-full max-w-[150px] px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
              />
            </div>
            
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={policy.require_uppercase}
                  onChange={(e) => setPolicy({...policy, require_uppercase: e.target.checked})}
                  className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                />
                <span className="text-gray-700 dark:text-gray-300">Require Uppercase Letters</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={policy.require_numbers}
                  onChange={(e) => setPolicy({...policy, require_numbers: e.target.checked})}
                  className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                />
                <span className="text-gray-700 dark:text-gray-300">Require Numbers</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={policy.require_symbols}
                  onChange={(e) => setPolicy({...policy, require_symbols: e.target.checked})}
                  className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                />
                <span className="text-gray-700 dark:text-gray-300">Require Special Symbols</span>
              </label>
            </div>
            
            <button type="submit" className="py-2 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors">
              Save Policy
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
