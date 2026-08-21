import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUnit } from '../contexts/UnitContext';

const MedicalIDCard = () => {
  const [data, setData] = useState(null);
  const { displayHeight, displayWeight } = useUnit();

  useEffect(() => {
    const offlineData = localStorage.getItem('offline_medical_id');
    if (offlineData) {
      setData(JSON.parse(offlineData));
    }
  }, []);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <div className="text-4xl mb-4">⚕️</div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">No Medical ID Found</h2>
        <p className="text-slate-500 mb-6">Log in to the app at least once to securely cache your emergency medical ID.</p>
        <Link to="/" className="bg-blue-600 text-white px-6 py-2.5 rounded-full font-semibold">Return Home</Link>
      </div>
    );
  }

  const { profile, contacts } = data;

  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-8 font-sans">
      {/* Changed max-w-2xl to max-w-4xl to stretch the card wider */}
      <div className="max-w-4xl mx-auto w-full">

        <div className="flex justify-between items-center mb-6">
          <Link to="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold no-underline">
            <span className="material-symbols-outlined">arrow_back</span>
            Back
          </Link>
          <div className="flex items-center gap-2 text-red-600 font-bold bg-red-100 px-4 py-1.5 rounded-full">
            <span className="material-symbols-outlined text-lg">medical_services</span>
            EMERGENCY MEDICAL ID
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-red-100">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-rose-500 p-8 sm:p-12 text-white relative">
            <div className="absolute top-0 right-0 p-8 opacity-20">
              <span className="material-symbols-outlined text-9xl">health_and_safety</span>
            </div>
            <div className="relative z-10 flex items-center gap-8">
              <div className="w-28 h-28 bg-white rounded-2xl flex items-center justify-center text-5xl shadow-inner text-slate-800 overflow-hidden">
                {profile.avatar || profile.avatar_url ? (
                  <img src={(profile.avatar || profile.avatar_url).startsWith('http') ? (profile.avatar || profile.avatar_url) : `http://localhost:8000${profile.avatar || profile.avatar_url}`} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span>👤</span>
                )}
              </div>
              <div>
                <h1 className="text-4xl font-bold m-0">{profile.name}</h1>
                <div className="flex gap-3 mt-3 text-red-100 font-medium text-xl">
                  <span>{profile.age ? `${profile.age} yrs` : ''}</span>
                  <span>•</span>
                  <span>{profile.gender}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Vitals Grid - Expanded to 4 columns on large screens to use the extra width well */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-8 border-b border-slate-100 bg-slate-50/50">
            <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
              <div className="text-red-800 text-xs font-bold uppercase tracking-wider mb-1">Blood Type</div>
              <div className="text-2xl font-black text-red-600">{profile.blood_type || '--'}</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Organ Donor</div>
              <div className="text-xl font-bold text-slate-800">{profile.organ_donor ? 'Yes 💚' : 'No'}</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Height</div>
              <div className="text-xl font-bold text-slate-800">{profile.height ? `${displayHeight(profile.height).value} ${displayHeight(profile.height).label}` : '--'}</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Weight</div>
              <div className="text-xl font-bold text-slate-800">{profile.weight ? `${displayWeight(profile.weight).value} ${displayWeight(profile.weight).label}` : '--'}</div>
            </div>
          </div>

          {/* Details Section */}
          <div className="p-8">

            {/* Allergies */}
            <div className="mb-8">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-rose-500">warning</span>
                Allergies & Reactions
              </h3>
              {profile.allergies && profile.allergies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.allergies.map((a, i) => (
                    <span key={i} className="bg-white border border-slate-200 text-slate-800 px-4 py-2 rounded-xl text-sm font-bold">{a}</span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No known allergies</p>
              )}
            </div>

            {/* Conditions */}
            <div className="mb-8">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-blue-500">healing</span>
                Medical Conditions
              </h3>
              {profile.conditions && profile.conditions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.conditions.map((c, i) => (
                    <span key={i} className="bg-blue-50 text-blue-800 px-4 py-2 rounded-xl text-sm font-bold">{c}</span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No existing conditions</p>
              )}
            </div>

            {/* Emergency Contacts */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-emerald-500">contact_phone</span>
                Emergency Contacts
              </h3>
              {contacts && contacts.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {contacts.map((contact, i) => (
                    <div key={i} className="flex justify-between items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 truncate">{contact.name}</div>
                        <div className="text-slate-500 text-sm truncate">{contact.relation}</div>
                      </div>
                      <a href={`tel:${contact.phone}`} className="flex-shrink-0 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold transition-colors no-underline">
                        <span className="material-symbols-outlined text-sm">call</span>
                        {contact.phone}
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No emergency contacts listed.</p>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicalIDCard;
