import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { User, Printer, Heart, FileText, Syringe, Phone, Shield, Activity, Lock } from 'lucide-react';
import API from '../utils/api';
import { useUnit } from '../contexts/UnitContext';
import '../index.css';

const SharedProfile = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const { displayWeight, displayHeight } = useUnit();

  useEffect(() => {
    // Force light mode for printing
    const handleBeforePrint = () => {
      if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('was-dark-print');
      }
    };
    const handleAfterPrint = () => {
      if (document.documentElement.classList.contains('was-dark-print')) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('was-dark-print');
      }
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    // Override body styles to remove global dashboard layout constraints
    const originalBodyPadding = document.body.style.padding;
    document.body.style.padding = '0';
    document.body.classList.add('bg-white', 'dark:bg-gray-900');

    // Override layout for public page
    const appContainer = document.querySelector('.app-container');
    const rightPanel = document.querySelector('.right-panel');
    const sidebar = document.querySelector('.sidebar');
    if (appContainer) appContainer.style.display = 'block';
    if (rightPanel) rightPanel.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
    
    // Create standalone wrapper
    const root = document.getElementById('root');
    if (root) {
      root.className = 'bg-white dark:bg-gray-900 print:bg-white';
      root.style.minHeight = '100vh';
      root.style.padding = '0';
      root.style.display = 'flex';
      root.style.justifyContent = 'center';
      root.style.alignItems = 'flex-start';
    }

    const fetchSharedData = async () => {
      try {
        const response = await API.get(`/share/${token}`);
        setData(response);
      } catch (err) {
        setError(err.response?.data?.detail || "This secure link is invalid or has expired.");
      } finally {
        setLoading(false);
      }
    };

    fetchSharedData();

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);

      // Restore body styles
      document.body.style.padding = originalBodyPadding;
      document.body.classList.remove('bg-white', 'dark:bg-gray-900');

      // Restore layout on unmount
      if (appContainer) appContainer.style.display = 'grid';
      if (rightPanel) rightPanel.style.display = 'flex';
      if (sidebar) sidebar.style.display = 'flex';
      if (root) {
        root.className = '';
        root.style.background = '';
        root.style.display = '';
        root.style.justifyContent = '';
        root.style.alignItems = '';
        root.style.padding = '';
      }
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full bg-slate-50 dark:bg-gray-900">
        <div className="w-10 h-10 border-4 border-sky-200 dark:border-sky-900/50 border-t-sky-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 dark:text-slate-400 font-semibold animate-pulse">Decrypting Secure Medical Profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full bg-slate-50 dark:bg-gray-900 p-6">
        <div className="bg-white dark:bg-gray-800 p-10 rounded-[2rem] shadow-xl text-center max-w-md border border-slate-100 dark:border-gray-700">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10" />
          </div>
          <h2 className="text-slate-900 dark:text-white text-2xl font-bold mb-3">Access Denied</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed font-medium">{error}</p>
          <Link to="/" className="inline-block px-8 py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-full transition-colors shadow-md hover:shadow-lg">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const { profile, contacts, records = [], vaccinations = [] } = data;

  return (
    <div className="w-full max-w-4xl mx-auto my-10 px-4 sm:px-6 print:m-0 print:p-0 print:max-w-none text-slate-900 dark:text-slate-100">
      
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-8 rounded-t-[2.5rem] shadow-sm border border-b-0 border-slate-100 dark:border-gray-700 flex items-center justify-between print:bg-white print:border-b print:rounded-none">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
            <Activity className="w-8 h-8 text-sky-500 dark:text-sky-400 print:hidden" />
            Health Summary
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium text-sm">
            Securely shared via <strong className="text-sky-600 dark:text-sky-400">LifeOS</strong> &bull; Generated {new Date().toLocaleDateString()}
          </p>
        </div>
        <button onClick={() => window.print()} className="print:hidden bg-slate-100 hover:bg-slate-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 px-5 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-sm">
          <Printer className="w-4 h-4" />
          Print / PDF
        </button>
      </div>

      {/* Body */}
      <div className="bg-white dark:bg-gray-800 p-8 rounded-b-[2.5rem] shadow-sm border border-t-0 border-slate-100 dark:border-gray-700 print:shadow-none print:p-8">
        
        {/* Core Info */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 mb-6 border-b border-slate-100 dark:border-gray-700">
          <div className="w-24 h-24 bg-sky-50 dark:bg-sky-900/30 text-sky-500 dark:text-sky-400 rounded-3xl flex items-center justify-center shrink-0 shadow-inner overflow-hidden border border-sky-100 dark:border-sky-800/30">
            {profile.avatar ? (
              <img src={profile.avatar.startsWith('http') ? profile.avatar : `http://localhost:8000${profile.avatar}`} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10" />
            )}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-3 tracking-tight">{profile.name || 'Unknown'}</h2>
            <div className="flex flex-wrap justify-center sm:justify-start gap-3 text-slate-500 dark:text-slate-400 font-bold text-base">
              <span>{profile.age ? `${profile.age} years` : 'Age unknown'}</span>
              <span className="text-slate-300 dark:text-gray-600">&bull;</span>
              <span>{profile.gender || 'Gender unknown'}</span>
              <span className="text-slate-300 dark:text-gray-600">&bull;</span>
              <span className="text-red-500 dark:text-red-400">Blood: {profile.blood_type || 'Unknown'}</span>
              <span className="text-slate-300 dark:text-gray-600">&bull;</span>
              <span>{profile.height ? `${displayHeight(profile.height).value} ${displayHeight(profile.height).label}` : 'Height N/A'}</span>
              <span className="text-slate-300 dark:text-gray-600">&bull;</span>
              <span>{profile.weight ? `${displayWeight(profile.weight).value} ${displayWeight(profile.weight).label}` : 'Weight N/A'}</span>
            </div>
          </div>
        </div>

        {/* Medical Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div className="bg-rose-50 dark:bg-rose-900/20 p-6 rounded-3xl border border-rose-100 dark:border-rose-900/50">
            <h3 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2">Allergies</h3>
            <p className="text-lg font-bold text-rose-900 dark:text-rose-200">
              {profile.allergies?.join(', ') || 'None reported'}
            </p>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/50">
            <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">Medical Conditions</h3>
            <p className="text-lg font-bold text-indigo-900 dark:text-indigo-200">
              {profile.conditions?.join(', ') || 'None reported'}
            </p>
          </div>
        </div>

        {/* Recent Medical Records */}
        <div className="mb-8">
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 rounded-2xl flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            Recent Medical Records
          </h3>
          {records.length > 0 ? (
            <div className="space-y-4">
              {records.map((r) => (
                <div key={r.id} className="p-6 rounded-3xl bg-slate-50 dark:bg-gray-800/50 border border-slate-100 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4 mb-4">
                    <div>
                      <h4 className="font-extrabold text-lg text-slate-900 dark:text-white">{r.title}</h4>
                      <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">{r.category} &bull; {r.date}</p>
                    </div>
                    {r.doctor && (
                      <span className="bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 px-4 py-1.5 rounded-full text-xs font-bold shrink-0 self-start">
                        Dr. {r.doctor}
                      </span>
                    )}
                  </div>
                  {r.findings && (
                    <div className="mt-4 p-5 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-slate-200 dark:border-gray-700 text-sm text-slate-700 dark:text-slate-300 font-medium">
                      <strong className="block mb-2 text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">KEY FINDINGS</strong>
                      {r.findings}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 font-medium italic bg-slate-50 dark:bg-gray-800/50 p-6 rounded-3xl">No recent medical records available.</p>
          )}
        </div>

        {/* Vaccinations */}
        <div className="mb-8">
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
              <Syringe className="w-5 h-5" />
            </div>
            Vaccination History
          </h3>
          {vaccinations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {vaccinations.map((v) => (
                <div key={v.id} className="p-5 rounded-3xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                  <h4 className="font-bold text-emerald-800 dark:text-emerald-300 mb-1">{v.name}</h4>
                  <p className="text-emerald-600 dark:text-emerald-500 font-semibold text-sm">{v.date}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 font-medium italic bg-slate-50 dark:bg-gray-800/50 p-6 rounded-3xl">No vaccinations on record.</p>
          )}
        </div>

        {/* Emergency Contacts */}
        <div className="page-break-inside-avoid">
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            Emergency Contacts
          </h3>
          {contacts && contacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contacts.map((contact, i) => (
                <div key={i} className="p-6 rounded-3xl bg-slate-50 dark:bg-gray-800/50 border border-slate-100 dark:border-gray-700 flex justify-between items-center">
                  <div>
                    <h4 className="font-extrabold text-lg text-slate-900 dark:text-white mb-1">{contact.name}</h4>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">{contact.relation}</p>
                  </div>
                  <a href={`tel:${contact.phone}`} className="strict-print-hidden flex items-center justify-center w-12 h-12 bg-sky-500 hover:bg-sky-600 text-white rounded-full transition-colors shadow-md hover:shadow-lg shrink-0">
                    <Phone className="w-5 h-5 fill-current" />
                  </a>
                  <span className="hidden strict-print-block font-bold text-slate-800 text-lg">{contact.phone}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 font-medium italic bg-slate-50 dark:bg-gray-800/50 p-6 rounded-3xl">No emergency contacts listed.</p>
          )}
        </div>

        {/* Organ Donor Status */}
        {profile.organ_donor && (
          <div className="mt-10 bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-3xl border border-emerald-200 dark:border-emerald-900/50 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-500 dark:text-emerald-400 rounded-3xl flex items-center justify-center shrink-0 shadow-inner">
              <Heart className="w-8 h-8 fill-current" />
            </div>
            <div className="flex-1">
              <h4 className="font-extrabold text-emerald-800 dark:text-emerald-300 text-xl mb-2">Registered Organ Donor</h4>
              <p className="text-emerald-700 dark:text-emerald-500 font-medium">This patient is officially registered as an organ donor. Their decision can help save lives.</p>
            </div>
          </div>
        )}

      </div>
      
      <div className="text-center mt-8 mb-12 print:mt-12">
        <p className="text-slate-400 dark:text-slate-500 font-medium text-sm">
          Provided securely by <strong className="text-slate-500 dark:text-slate-400 font-bold">LifeOS</strong> for authorized medical personnel.
        </p>
      </div>
    </div>
  );
};

export default SharedProfile;
