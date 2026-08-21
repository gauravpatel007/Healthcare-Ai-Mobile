import React, { useState, useEffect, useRef } from 'react';
import useTheme from '../hooks/useTheme';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../utils/api';
import { toast } from 'react-hot-toast';
import { useLang } from '../contexts/LangContext';

// Create a motion-enabled Link component
const MotionLink = motion.create(Link);

// Pages
import DashboardOverview from './DashboardOverview';
import AIChat from './AIChat';
import AIFitness from './AIFitness';
import Appointments from './Appointments';
import Records from './Records';
import Medicine from './Medicine';
import Analytics from './Analytics';
import AISymptom from './AISymptom';
import AINutrition from './AINutrition';
import AIMental from './AIMental';
import Trackers from './Trackers';
import Settings from './Settings';
import Emergency from './Emergency';

// Components
import VoiceLogger from '../components/VoiceLogger';
import ThemeToggle from '../components/ThemeToggle';
import FeedbackModal from '../components/FeedbackModal';
import UserNotificationsDropdown from '../components/UserNotificationsDropdown';

// Icons
import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  Folder as FolderIcon,
  Pill,
  BarChart3,
  MessageSquare,
  Stethoscope,
  UtensilsCrossed,
  Dumbbell,
  SmilePlus,
  Activity,
  ShieldAlert,
  Settings as SettingsIcon,
  LogOut,
  Search,
  Menu,
  ChevronDown,
  HeartPulse
} from 'lucide-react';

const AppDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { theme: userTheme, toggleTheme: toggleUserTheme } = useTheme('user_theme');

  const [currentUser, setCurrentUser] = useState({ name: 'Loading...', email: '' });
  const [savedAccounts, setSavedAccounts] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [voiceAction, setVoiceAction] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  useEffect(() => {
    // Check authentication
    if (!API.isAuthenticated()) {
      navigate('/');
      return;
    }

    setSavedAccounts(API.getSavedAccounts());

    // Impersonation logic
    const params = new URLSearchParams(window.location.search);
    if (params.get('impersonate') === '1') {
      const impToken = localStorage.getItem('_admin_impersonate_token');
      const impRefresh = localStorage.getItem('_admin_impersonate_refresh');
      if (impToken) {
        localStorage.setItem('lifeos_token', impToken);
        if (impRefresh) localStorage.setItem('lifeos_refresh_token', impRefresh);
        localStorage.removeItem('_admin_impersonate_token');
        localStorage.removeItem('_admin_impersonate_refresh');
        window.history.replaceState({}, document.title, "/app");
      }
    }

    API.get('/auth/me').then(res => {
      if (res) setCurrentUser({
        name: (res.name && res.name !== 'User') ? res.name : res.email.split('@')[0],
        email: res.email,
        avatar_url: res.avatar_url
      });
      API.saveCurrentAccount();
    }).catch(() => {
      // Ignore
    });

    // Also fetch offline medical ID data like the old right panel did
    API.get('/users/profile').then(profile => {
      if (profile) {
        API.get('/emergency/contacts').then(contacts => {
          localStorage.setItem('offline_medical_id', JSON.stringify({ profile, contacts: contacts || [] }));
        }).catch(() => { });
      }
    }).catch(() => { });
  }, [navigate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleLogout = (e, email = null) => {
    if (e) e.stopPropagation();
    API.logout(email);
  };

  const handleAccountSwitch = (email, e) => {
    if (e) e.stopPropagation();
    API.switchAccount(email);
  };

  const handleAddAccount = (e) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to log out and add a new account?')) {
      window.location.href = '/?login=true';
    }
  };

  const { t } = useLang();

  const overviewItems = [
    { id: 'dashboard', label: t('dashboard'), path: '/app', icon: LayoutDashboard },
    { id: 'analytics', label: t('analytics'), path: '/app/analytics', icon: BarChart3 },
    { id: 'trackers', label: t('health'), path: '/app/trackers', icon: Activity },
  ];

  const aiCareItems = [
    { id: 'ai-chat', label: t('ai_chat'), path: '/app/ai-chat', icon: MessageSquare },
    { id: 'ai-fitness', label: t('fitness'), path: '/app/ai-fitness', icon: Dumbbell },
    { id: 'ai-nutrition', label: t('nutrition'), path: '/app/ai-nutrition', icon: UtensilsCrossed },
    { id: 'ai-symptom', label: t('symptom_checker'), path: '/app/ai-symptom', icon: Stethoscope },
    { id: 'ai-mental', label: t('mental'), path: '/app/ai-mental', icon: SmilePlus },
  ];

  const careItems = [
    { id: 'appointments', label: t('appointments'), path: '/app/appointments', icon: CalendarIcon },
    { id: 'records', label: t('records'), path: '/app/records', icon: FolderIcon },
    { id: 'medicine', label: t('medicines'), path: '/app/medicine', icon: Pill },
    { id: 'emergency', label: t('emergency'), path: '/app/emergency', icon: ShieldAlert },
    { id: 'settings', label: t('settings'), path: '/app/settings', icon: SettingsIcon },
  ];

  const allFeatures = [...overviewItems, ...aiCareItems, ...careItems];
  const filteredFeatures = searchQuery
    ? allFeatures.filter(f => f.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const handleVoiceAction = (action) => {
    if (action.target_feature === 'auth') {
      if (action.action_name === 'logout') {
        if (confirm('Are you sure you want to log out?')) {
          API.logout();
          navigate('/login');
        }
      } else if (action.action_name === 'add_account') {
        if (confirm('Are you sure you want to log out and add a new account?')) {
          window.location.href = '/?login=true';
        }
      } else if (action.action_name === 'switch_account_next') {
        if (savedAccounts.length <= 1) {
          toast.error('No other accounts logged in');
          return;
        }
        const currentIndex = savedAccounts.findIndex(acc => acc.email === currentUser.email);
        const nextIndex = (currentIndex + 1) % savedAccounts.length;
        handleAccountSwitch(savedAccounts[nextIndex].email);
      } else if (action.action_name === 'switch_account_specific') {
        const targetEmail = action.data?.email?.toLowerCase();
        if (!targetEmail) return;
        const targetAccount = savedAccounts.find(acc => acc.email.toLowerCase() === targetEmail);
        if (targetAccount) {
          handleAccountSwitch(targetAccount.email);
        } else {
          toast.error(`Account ${targetEmail} is not logged in`);
        }
      }
      return;
    }
    const target = allFeatures.find(f => f.id === action.target_feature);
    if (!target) {
      toast.error(`Unknown feature: ${action.target_feature}`);
      return;
    }
    setVoiceAction(null);
    navigate(target.path);
    setTimeout(() => {
      setVoiceAction(action);
    }, 300);
  };

  const renderNavItems = (items) => (
    items.map(item => {
      const isActive = location.pathname === item.path || (item.path === '/app' && location.pathname === '/app/');
      const isEmergency = item.id === 'emergency';
      const Icon = item.icon;

      // Spring transition config — snappy and responsive, matching the reference
      const springTransition = { type: 'spring', stiffness: 400, damping: 25, mass: 0.8 };

      // Active items: no hover animation
      if (isActive) {
        return (
          <Link
            key={item.id}
            to={item.path}
            className={`flex items-center font-semibold relative z-10 text-white ${isSidebarOpen ? 'px-3 py-2.5' : 'w-10 h-10 mx-auto justify-center'}`}
            title={!isSidebarOpen ? item.label : ''}
            onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
          >
            <div className={`absolute inset-0 -z-10 ${isSidebarOpen ? 'rounded-xl' : 'rounded-lg'} bg-[#0f172a] dark:bg-[#262626] shadow-sm`} />
            <div className={`flex items-center ${isSidebarOpen ? 'gap-3 w-full' : 'justify-center'}`}>
              <Icon className="w-5 h-5 shrink-0" strokeWidth={2} />
              {isSidebarOpen && <span className="truncate text-sm font-semibold tracking-wide">{item.label}</span>}
            </div>
          </Link>
        );
      }

      // Non-active items: Framer Motion hover animation
      return (
        <MotionLink
          key={item.id}
          to={item.path}
          className={`flex items-center font-semibold relative z-10 ${isSidebarOpen ? 'px-3 py-2.5' : 'w-10 h-10 mx-auto justify-center'
            } ${isEmergency
              ? 'text-rose-500'
              : 'text-[#6b7280] dark:text-gray-400'
            }`}
          title={!isSidebarOpen ? item.label : ''}
          onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
          initial={false}
          whileHover={{
            scale: 1.1,
            backgroundColor: isEmergency ? 'rgba(254, 242, 242, 1)' : 'rgba(243, 244, 246, 1)',
            color: isEmergency ? 'rgb(225, 29, 72)' : 'rgb(15, 23, 42)',
          }}
          transition={springTransition}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0)',
            borderRadius: isSidebarOpen ? '12px' : '8px',
            transformOrigin: 'center center',
          }}
        >
          <div className={`flex items-center ${isSidebarOpen ? 'gap-3 w-full' : 'justify-center'}`}>
            <Icon className="w-5 h-5 shrink-0" strokeWidth={2} />
            {isSidebarOpen && <span className="truncate text-sm font-semibold tracking-wide">{item.label}</span>}
          </div>
        </MotionLink>
      );
    })
  );

  return (
    <div className={userTheme === 'dark' ? 'dark' : ''} style={{ colorScheme: userTheme }} data-theme={userTheme}>
      <div className="fixed inset-0 z-50 flex bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 font-sans overflow-hidden">

        {/* Sidebar */}
        <aside
          className={`${isSidebarOpen ? 'w-[260px]' : 'w-20'
            } transition-all duration-300 ease-in-out bg-white dark:bg-black border-r border-gray-100 dark:border-gray-800 flex flex-col justify-between overflow-y-auto shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}
        >
          <div className="px-5">
            {/* Brand */}
            <div
              className="pt-6 pb-4 flex items-center justify-start cursor-pointer gap-3.5"
              onClick={() => navigate('/app')}
            >
              {isSidebarOpen ? (
                <>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2F80ED] to-[#56CCF2] flex items-center justify-center shrink-0 shadow-sm">
                    <HeartPulse className="w-[22px] h-[22px] text-white" strokeWidth={2.5} />
                  </div>
                  <h1 className="text-[22px] font-black text-[#0f172a] dark:text-white tracking-tight">
                    LifeOS
                  </h1>
                </>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2F80ED] to-[#56CCF2] flex items-center justify-center shrink-0 shadow-sm mx-auto mt-2">
                  <HeartPulse className="w-[22px] h-[22px] text-white" strokeWidth={2.5} />
                </div>
              )}
            </div>

            {/* Nav Links */}
            <nav className="space-y-0.5 pb-6">
              {/* OVERVIEW */}
              <div className={`text-[11px] font-bold text-[#9ca3af] uppercase tracking-widest mt-2 mb-2 ${!isSidebarOpen && 'text-center'}`}>
                {isSidebarOpen ? (t('overview_header') || 'Overview') : 'Ovr'}
              </div>
              {renderNavItems(overviewItems)}

              {/* AI CARE */}
              <div className={`text-[11px] font-bold text-[#9ca3af] uppercase tracking-widest mt-6 mb-2 ${!isSidebarOpen && 'text-center'}`}>
                {isSidebarOpen ? (t('ai_care_header') || 'AI Care') : 'AIC'}
              </div>
              {renderNavItems(aiCareItems)}

              {/* CARE */}
              <div className={`text-[11px] font-bold text-[#9ca3af] uppercase tracking-widest mt-6 mb-2 ${!isSidebarOpen && 'text-center'}`}>
                {isSidebarOpen ? (t('care_header') || 'Care') : 'Car'}
              </div>
              {renderNavItems(careItems)}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
          {/* Top Header */}
          <header className="h-16 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 z-40 shadow-sm shrink-0">
            <div className="flex items-center">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 mr-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Menu className="w-5 h-5 text-gray-500" />
              </button>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 hidden sm:block">
                {allFeatures.find(i => location.pathname === i.path || (i.path !== '/app' && location.pathname.startsWith(i.path)))?.label || 'Dashboard'}
              </h2>
            </div>

            <div className="flex items-center space-x-4">

              {/* Search Bar */}
              <div className="relative hidden md:block">
                <div className="flex items-center bg-gray-100 dark:bg-gray-700/50 rounded-full px-4 py-2 border border-transparent focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-gray-800 transition-colors">
                  <Search className="w-4 h-4 text-gray-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Search features..."
                    className="bg-transparent border-none outline-none text-sm w-48 text-gray-700 dark:text-gray-200"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Search Results Dropdown */}
                {searchQuery && (
                  <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-64 overflow-y-auto z-50">
                    {filteredFeatures.length > 0 ? (
                      filteredFeatures.map(f => {
                        const Icon = f.icon;
                        return (
                          <div
                            key={f.id}
                            onClick={() => {
                              setSearchQuery('');
                              navigate(f.path);
                            }}
                            className="flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                          >
                            <Icon className="w-4 h-4 text-blue-500 mr-3" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{f.label}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-sm text-gray-500">No features found</div>
                    )}
                  </div>
                )}
              </div>

              <ThemeToggle theme={userTheme} toggleTheme={toggleUserTheme} />
              <UserNotificationsDropdown />

              {/* User Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-2 p-1 pr-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-transparent focus:outline-none"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    {currentUser.avatar_url ? (
                      <img src={`http://localhost:8000${currentUser.avatar_url}`} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      currentUser.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <span className="font-medium text-sm hidden md:block text-gray-700 dark:text-gray-200 max-w-[100px] truncate">
                    {currentUser.name}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{currentUser.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{currentUser.email}</p>
                    </div>

                    <div className="max-h-60 overflow-y-auto py-2">
                      <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Switch Account</div>
                      {savedAccounts.map(acc => (
                        <button
                          key={acc.email}
                          onClick={(e) => acc.email !== currentUser.email ? handleAccountSwitch(acc.email, e) : null}
                          className={`w-full text-left px-4 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${acc.email === currentUser.email ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                        >
                          <div className="flex items-center space-x-3 truncate pr-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
                              {acc.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="truncate">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{acc.name}</p>
                              <p className="text-xs text-gray-500 truncate">{acc.email}</p>
                            </div>
                          </div>
                          {acc.email === currentUser.email && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>}
                        </button>
                      ))}

                      <button
                        onClick={handleAddAccount}
                        className="w-full text-left px-4 py-3 flex items-center space-x-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-t border-gray-100 dark:border-gray-700 mt-2"
                      >
                        <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center font-bold text-lg leading-none">+</div>
                        <span>Add another account</span>
                      </button>
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-700 p-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); setShowFeedbackModal(true); }}
                        className="w-full text-left px-3 py-2 flex items-center space-x-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Give Feedback</span>
                      </button>
                      <button
                        onClick={(e) => handleLogout(e, currentUser.email)}
                        className="w-full text-left px-3 py-2 flex items-center space-x-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors mt-1"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Log out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </header>

          {/* Page Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth bg-gray-50 dark:bg-black relative">
            <Routes>
              <Route path="/" element={<DashboardOverview currentUser={currentUser} voiceAction={voiceAction} onVoiceActionConsumed={() => setVoiceAction(null)} />} />
              <Route path="/appointments" element={<Appointments voiceAction={voiceAction} onVoiceActionConsumed={() => setVoiceAction(null)} />} />
              <Route path="/records" element={<Records voiceAction={voiceAction} onVoiceActionConsumed={() => setVoiceAction(null)} />} />
              <Route path="/medicine" element={<Medicine voiceAction={voiceAction} onVoiceActionConsumed={() => setVoiceAction(null)} />} />
              <Route path="/analytics" element={<Analytics voiceAction={voiceAction} onVoiceActionConsumed={() => setVoiceAction(null)} />} />
              <Route path="/ai-chat" element={<AIChat voiceAction={voiceAction} onVoiceActionConsumed={() => setVoiceAction(null)} />} />
              <Route path="/ai-symptom" element={<AISymptom voiceAction={voiceAction} onVoiceActionConsumed={() => setVoiceAction(null)} />} />
              <Route path="/ai-nutrition" element={<AINutrition voiceAction={voiceAction} onVoiceActionConsumed={() => setVoiceAction(null)} />} />
              <Route path="/ai-fitness" element={<AIFitness voiceAction={voiceAction} onVoiceActionConsumed={() => setVoiceAction(null)} />} />
              <Route path="/ai-mental" element={<AIMental voiceAction={voiceAction} onVoiceActionConsumed={() => setVoiceAction(null)} />} />
              <Route path="/trackers" element={<Trackers voiceAction={voiceAction} onVoiceActionConsumed={() => setVoiceAction(null)} />} />
              <Route path="/settings" element={<Settings voiceAction={voiceAction} onVoiceActionConsumed={() => setVoiceAction(null)} />} />
              <Route path="/emergency" element={<Emergency voiceAction={voiceAction} onVoiceActionConsumed={() => setVoiceAction(null)} />} />
            </Routes>
          </div>
        </main>

        <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />
      </div>
      {/* Global "Hey LifeOS" Voice Assistant — always present */}
      <VoiceLogger onLogSuccess={(msg) => toast.success(msg)} onAction={handleVoiceAction} />
    </div>
  );
};

export default AppDashboard;
