import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { SettingsProvider, useSettings } from './contexts/SettingsContext'
import { UnitProvider } from './contexts/UnitContext'
import { LangProvider } from './contexts/LangContext'
import { AlertTriangle } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import LandingPage from './pages/LandingPage'
import AppDashboard from './pages/AppDashboard'
import SharedProfile from './pages/SharedProfile'
import MedicalIDCard from './components/MedicalIDCard'
import { Capacitor } from '@capacitor/core'
import { startReminderNavigation } from './utils/reminders'

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin'
import AdminLayout from './pages/admin/AdminLayout'
import AdminOverview from './pages/admin/AdminOverview'
import AdminUsers from './pages/admin/AdminUsers'
import AdminMedicalRecords from './pages/admin/AdminMedicalRecords'
import AdminMedicineDB from './pages/admin/AdminMedicineDB'
import AdminDiseaseDB from './pages/admin/AdminDiseaseDB'
import AdminSymptoms from './pages/admin/AdminSymptoms'
import AdminHealth from './pages/admin/AdminHealth'
import AdminFileManager from './pages/admin/AdminFileManager'
import AdminSettings from './pages/admin/AdminSettings'
import AdminSecurity from './pages/admin/AdminSecurity'
import AdminAuditLogs from './pages/admin/AdminAuditLogs'
import AdminAnalytics from './pages/admin/AdminAnalytics'

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

  // OneSignal Push Notifications Setup
  useEffect(() => {
    const initOneSignal = async () => {
      const appId = "66baddfc-24d8-4b43-a3dc-2d4d9f297f54";
      
      if (Capacitor.isNativePlatform()) {
        try {
          // Wait for device to be ready
          if (window.plugins && window.plugins.OneSignal) {
            const OneSignal = window.plugins.OneSignal;
            
            // Set your OneSignal AppId
            OneSignal.setAppId(appId);
            
            // Prompt for push on Android 13+ / iOS
            OneSignal.promptForPushNotificationsWithUserResponse((accepted) => {
              console.log("User accepted notifications: " + accepted);
            });
            
            // Set notification handler
            OneSignal.setNotificationOpenedHandler((jsonData) => {
              console.log('notificationOpenedCallback: ' + JSON.stringify(jsonData));
            });

            // Get device token
            OneSignal.getDeviceState((state) => {
              if (state && state.userId) {
                const playerId = state.userId; // This is the OneSignal player ID for native
                const token = localStorage.getItem('token');
                if (token && playerId) {
                  import('./utils/api').then(({ default: API }) => {
                    API.put('/users/me/device-token', { token: playerId })
                      .catch(err => console.error("Failed to register device token", err));
                  });
                }
              }
            });
          }
        } catch (err) {
          console.error("Native OneSignal initialization failed", err);
        }
      } else {
        // Fallback for Web Push (PWA/Browser) - NOTE: react-onesignal was uninstalled
        // but if reinstalled, it can be used here. For now, doing nothing on web.
        console.log("Running in browser, skipping native push notifications.");
      }
    };
    initOneSignal();
  }, []);




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
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/medical-id" element={<MedicalIDCard />} />
      <Route path="/app/*" element={<AppDashboard />} />
      <Route path="/shared/:token" element={<SharedProfile />} />
      
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
