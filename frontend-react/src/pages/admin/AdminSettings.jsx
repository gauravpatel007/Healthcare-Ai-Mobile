import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Settings as SettingsIcon, Palette, Image as ImageIcon, 
  Mail, Phone, Globe, ShieldAlert, Link as LinkIcon, Save,
  FileText, Loader2, X, Trash2
} from 'lucide-react';
import api from '../../utils/api';
import { useSettings } from '../../contexts/SettingsContext';
import CustomSelect from '../../components/ui/CustomSelect';

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    support_email: '',
    contact_number: '',
    timezone: 'UTC',
    theme: 'light',
    primary_color: '#2563eb',
    maintenance_mode: 'false',
    privacy_url: '',
    terms_url: '',
    cookie_url: '',
    social_facebook: '',
    social_twitter: '',
    social_instagram: '',
    site_logo: ''
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [viewingLogo, setViewingLogo] = useState(false);
  const fileInputRef = useRef(null);
  const { refreshSettings } = useSettings();

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    const savedLandingTheme = localStorage.getItem('landing_theme');
    if (savedLandingTheme) {
      setSettings(prev => ({ ...prev, theme: savedLandingTheme }));
    }
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminSettings();
      if (res && res.data) {
        // Merge fetched settings with default structure to avoid undefined
        setSettings(prev => ({ ...prev, ...res.data }));
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.updateAdminSettings(settings);
      await refreshSettings();
      alert('Settings saved successfully!');
    } catch (err) {
      console.error("Failed to save settings:", err);
      alert('Error saving settings. Check console.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 'true' : 'false') : value
    }));
  };

  const handleThemeChange = (e) => {
    const newTheme = e.target.value;
    setSettings(prev => ({ ...prev, theme: newTheme }));
    // Write to landing_theme localStorage and fire event for LandingPage
    localStorage.setItem('landing_theme', newTheme);
    window.dispatchEvent(new Event('landing-theme-change'));
  };

  const handleColorSelect = (color) => {
    setSettings(prev => ({ ...prev, primary_color: color }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);
      formData.append('category', 'Images');
      formData.append('type', file.type);
      formData.append('size', file.size);

      const res = await api.uploadAdminFile(formData);
      if (res.file_path) {
        let url = res.file_path;
        if (!url.startsWith('/uploads') && !url.startsWith('http')) {
          url = `/uploads/${url.replace(/^\//, '')}`;
        }
        setSettings(prev => ({ ...prev, site_logo: api.getMediaUrl(url) }));
        setSettings(prev => ({ ...prev, site_logo: url }));
      }
    } catch (err) {
      console.error("Failed to upload logo:", err);
      alert("Error uploading logo");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-visible w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <SettingsIcon className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              System Settings
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              Manage global application settings and preferences.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 relative z-10 shrink-0 ml-auto pr-2 flex-wrap">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} 
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Left Column */}
        <div className="space-y-6">
          {/* General Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-lg font-bold flex items-center mb-6 border-b border-gray-100 dark:border-gray-700 pb-4 text-gray-800 dark:text-gray-300 dark:text-gray-100">
            <SettingsIcon className="w-5 h-5 mr-2 text-blue-500" /> General
          </h3>
          <div className="space-y-4">
            <div className="flex items-center gap-6 mb-6 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50">
              <div 
                className={`relative w-20 h-20 rounded-full overflow-hidden bg-blue-600 text-white flex items-center justify-center text-2xl font-bold border-4 border-white dark:border-slate-800 shadow-sm shrink-0 ${settings.site_logo ? 'cursor-pointer hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 transition-all' : ''}`}
                onClick={() => settings.site_logo && setViewingLogo(true)}
              >
                {settings.site_logo ? (
                  <img src={settings.site_logo} alt="Logo" className="w-full h-full object-cover bg-white dark:bg-gray-800" />
                ) : (
                  'L'
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="font-bold text-lg text-slate-900 dark:text-white">Site Logo</div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Click picture to zoom, or upload new</div>
                
                <div className="flex items-center gap-3">
                  <label className={`inline-flex items-center gap-2 bg-white dark:bg-gray-800 dark:bg-slate-700 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors ${uploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>}
                    Upload Image
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleLogoUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </label>
                  
                  {settings.site_logo && (
                    <button 
                      onClick={() => setSettings(prev => ({ ...prev, site_logo: '' }))}
                      className="inline-flex items-center gap-2 bg-red-50 dark:bg-red-900/30 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-500/30"
                      title="Remove Logo"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Support Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="email" 
                  name="support_email"
                  value={settings.support_email} 
                  onChange={handleChange}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white" 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Contact Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  name="contact_number"
                  value={settings.contact_number} 
                  onChange={handleChange}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white" 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Timezone</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <CustomSelect
                  value={settings.timezone}
                  onChange={(e) => handleChange({ target: { name: 'timezone', value: e.target.value } })}
                  options={[
                    { value: "UTC", label: "UTC (Coordinated Universal Time)" },
                    { value: "EST", label: "EST (Eastern Standard Time)" },
                    { value: "PST", label: "PST (Pacific Standard Time)" },
                    { value: "GMT", label: "GMT (Greenwich Mean Time)" },
                    { value: "IST", label: "IST (Indian Standard Time, GMT+5:30)" }
                  ]}
                  className="w-full !bg-gray-50 dark:!bg-gray-900 border border-gray-200 dark:border-gray-600 dark:border-gray-700 !py-2.5 !pl-[34px] !font-normal !shadow-none !text-gray-900 dark:!text-white"
                />
              </div>
            </div>
            </div>
          </div>
        
          {/* Legal Pages */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <h3 className="text-lg font-bold flex items-center mb-6 border-b border-gray-100 dark:border-gray-700 pb-4 text-gray-800 dark:text-gray-300">
              <FileText className="w-5 h-5 mr-2 text-emerald-500" /> Legal Pages
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Privacy Policy URL</label>
                <input type="text" name="privacy_url" value={settings.privacy_url} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Terms of Service URL</label>
                <input type="text" name="terms_url" value={settings.terms_url} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Cookie Policy URL</label>
                <input type="text" name="cookie_url" value={settings.cookie_url} onChange={handleChange} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Appearance & System */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <h3 className="text-lg font-bold flex items-center mb-6 border-b border-gray-100 dark:border-gray-700 pb-4 text-gray-800 dark:text-gray-300 dark:text-gray-100">
              <Palette className="w-5 h-5 mr-2 text-purple-500" /> Appearance
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Landing Page Theme</label>
                <div className="flex gap-4">
                  <label className={`flex-1 flex items-center justify-center p-3 rounded-xl cursor-pointer font-medium text-sm transition-colors ${settings.theme === 'light' ? 'border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    <input type="radio" name="theme" value="light" checked={settings.theme === 'light'} onChange={handleThemeChange} className="sr-only" />
                    Light Mode
                  </label>
                  <label className={`flex-1 flex items-center justify-center p-3 rounded-xl cursor-pointer font-medium text-sm transition-colors ${settings.theme === 'dark' ? 'border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    <input type="radio" name="theme" value="dark" checked={settings.theme === 'dark'} onChange={handleThemeChange} className="sr-only" />
                    Dark Mode
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Primary Colors</label>
                <div className="flex gap-3">
                  {['#2563eb', '#16a34a', '#8b5cf6', '#db2777', '#ea580c'].map(color => (
                    <button 
                      key={color} 
                      onClick={() => handleColorSelect(color)}
                      className={`w-8 h-8 rounded-full border-2 shadow-sm transition-all ${settings.primary_color === color ? 'border-gray-900 scale-110' : 'border-white hover:scale-110'}`} 
                      style={{ backgroundColor: color }}
                    ></button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <h3 className="text-lg font-bold flex items-center mb-6 border-b border-gray-100 dark:border-gray-700 pb-4 text-gray-800 dark:text-gray-300">
              <ShieldAlert className="w-5 h-5 mr-2 text-rose-500" /> Maintenance
            </h3>
            <label className="flex items-center justify-between cursor-pointer p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-600">
              <div>
                <span className="text-sm font-bold text-gray-900 dark:text-white block">Maintenance Mode</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 block">Disable access to the platform for regular users</span>
              </div>
              <input 
                type="checkbox" 
                name="maintenance_mode"
                checked={settings.maintenance_mode === 'true'}
                onChange={handleChange}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-gray-800 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500 relative"></div>
            </label>
          </div>

          {/* Social Links */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
            <h3 className="text-lg font-bold flex items-center mb-6 border-b border-gray-100 dark:border-gray-700 pb-4 text-gray-800 dark:text-gray-300">
              <LinkIcon className="w-5 h-5 mr-2 text-indigo-500" /> Social Links
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Facebook</label>
                <input type="url" name="social_facebook" value={settings.social_facebook} onChange={handleChange} placeholder="https://facebook.com/..." className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Twitter / X</label>
                <input type="url" name="social_twitter" value={settings.social_twitter} onChange={handleChange} placeholder="https://twitter.com/..." className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Instagram</label>
                <input type="url" name="social_instagram" value={settings.social_instagram} onChange={handleChange} placeholder="https://instagram.com/..." className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Logo Modal */}
      {viewingLogo && settings.site_logo && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setViewingLogo(false)}>
          <button 
            onClick={() => setViewingLogo(false)}
            className="absolute top-6 right-6 text-white hover:text-gray-300 transition-colors p-2 bg-black/40 hover:bg-black/60 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={settings.site_logo} 
            alt="Logo Fullscreen" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminSettings;
