import React, { useState, useEffect, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { SettingsProvider, useSettings } from './contexts/SettingsContext'
import { UnitProvider } from './contexts/UnitContext'
import { LangProvider } from './contexts/LangContext'
import { AlertTriangle } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import { Capacitor } from '@capacitor/core'
import OneSignal from 'onesignal-cordova-plugin'
import { startReminderNavigation } from './utils/reminders'
import API from './utils/api'
import { createPushRegistration } from './utils/pushRegistration'

// Lazy-loaded pages — each becomes a separate JS chunk loaded on demand
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const AppDashboard = React.lazy(() => import('./pages/AppDashboard'));
const SharedProfile = React.lazy(() => import('./pages/SharedProfile'));
const MedicalIDCard = React.lazy(() => import('./components/MedicalIDCard'));

// Admin Pages (lazy)
const AdminLogin = React.lazy(() => import('./pages/admin/AdminLogin'));
const AdminLayout = React.lazy(() => import('./pages/admin/AdminLayout'));
const AdminOverview = React.lazy(() => import('./pages/admin/AdminOverview'));
const AdminUsers = React.lazy(() => import('./pages/admin/AdminUsers'));
const AdminMedicalRecords = React.lazy(() => import('./pages/admin/AdminMedicalRecords'));
const AdminMedicineDB = React.lazy(() => import('./pages/admin/AdminMedicineDB'));
const AdminDiseaseDB = React.lazy(() => import('./pages/admin/AdminDiseaseDB'));
const AdminSymptoms = React.lazy(() => import('./pages/admin/AdminSymptoms'));
const AdminHealth = React.lazy(() => import('./pages/admin/AdminHealth'));
const AdminFileManager = React.lazy(() => import('./pages/admin/AdminFileManager'));
const AdminSettings = React.lazy(() => import('./pages/admin/AdminSettings'));
const AdminSecurity = React.lazy(() => import('./pages/admin/AdminSecurity'));
const AdminAuditLogs = React.lazy(() => import('./pages/admin/AdminAuditLogs'));
const AdminAnalytics = React.lazy(() => import('./pages/admin/AdminAnalytics'));

// Lightweight loading spinner for Suspense boundaries
const PageLoader = () => (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm">
    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const MaintenanceScreen = ({ showLogoutMsg }) => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <div className="bg-white dark:bg-gray-800 p-10 rounded-[2rem] shadow-2xl flex flex-col items-center max-w-xl text-center border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-500">
      <div className="w-24 h-24 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
        <AlertTriangle className="w-12 h-12" />
      </div>
      <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">We'll be right back</h1>
      <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed mb-8">
        Our platform is currently undergoing scheduled maintenance to improve your experience. We appreciate your patience.
      </p>
      {showLogoutMsg && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-xl font-semibold text-sm w-full">
          You have been securely logged out for your protection.
        </div>
      )}
    </div>
  </div>
);

const EmergencyInvitation = React.lazy(() => import('./pages/EmergencyInvitation'));

const AppRoutes = () => {
  const { settings, loading } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => startReminderNavigation(navigate), [navigate]);

  const isMaintenance = settings?.maintenance_mode === 'true' || settings?.maintenance_mode === true;
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isRoot = location.pathname === '/';
  
  const [showLogoutMsg, setShowLogoutMsg] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    import('./utils/api').then(({ default: API }) => {
      API.initAuth().then(() => {
        setAuthInitialized(true);
        // If they are on the root and have a token, optionally auto-redirect to /app
        // But let's leave the explicit redirect to LandingPage logic or handle it here
        if (window.location.pathname === '/' && API.isAuthenticated()) {
          // navigate('/app'); // Done in LandingPage if preferred, or here
        }
      });
    });
  }, []);

  useEffect(() => {
    if (isMaintenance && !isAdminRoute) {
      const token = localStorage.getItem('token');
      // If they had a token and weren't an admin, clear it
      if (token && !localStorage.getItem('admin_logged_in')) {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('lifeos_accounts');
        localStorage.removeItem('user');
        setShowLogoutMsg(true);
      }
      
      // If they are not on the root page, redirect them to the landing page after 5s
      if (!isRoot) {
        const timer = setTimeout(() => {
          navigate('/');
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [isMaintenance, isAdminRoute, isRoot, navigate]);

  // Keep registration independent of loading the medicine screen.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let stopped = false;
    OneSignal.initialize("b59262d3-8500-4aa1-a8be-4d87675cdd9e");
    const subscription = OneSignal.User.pushSubscription;
    const register = createPushRegistration(API, subscription,
      () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    const sync = () => register().catch(err => {
      console.warn('Push registration will retry:', err.message);
      return false;
    });
    const click = event => {
      if (event.notification?.additionalData?.href === '/emergency-invitation') {
        navigate('/emergency-invitation');
        return;
      }
      if (event.notification?.additionalData?.href === '/app/medicine?tab=reminders') {
        navigate(API.isAuthenticated() ? '/app/medicine?tab=reminders' : '/?login=true');
      }
    };
    const resume = () => { if (!document.hidden) sync(); };
    subscription.addEventListener('change', sync);
    OneSignal.Notifications.addEventListener('click', click);
    OneSignal.Notifications.addEventListener('permissionChange', sync);
    window.addEventListener('lifeos-auth-changed', sync);
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', resume);
    window._registerOneSignalToken = sync;
    API.initAuth().then(() => { if (!stopped) sync(); });
    OneSignal.Notifications.requestPermission(true).then(() => { if (!stopped) sync(); }).catch(console.warn);
    const retry = setInterval(sync, 30000);
    return () => {
      stopped = true;
      clearInterval(retry);
      subscription.removeEventListener('change', sync);
      OneSignal.Notifications.removeEventListener('click', click);
      OneSignal.Notifications.removeEventListener('permissionChange', sync);
      window.removeEventListener('lifeos-auth-changed', sync);
      window.removeEventListener('online', sync);
      document.removeEventListener('visibilitychange', resume);
      if (window._registerOneSignalToken === sync) delete window._registerOneSignalToken;
    };
  }, [navigate]);

  // If maintenance mode is active, not on an admin route, and not on root
  if (isMaintenance && !isAdminRoute && !isRoot) {
    return <MaintenanceScreen showLogoutMsg={showLogoutMsg} />;
  }

  if (!authInitialized) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/medical-id" element={<MedicalIDCard />} />
        <Route path="/app/*" element={<AppDashboard />} />
        <Route path="/shared/:token" element={<SharedProfile />} />
        <Route path="/emergency-invitation" element={<EmergencyInvitation />} />
        
        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="records" element={<AdminMedicalRecords />} />
          <Route path="medicine-db" element={<AdminMedicineDB />} />
          <Route path="diseases" element={<AdminDiseaseDB />} />
          <Route path="symptoms" element={<AdminSymptoms />} />
          <Route path="health" element={<AdminHealth />} />
          <Route path="file-manager" element={<AdminFileManager />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="security" element={<AdminSecurity />} />
          <Route path="audit" element={<AdminAuditLogs />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <SettingsProvider>
      <LangProvider>
        <UnitProvider>
          <Toaster position="top-right" containerStyle={{ zIndex: 9999999 }} toastOptions={{ className: 'dark:bg-gray-800 dark:text-white border border-gray-100 dark:border-gray-700 shadow-xl rounded-2xl' }} />
          <Router>
            <AppRoutes />
          </Router>
        </UnitProvider>
      </LangProvider>
    </SettingsProvider>
  );
}

export default App;
