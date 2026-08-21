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

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin'
import AdminLayout from './pages/admin/AdminLayout'
import AdminOverview from './pages/admin/AdminOverview'
import AdminUsers from './pages/admin/AdminUsers'
import AdminAI from './pages/admin/AdminAI'
import AdminHealth from './pages/admin/AdminHealth'
import AdminSettings from './pages/admin/AdminSettings'
import AdminFileManager from './pages/admin/AdminFileManager'
import AdminMedicalRecords from './pages/admin/AdminMedicalRecords'
import AdminSmartTrackers from './pages/admin/AdminSmartTrackers'
import AdminFitness from './pages/admin/AdminFitness'
import AdminMedicineDB from './pages/admin/AdminMedicineDB'
import AdminDiseaseDB from './pages/admin/AdminDiseaseDB'
import AdminSymptoms from './pages/admin/AdminSymptoms'
import AdminNotifications from './pages/admin/AdminNotifications'
import AdminFeedback from './pages/admin/AdminFeedback'
import AdminDiet from './pages/admin/AdminDiet'
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

  const isMaintenance = settings?.maintenance_mode === 'true' || settings?.maintenance_mode === true;
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isRoot = location.pathname === '/';
  
  const [showLogoutMsg, setShowLogoutMsg] = useState(false);

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
      try {
        const OneSignal = (await import('react-onesignal')).default;
        await OneSignal.init({
          appId: "66baddfc-24d8-4b43-a3dc-2d4d9f297f54",
          notifyButton: {
            enable: false,
          },
          allowLocalhostAsSecureOrigin: true,
        });

        const token = localStorage.getItem('token');
        if (token) {
          OneSignal.Slidedown.promptPush();
          // The OneSignal Player ID (device token)
          const playerId = await OneSignal.User.PushSubscription.id;
          if (playerId) {
            import('./utils/api').then(({ default: API }) => {
              API.put('/users/me/device-token', { token: playerId })
                .catch(err => console.error("Failed to register device token", err));
            });
          }
        }
      } catch (err) {
        console.error("OneSignal initialization failed", err);
      }
    };
    initOneSignal();
  }, []);


  // If maintenance mode is active, not on an admin route, and not on root
  if (isMaintenance && !isAdminRoute && !isRoot) {
    return <MaintenanceScreen showLogoutMsg={showLogoutMsg} />;
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
        <Route path="trackers" element={<AdminSmartTrackers />} />
        <Route path="ai" element={<AdminAI />} />
        <Route path="fitness" element={<AdminFitness />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="feedback" element={<AdminFeedback />} />
        <Route path="health" element={<AdminHealth />} />
        <Route path="file-manager" element={<AdminFileManager />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="diet" element={<AdminDiet />} />
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
  )
}

export default App
