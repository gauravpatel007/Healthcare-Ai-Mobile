import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Activity, Loader2, X, Clock, Mail, PhoneCall, Bot, AlertTriangle, Heart, Download, Search } from 'lucide-react';
import API from '../../utils/api';
import { usePersistentTab } from '../../hooks/usePersistentTab';

const AdminHealth = () => {
  const [data, setData] = useState({ appointments: [], emergencies: [], triageLogs: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = usePersistentTab('admin_health', 'emergency');

  // Modals state
  const [showViewAll, setShowViewAll] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState(null); // { id, date, time }
  const [rescheduleData, setRescheduleData] = useState({ date: '', time: '' });

  const [displayCountAppointments, setDisplayCountAppointments] = useState(15);
  const [displayCountEmergencies, setDisplayCountEmergencies] = useState(15);
  const [displayCountTriageLogs, setDisplayCountTriageLogs] = useState(15);
  const [displayCountOrganDonors, setDisplayCountOrganDonors] = useState(15);
  
  const [apptTab, setApptTab] = useState('upcoming'); // 'upcoming' or 'past'
  const [searchAppt, setSearchAppt] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [servicesRes, triageRes] = await Promise.all([
        API.get('/admin/health-services'),
        API.getAdminTriageLogs()
      ]);
      setData({ ...servicesRes, triageLogs: triageRes });
    } catch (err) {
      console.error("Failed to fetch health services data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setDisplayCountAppointments(15);
  }, [apptTab]);

  const formatTimeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const diff = Math.floor((new Date() - date) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff} mins ago`;
    if (diff < 24 * 60) return `${Math.floor(diff/60)} hours ago`;
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return { day: '--', month: '---' };
    const date = new Date(dateStr);
    return {
      day: date.getDate(),
      month: date.toLocaleString('default', { month: 'short' })
    };
  };

  const handleResolveEmergency = async (id) => {
    try {
      await API.put(`/admin/emergencies/${id}/resolve`);
      fetchData(); // refresh
    } catch (err) {
      console.error("Failed to resolve emergency", err);
      alert("Failed to resolve emergency.");
    }
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.put(`/admin/appointments/${rescheduleAppt.id}/reschedule`, {
        date: rescheduleData.date,
        time: rescheduleData.time + ":00" // append seconds if needed
      });
      setRescheduleAppt(null);
      fetchData();
    } catch (err) {
      console.error("Failed to reschedule", err);
      alert("Failed to reschedule appointment.");
    }
  };

  const filteredAppointments = useMemo(() => {
    const now = new Date();
    return data.appointments.filter(appt => {
      // Ensure date exists and parse it. Use end of day if time is not present just to be safe, but we'll try to parse the time.
      const apptDateStr = appt.date + (appt.time ? `T${appt.time}` : 'T00:00:00');
      const apptDate = new Date(apptDateStr);
      
      const isPast = apptDate < now;
      const matchesTab = apptTab === 'past' ? isPast : !isPast;
      const matchesSearch = appt.doctor?.toLowerCase().includes(searchAppt.toLowerCase()) || 
                            appt.user_name?.toLowerCase().includes(searchAppt.toLowerCase()) ||
                            appt.user_email?.toLowerCase().includes(searchAppt.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [data.appointments, apptTab, searchAppt]);

  const handleExportTriageLogs = () => {
    if (!data.triageLogs || data.triageLogs.length === 0) return;
    
    const headers = ['Date', 'User Name', 'User Email', 'Symptom Query', 'AI Urgency', 'Top Match Condition', 'Top Match Probability (%)'];
    const rows = data.triageLogs.map(log => [
      `"${new Date(log.created_at).toLocaleString()}"`,
      `"${(log.user_name || '').replace(/"/g, '""')}"`,
      `"${(log.user_email || '').replace(/"/g, '""')}"`,
      `"${(log.symptom || '').replace(/"/g, '""')}"`,
      `"${log.response?.urgency || ''}"`,
      `"${log.response?.conditions?.[0]?.condition || ''}"`,
      `"${log.response?.conditions?.[0]?.probability || ''}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ai_triage_logs.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && data.appointments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-visible w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Activity className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              Healthcare Services
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              Manage appointments and emergency alerts.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('emergency')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'emergency'
              ? 'bg-red-50 dark:!bg-gray-700 text-red-700 dark:!text-red-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <AlertTriangle className={`w-4 h-4 ${activeTab === 'emergency' ? 'text-red-600 dark:!text-red-400' : ''}`} />
          Active Emergencies
        </button>
        <button
          onClick={() => setActiveTab('appointment')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'appointment'
              ? 'bg-blue-50 dark:!bg-gray-700 text-blue-700 dark:!text-blue-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Calendar className={`w-4 h-4 ${activeTab === 'appointment' ? 'text-blue-600 dark:!text-blue-400' : ''}`} />
          Appointments
        </button>
        <button
          onClick={() => setActiveTab('organ')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'organ'
              ? 'bg-teal-50 dark:!bg-gray-700 text-teal-700 dark:!text-teal-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Heart className={`w-4 h-4 ${activeTab === 'organ' ? 'text-teal-600 dark:!text-teal-400' : ''}`} />
          Organ Donors
        </button>
        <button
          onClick={() => setActiveTab('ai_triage')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'ai_triage'
              ? 'bg-purple-50 dark:!bg-gray-700 text-purple-700 dark:!text-purple-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Bot className={`w-4 h-4 ${activeTab === 'ai_triage' ? 'text-purple-600 dark:!text-purple-400' : ''}`} />
          AI Triage Logs
        </button>
      </div>

      <div>
        
        {/* Appointments Module */}
        {activeTab === 'appointment' && (
        <div className="space-y-4">
          
          <div className="flex flex-wrap gap-2 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 w-fit">
            <button
              onClick={() => setApptTab('upcoming')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                apptTab === 'upcoming'
                  ? 'bg-blue-50 dark:!bg-gray-700 text-blue-700 dark:!text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setApptTab('past')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                apptTab === 'past'
                  ? 'bg-amber-50 dark:!bg-amber-900/30 text-amber-700 dark:!text-amber-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Past
            </button>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <div className="relative w-full mb-6">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                placeholder="Search appointments..."
                value={searchAppt}
                onChange={e => setSearchAppt(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 text-sm font-medium outline-none"
              />
            </div>
            
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {filteredAppointments.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No appointments found.</p>
            ) : (
              filteredAppointments.slice(0, displayCountAppointments).map((appt) => {
                const dateLabel = formatDateLabel(appt.date);
                return (
                  <div key={appt.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-4 truncate">
                      <div className="w-10 h-10 shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/30 flex flex-col items-center justify-center text-blue-600 dark:text-blue-400">
                        <span className="text-xs font-bold leading-none">{dateLabel.day}</span>
                        <span className="text-[10px] uppercase leading-none">{dateLabel.month}</span>
                      </div>
                      <div className="truncate">
                        <p className="font-medium text-gray-900 dark:text-white line-clamp-1">{appt.doctor}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">Patient: {appt.user_name} ({appt.user_email})</p>
                        <p className="text-xs text-gray-400 mt-1 flex items-center"><Clock className="w-3 h-3 mr-1"/> {appt.time} • {appt.reason}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {apptTab === 'upcoming' && (
                        <button onClick={() => setRescheduleAppt(appt)} className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700">Reschedule</button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            {filteredAppointments.length > displayCountAppointments && (
              <div className="p-4 mt-2 flex justify-center">
                <button
                  onClick={() => setDisplayCountAppointments(prev => prev + 20)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    apptTab === 'past' 
                      ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100'
                      : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100'
                  }`}
                >
                  See More ({filteredAppointments.length - displayCountAppointments} more)
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
        )}

        {/* Emergency Alerts Module */}
        {activeTab === 'emergency' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-bl-full -z-10"></div>
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-lg font-bold flex items-center text-red-600 dark:text-red-400">
              <Activity className="w-5 h-5 mr-2" /> Active Emergencies
            </h3>
            {data.emergencies.length > 0 && (
              <span className="bg-red-100 text-red-600 dark:text-red-400 dark:bg-red-900/40 dark:text-red-400 text-xs font-bold px-3 py-1 rounded-full relative">
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75"></span>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
                {data.emergencies.length} Active
              </span>
            )}
          </div>
          
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {data.emergencies.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No active emergencies found.</p>
            ) : (
              data.emergencies.slice(0, displayCountEmergencies).map((sos) => (
                <div key={sos.id} className="p-4 bg-red-50 dark:bg-red-900/30 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-red-800 dark:text-red-300">SOS: {sos.user_name}</h4>
                    <span className="text-xs text-red-500 whitespace-nowrap ml-2 font-medium">{formatTimeAgo(sos.created_at)}</span>
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-400 mb-2">
                    User pressed the emergency button {sos.is_silent ? '(Silent SOS)' : ''}.
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 dark:text-red-500 mb-4 flex gap-3">
                    <span className="flex items-center"><Mail className="w-3 h-3 mr-1"/> {sos.user_email}</span>
                    <span className="flex items-center"><PhoneCall className="w-3 h-3 mr-1"/> {sos.user_phone}</span>
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => window.location.href = `mailto:${sos.user_email}`} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                      Contact User
                    </button>
                    <button onClick={() => handleResolveEmergency(sos.id)} className="flex-1 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 py-2 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 dark:hover:bg-red-900/30 dark:bg-red-900/30 dark:hover:bg-red-900/30 dark:bg-red-900/30 dark:hover:bg-red-900/20 transition-colors">
                      Resolve Alert
                    </button>
                  </div>
                </div>
              ))
            )}
            {data.emergencies.length > displayCountEmergencies && (
              <div className="p-4 mt-2 flex justify-center">
                <button
                  onClick={() => setDisplayCountEmergencies(prev => prev + 20)}
                  className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 rounded-lg transition-colors"
                >
                  See More ({data.emergencies.length - displayCountEmergencies} more)
                </button>
              </div>
            )}
          </div>
        </div>
        )}
      {/* Bottom Grid: AI Triage & Organ Donors */}
        {/* AI Triage Logs Module */}
        {activeTab === 'ai_triage' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-purple-100 dark:border-purple-900/30 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-bl-full -z-10"></div>
        <div className="flex justify-between items-center mb-6">
           <h3 className="text-lg font-bold flex items-center text-purple-600 dark:text-purple-400">
            <Bot className="w-5 h-5 mr-2" /> AI Triage Logs
          </h3>
          <button 
            onClick={handleExportTriageLogs}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors shadow-sm"
            title="Export as CSV/Excel"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
        
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {data.triageLogs?.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No AI triage logs found.</p>
          ) : (
            data.triageLogs?.slice(0, displayCountTriageLogs).map((log) => (
              <div key={log.id} className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2">
                    {log.user_name} 
                    <span className="font-normal text-purple-600 dark:text-purple-400">({log.user_email})</span>
                  </h4>
                  <span className="text-xs text-purple-500 whitespace-nowrap ml-2 font-medium">
                    {formatTimeAgo(log.created_at)}
                  </span>
                </div>
                
                <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                  <p className="mb-2"><span className="font-bold">Symptom Query:</span> "{log.symptom}"</p>
                  
                  {log.response?.urgency && (
                    <p className="mb-1">
                      <span className="font-bold">AI Urgency:</span> 
                      <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${log.response.urgency === 'High' ? 'bg-red-100 text-red-700' : log.response.urgency === 'Medium' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        {log.response.urgency}
                      </span>
                    </p>
                  )}
                  {log.response?.conditions?.length > 0 && (
                    <p>
                      <span className="font-bold">Top Match:</span> {log.response.conditions[0].condition} ({log.response.conditions[0].probability}%)
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
          {data.triageLogs?.length > displayCountTriageLogs && (
            <div className="p-4 mt-2 flex justify-center">
              <button
                onClick={() => setDisplayCountTriageLogs(prev => prev + 20)}
                className="px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 rounded-lg transition-colors"
              >
                See More ({data.triageLogs.length - displayCountTriageLogs} more)
              </button>
            </div>
          )}
        </div>
        </div>
        )}

        {/* Registered Organ Donors Module */}
        {activeTab === 'organ' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-teal-100 dark:border-teal-900/30 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-bl-full -z-10"></div>
        <div className="flex justify-between items-center mb-6">
           <h3 className="text-lg font-bold flex items-center text-teal-600 dark:text-teal-400">
            <Activity className="w-5 h-5 mr-2" /> Registered Organ Donors
          </h3>
        </div>
        
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {!data.organ_donors || data.organ_donors.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No registered organ donors found.</p>
          ) : (
            data.organ_donors.slice(0, displayCountOrganDonors).map((donor) => (
              <div key={donor.id} className="p-4 bg-teal-50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-900/30 rounded-xl flex flex-col justify-start items-start text-left gap-3 w-full">
                <div className="flex flex-col lg:flex-row justify-between items-start w-full gap-3">
                  <div className="flex flex-col items-start text-left">
                    <h4 className="font-bold text-teal-900 dark:text-teal-100 flex items-center justify-start gap-2 text-left">
                      {donor.name} 
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
                        Blood: {donor.blood_type || 'Unknown'}
                      </span>
                    </h4>
                    <p className="text-sm text-teal-700 dark:text-teal-400 mt-1 flex flex-wrap items-center justify-start gap-4 text-left w-full">
                      <span className="flex items-center"><Mail className="w-3 h-3 inline mr-1"/> {donor.email}</span>
                      <span>Age: {donor.age || 'N/A'}</span>
                    </p>
                  </div>
                  {donor.registered_date && (
                    <div className="self-start text-xs font-medium text-teal-600 dark:text-teal-400 bg-white/60 dark:bg-gray-800/60 px-3 py-1 rounded-full border border-teal-100 dark:border-teal-800 shrink-0">
                      Registered: {formatTimeAgo(donor.registered_date)}
                    </div>
                  )}
                </div>
                
                <div className="mt-1 w-full border-t border-teal-200/50 dark:border-teal-800/50 pt-3 flex flex-col items-start">
                  <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-2 text-left w-full">Pledged Organs</p>
                  <div className="flex flex-wrap gap-2 justify-start w-full">
                    {donor.preferences && donor.preferences.length > 0 ? (
                      donor.preferences.map(org => (
                        <span key={org} className="text-xs font-medium px-2.5 py-1 bg-white dark:bg-gray-800 border border-teal-200 dark:border-teal-700 rounded-lg shadow-sm text-gray-700 dark:text-gray-300">
                          {org}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500 italic text-left">General Donor</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {data.organ_donors?.length > displayCountOrganDonors && (
            <div className="p-4 mt-2 flex justify-center">
              <button
                onClick={() => setDisplayCountOrganDonors(prev => prev + 20)}
                className="px-4 py-2 text-sm font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 rounded-lg transition-colors"
              >
                See More ({data.organ_donors.length - displayCountOrganDonors} more)
              </button>
            </div>
          )}
        </div>
        </div>
        )}
      </div>

      {/* Reschedule Modal */}
      {rescheduleAppt && createPortal(
        <div className="fixed inset-0 z-[100000] bg-black/50 flex items-center justify-center p-4" onClick={() => setRescheduleAppt(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setRescheduleAppt(null)} className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-100 dark:bg-gray-700 rounded-full">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-4">Reschedule Appointment</h2>
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              <p><span className="font-bold">Doctor:</span> {rescheduleAppt.doctor}</p>
              <p><span className="font-bold">Patient:</span> {rescheduleAppt.user_name}</p>
              <p><span className="font-bold">Current:</span> {rescheduleAppt.date} at {rescheduleAppt.time}</p>
            </div>
            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">New Date</label>
                <input 
                  type="date" 
                  required
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={rescheduleData.date}
                  onChange={e => setRescheduleData({...rescheduleData, date: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">New Time</label>
                <input 
                  type="time" 
                  required
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={rescheduleData.time}
                  onChange={e => setRescheduleData({...rescheduleData, time: e.target.value})}
                />
              </div>
              <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">
                Confirm Reschedule
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}



    </div>
  );
};

export default AdminHealth;
