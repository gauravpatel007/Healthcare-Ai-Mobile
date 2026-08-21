import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Filter, Shield, User, Users, Trash2, Power, UserPlus, X,
  Edit3, Key, Mail, Phone, LogIn, Download, FileText, Ban,
  RotateCcw, CheckCircle, AlertTriangle, Eye, ChevronRight
} from 'lucide-react';
import API from '../../utils/api';
import { useUnit } from '../../contexts/UnitContext';
import CustomSelect from '../../components/ui/CustomSelect';

/* ─── Status Badge ───────────────────────────────────────────── */
const StatusBadge = ({ user }) => {
  if (user.is_deleted) return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">Banned</span>;
  if (!user.is_active) return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">Suspended</span>;
  return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:text-emerald-400">Active</span>;
};

/* ─── User Detail Drawer ─────────────────────────────────────── */
const UserDrawer = ({ userId, onClose, onRefresh }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [actionMsg, setActionMsg] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const { displayHeight, displayWeight } = useUnit();

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const data = await API.getAdminUserDetail(userId);
      setDetail(data);
      setEditData(data.profile || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetail(); }, [userId]);

  const showMsg = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3000); };

  const doAction = async (fn, msg) => {
    try { await fn(); showMsg(msg); fetchDetail(); onRefresh(); } catch (e) { alert(e.message); }
  };

  const handleSaveProfile = async () => {
    await doAction(() => API.updateAdminUserProfile(userId, editData), '✅ Profile updated');
    setEditing(false);
  };

  const handleResetPassword = async () => {
    setResetting(true);
    try {
      await API.resetUserPassword(userId);
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    } catch (e) {
      alert(e.message);
    } finally {
      setResetting(false);
    }
  };

  const handleLoginAs = async () => {
    try {
      const res = await API.loginAsUser(userId);
      // Open new tab with token
      const url = `${window.location.origin}/app`;
      const win = window.open('about:blank', '_blank');
      // Instead, set in our own localStorage and redirect
      localStorage.setItem('_admin_impersonate_token', res.access_token);
      localStorage.setItem('_admin_impersonate_refresh', res.refresh_token);
      win.location.href = url + '?impersonate=1';
      showMsg('👤 Opened user session in new tab');
    } catch (e) { alert(e.message); }
  };

  const handleExport = async () => {
    try {
      const data = await API.exportUserData(userId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `user_${userId}_export.json`; a.click();
      showMsg('📥 Data exported');
    } catch (e) { alert(e.message); }
  };

  const handleMedicalHistory = async () => {
    try {
      const data = await API.downloadUserMedicalHistory(userId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `user_${userId}_medical_history.json`; a.click();
      showMsg('📋 Medical history downloaded');
    } catch (e) { alert(e.message); }
  };

  if (loading || !detail) {
    return createPortal(
      <div className="fixed inset-0 z-[100000] flex">
        <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose}></div>
        <div className="w-[520px] bg-white dark:bg-gray-800 dark:bg-gray-800 h-full shadow-2xl flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>,
      document.body
    );
  }

  const p = detail.profile || {};
  const ec = detail.emergency_contact;

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose}></div>
      <div className="w-[520px] bg-white dark:bg-gray-800 dark:bg-gray-800 h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300 relative">

        {/* Success Overlay */}
        {resetSuccess && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-800/80 dark:bg-gray-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 p-8 rounded-3xl shadow-xl flex flex-col items-center text-center max-w-[320px] animate-in zoom-in-95 duration-500 border border-emerald-100 dark:border-emerald-900/30">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-5 shadow-inner">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">Password Reset!</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                A secure new password has been generated and emailed to the user.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800/95 dark:bg-gray-800/95 backdrop-blur-md z-10 p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">User Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-700 rounded-xl transition-colors"><X className="w-5 h-5 text-gray-500 dark:text-gray-400" /></button>
        </div>

        {/* Action message */}
        {actionMsg && (
          <div className="mx-6 mt-4 p-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-sm animate-in fade-in">{actionMsg}</div>
        )}

        <div className="p-6 space-y-6">

          {/* ── Profile Card ─────────────────────────────────── */}
          <div className="flex items-center gap-4">
            {p.avatar_url ? (
              <img src={`http://localhost:8000${p.avatar_url}`} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-gray-100 dark:border-gray-700 shadow-sm" />
            ) : (
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-extrabold text-lg ${detail.role === 'admin' ? 'bg-rose-100 text-rose-600' : detail.role === 'doctor' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                {((p.name && p.name !== 'User') ? p.name : detail.email).substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">{(p.name && p.name !== 'User') ? p.name : detail.email.split('@')[0]}</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{detail.email}</p>
              <div className="flex gap-2 mt-1">
                <StatusBadge user={detail} />
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${detail.role === 'admin' ? 'bg-rose-100 text-rose-700' : detail.role === 'doctor' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {detail.role.charAt(0).toUpperCase() + detail.role.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Info Grid ────────────────────────────────────── */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-extrabold text-gray-900 dark:text-white text-sm">Profile Information</h4>
              <button onClick={() => setEditing(!editing)} className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                <Edit3 className="w-3.5 h-3.5" /> {editing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {editing ? (
              <form onSubmit={handleSaveProfile} className="space-y-3">

                {/* Name */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 w-24 shrink-0">Name</label>
                  <input
                    type="text" required pattern="[A-Za-z\s\-]+" title="Only alphabets and spaces are allowed"
                    value={editData.name || ''}
                    onChange={e => setEditData({ ...editData, name: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Phone */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 w-24 shrink-0">Phone</label>
                  <input
                    type="tel" pattern="[\d\+\s\-]+" title="Only numbers are allowed"
                    value={editData.phone || ''}
                    onChange={e => setEditData({ ...editData, phone: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Age */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 w-24 shrink-0">Age</label>
                  <input
                    type="number" min="0" max="150"
                    value={editData.age || ''}
                    onChange={e => setEditData({ ...editData, age: Number(e.target.value) })}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Gender */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 w-24 shrink-0">Gender</label>
                  <CustomSelect
                    value={editData.gender || ''}
                    onChange={e => setEditData({ ...editData, gender: e.target.value })}
                    options={[
                      { value: "", label: "Select Gender" },
                      { value: "Male", label: "Male" },
                      { value: "Female", label: "Female" },
                      { value: "Other", label: "Other" }
                    ]}
                    className="flex-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-sm font-medium py-[8px]"
                  />
                </div>

                {/* Height */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 w-24 shrink-0">Height (cm)</label>
                  <input
                    type="number" min="0" max="300"
                    value={editData.height || ''}
                    onChange={e => setEditData({ ...editData, height: Number(e.target.value) })}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Weight */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 w-24 shrink-0">Weight (kg)</label>
                  <input
                    type="number" min="0" max="500"
                    value={editData.weight || ''}
                    onChange={e => setEditData({ ...editData, weight: Number(e.target.value) })}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Blood Group */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 w-24 shrink-0">Blood Group</label>
                  <CustomSelect
                    value={editData.blood_type || ''}
                    onChange={e => setEditData({ ...editData, blood_type: e.target.value })}
                    options={[
                      { value: "", label: "Select Blood Group" },
                      { value: "A+", label: "A+" },
                      { value: "A-", label: "A-" },
                      { value: "B+", label: "B+" },
                      { value: "B-", label: "B-" },
                      { value: "O+", label: "O+" },
                      { value: "O-", label: "O-" },
                      { value: "AB+", label: "AB+" },
                      { value: "AB-", label: "AB-" }
                    ]}
                    className="flex-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-sm font-medium py-[8px]"
                  />
                </div>

                <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg mt-2">
                  Save Changes
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                {[
                  ['Phone', p.phone || '—'],
                  ['Age', p.age || '—'],
                  ['Gender', p.gender || '—'],
                  ['Height', p.height ? `${displayHeight(p.height).value} ${displayHeight(p.height).label}` : '—'],
                  ['Weight', p.weight ? `${displayWeight(p.weight).value} ${displayWeight(p.weight).label}` : '—'],
                  ['BMI', p.bmi || '—'],
                  ['Blood Group', p.blood_type || '—'],
                  ['Join Date', detail.created_at ? new Date(detail.created_at).toLocaleDateString() : '—'],
                  ['Last Login', detail.last_login ? new Date(detail.last_login).toLocaleString() : 'Never'],
                  ['Login Count', detail.login_count || 0],
                ].map(([label, val]) => (
                  <div key={label}>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                    <p className="font-bold text-gray-800 dark:text-gray-300 mt-0.5">{val}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Emergency Contact ─────────────────────────────── */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-5">
            <h4 className="font-extrabold text-gray-900 dark:text-white text-sm mb-3">Emergency Contact</h4>
            {ec ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-xs font-bold text-gray-400">Name</span><p className="font-bold text-gray-800 dark:text-gray-300">{ec.name}</p></div>
                <div><span className="text-xs font-bold text-gray-400">Phone</span><p className="font-bold text-gray-800 dark:text-gray-300">{ec.phone}</p></div>
                <div><span className="text-xs font-bold text-gray-400">Relation</span><p className="font-bold text-gray-800 dark:text-gray-300">{ec.relation || '—'}</p></div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm font-medium">No emergency contact set.</p>
            )}
          </div>


          {/* ── Actions ───────────────────────────────────────── */}
          <div className="space-y-2">
            <h4 className="font-extrabold text-gray-900 dark:text-white text-sm mb-2">Account Actions</h4>

            {/* Status actions */}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => doAction(() => API.activateUser(userId), '✅ Activated')} className="flex flex-col items-center gap-1 p-3 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 rounded-xl transition-colors">
                <Power className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Activate</span>
              </button>
              <button onClick={() => doAction(() => API.suspendUser(userId), '⚠️ Suspended')} className="flex flex-col items-center gap-1 p-3 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 rounded-xl transition-colors">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-bold text-amber-700">Suspend</span>
              </button>
              <button onClick={() => doAction(() => API.banUser(userId), '🚫 Banned')} className="flex flex-col items-center gap-1 p-3 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 rounded-xl transition-colors">
                <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span className="text-xs font-bold text-rose-700">Ban</span>
              </button>
            </div>

            {/* More actions */}
            <button onClick={handleResetPassword} disabled={resetting} className="w-full flex items-center justify-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:bg-gray-700 disabled:opacity-50 rounded-xl transition-colors text-sm font-bold text-gray-700 dark:text-gray-300 mt-2 mb-2">
              {resetting ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div> : <Key className="w-4 h-4" />}
              {resetting ? 'Resetting...' : 'Reset Password'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleLoginAs} className="flex items-center justify-center gap-2 p-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors text-sm font-bold text-indigo-700">
                <LogIn className="w-4 h-4" /> Login as User
              </button>
              <button onClick={() => doAction(() => API.changeUserRole(userId, detail.role === 'admin' ? 'patient' : 'admin'), '👑 Role changed')} className="flex items-center justify-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 rounded-xl transition-colors text-sm font-bold text-amber-700">
                <Shield className="w-4 h-4" /> Make {detail.role === 'admin' ? 'Patient' : 'Admin'}
              </button>
            </div>

            {/* Export actions */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleExport} className="flex items-center justify-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 rounded-xl transition-colors text-sm font-bold text-blue-700">
                <Download className="w-4 h-4" /> Export Data
              </button>
              <button onClick={handleMedicalHistory} className="flex items-center justify-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 rounded-xl transition-colors text-sm font-bold text-blue-700">
                <FileText className="w-4 h-4" /> Medical History
              </button>
            </div>

            {/* Danger zone */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700 mt-4">
              <button
                onClick={async () => {
                  if (window.confirm('⚠️ This will PERMANENTLY delete this user and all their data. Continue?')) {
                    try { await API.deleteAdminUser(userId); onRefresh(); onClose(); } catch (e) { alert(e.message); }
                  }
                }}
                className="w-full flex items-center justify-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 rounded-xl transition-colors text-sm font-bold text-rose-600 dark:text-rose-400"
              >
                <Trash2 className="w-4 h-4" /> Permanently Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};


/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'patient' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [displayCount, setDisplayCount] = useState(15);
  const [showPassword, setShowPassword] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await API.getAdminUsers();
      setUsers(data);
    } catch (error) {
      console.error("Failed to fetch admin users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await API.addAdminUser(newUser);
      await fetchUsers();
      setShowAddModal(false);
      setNewUser({ name: '', email: '', password: '', role: 'patient' });
    } catch (error) {
      alert("Failed to add user: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(search.toLowerCase()));
    const matchesRole = roleFilter === 'All' || u.role === roleFilter.toLowerCase();
    const matchesStatus = statusFilter === 'All' ||
      (statusFilter === 'Active' ? (u.is_active && !u.is_deleted) : false) ||
      (statusFilter === 'Suspended' ? (!u.is_active && !u.is_deleted) : false) ||
      (statusFilter === 'Banned' ? u.is_deleted : false);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const cycleRole = () => {
    const roles = ['All', 'Patient', 'Admin'];
    setRoleFilter(roles[(roles.indexOf(roleFilter) + 1) % roles.length]);
  };

  const cycleStatus = () => {
    const statuses = ['All', 'Active', 'Suspended', 'Banned'];
    setStatusFilter(statuses[(statuses.indexOf(statusFilter) + 1) % statuses.length]);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-visible w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Users className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              User Management
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              Manage patients, doctors, and system administrators.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 relative z-10 shrink-0 ml-auto pr-2 flex-wrap">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            <UserPlus className="w-5 h-5" /> Add User
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50/50 dark:bg-gray-700/30 dark:bg-gray-700/20">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none transition-all dark:text-white"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={cycleRole} className="flex items-center px-4 py-3 bg-white dark:bg-gray-800 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 transition-colors">
              <Filter className="w-4 h-4 mr-2 text-indigo-500" />
              {roleFilter === 'All' ? 'Role' : roleFilter}
            </button>
            <button onClick={cycleStatus} className="flex items-center px-4 py-3 bg-white dark:bg-gray-800 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 transition-colors">
              <Filter className="w-4 h-4 mr-2 text-indigo-500" />
              {statusFilter === 'All' ? 'Status' : statusFilter}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">User</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Role</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Status</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Logins</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Last Login</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Joined</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 font-medium">No users found</td>
                  </tr>
                ) : filteredUsers.slice(0, displayCount).map((user) => (
                  <tr key={user.id} onClick={() => setSelectedUserId(user.id)} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <img src={`http://localhost:8000${user.avatar_url}`} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-gray-800 shadow-sm" />
                        ) : (
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${user.role === 'admin' ? 'bg-rose-100 text-rose-600' : user.role === 'doctor' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                            {user.name ? user.name.substring(0, 2).toUpperCase() : 'U'}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{user.name}</p>
                          <p className="text-gray-500 dark:text-gray-400 text-xs font-medium mt-0.5">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${user.role === 'admin' ? 'bg-rose-100 text-rose-700' :
                        user.role === 'doctor' ? 'bg-purple-100 text-purple-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                        {user.role === 'doctor' || user.role === 'admin' ? <Shield className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4"><StatusBadge user={user} /></td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-bold text-sm">{user.login_count || 0}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-medium text-xs">
                      {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-medium text-xs">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-indigo-500 transition-colors inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 font-medium">
          <span>Showing {Math.min(displayCount, filteredUsers.length)} of {users.length} users</span>
          {filteredUsers.length > displayCount && (
            <button
              onClick={() => setDisplayCount(prev => prev + 20)}
              className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              See More ({filteredUsers.length - displayCount} more)
            </button>
          )}
        </div>
      </div>

      {/* ── User Detail Drawer ─────────────────────────────────── */}
      {selectedUserId && (
        <UserDrawer
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onRefresh={fetchUsers}
        />
      )}

      {/* ── Add User Modal ─────────────────────────────────────── */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm px-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-gray-800 dark:bg-gray-800 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Add New User</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input required type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 dark:border-gray-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-gray-900 dark:text-white" placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Password</label>
                <div className="relative">
                  <input required type={showPassword ? "text" : "password"} value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full pl-4 pr-12 py-3 rounded-xl border-2 border-gray-100 dark:border-gray-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-gray-900 dark:text-white" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none">
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <CustomSelect
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                  options={[
                    { value: "patient", label: "Patient" },
                    { value: "admin", label: "Admin" }
                  ]}
                  className="bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 font-bold py-[10px]"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default AdminUsers;
