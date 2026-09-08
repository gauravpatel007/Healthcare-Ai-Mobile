import { Link, Outlet, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import ThemeToggle from '../../components/ThemeToggle';
import useTheme from '../../hooks/useTheme';
import { 
  LayoutDashboard, 
  Users, 
  Bot, 
  HeartPulse, 
  Settings,
  LogOut,
  Bell,
  FileText,
  Activity,
  Dumbbell,
  Pill,
  Thermometer,
  MessageSquare,
  Folder,
  Shield,
  ClipboardList,
  BarChart3
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import AdminBottomNav from './AdminBottomNav';
import AdminTopNav from './AdminTopNav';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { settings } = useSettings();
  const { theme: adminTheme, toggleTheme: toggleAdminTheme } = useTheme('admin_theme');
  const topNavRef = useRef(null);

  // Check if logged in
  const isLoggedIn = localStorage.getItem('admin_logged_in') === 'true';
  if (!isLoggedIn) {
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_logged_in');
    navigate('/');
  };

  const navItems = [
    { name: 'Overview', path: '/admin', icon: LayoutDashboard },
    { name: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Medical Records', path: '/admin/records', icon: FileText },
    { name: 'Medicine DB', path: '/admin/medicine-db', icon: Pill },
    { name: 'Disease DB', path: '/admin/diseases', icon: HeartPulse },
    { name: 'Symptoms', path: '/admin/symptoms', icon: Thermometer },
    { name: 'Health Services', path: '/admin/health', icon: HeartPulse },
    { name: 'File Manager', path: '/admin/file-manager', icon: Folder },
    { name: 'Security', path: '/admin/security', icon: Shield },
    { name: 'Audit Logs', path: '/admin/audit', icon: ClipboardList },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  // Mobile nav grouping
  const bottomNavItems = [
    navItems.find(i => i.name === 'Overview'),
    navItems.find(i => i.name === 'Users'),
    navItems.find(i => i.name === 'Health Services'),
    navItems.find(i => i.name === 'Security'),
    navItems.find(i => i.name === 'Settings'),
  ];
  
  const topNavItems = navItems.filter(item => !bottomNavItems.includes(item));

  const checkIsActive = (itemPath) => {
    if (itemPath === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    return location.pathname === itemPath || location.pathname.startsWith(itemPath + '/');
  };

  // Scroll active top nav item into view on mobile
  useEffect(() => {
    if (topNavRef.current) {
      const activeEl = topNavRef.current.querySelector('.active-admin-nav');
      if (activeEl) {
        const container = topNavRef.current;
        const scrollLeft = activeEl.offsetLeft - container.offsetWidth / 2 + activeEl.offsetWidth / 2;
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    }
  }, [location.pathname]);

  return (
    <div className={adminTheme === 'dark' ? 'dark' : ''} style={{colorScheme: adminTheme}} data-theme={adminTheme}>
    <div className="fixed inset-0 z-50 flex bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      
      {/* Desktop Sidebar (Hidden in favor of top/bottom nav for all sizes) */}
      <aside 
        className={`hidden ${
          isSidebarOpen ? 'w-64' : 'w-20'
        } transition-all duration-300 ease-in-out bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col justify-between shrink-0`}
      >
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Brand */}
          <div className="h-16 shrink-0 flex items-center justify-center border-b border-gray-200 dark:border-gray-600 dark:border-gray-700 px-4">
            {isSidebarOpen ? (
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                LifeOS Admin
              </h1>
            ) : (
              <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">A</span>
            )}
          </div>

          {/* Nav Links */}
          <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = checkIsActive(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium shadow-sm' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'
                  }`}
                  title={!isSidebarOpen ? item.name : ''}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
                  {isSidebarOpen && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User / Logout */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-600 dark:border-gray-700">
           <button 
             onClick={handleLogout}
             className="w-full flex items-center space-x-3 p-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors duration-200"
           >
             <LogOut className="w-5 h-5" />
             {isSidebarOpen && <span>Logout</span>}
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Top Header */}
        <header className="min-h-[56px] md:min-h-[64px] pt-[env(safe-area-inset-top)] bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 md:px-6 z-30 shrink-0">
          <div className="flex items-center flex-1 min-w-0">
            {/* Mobile Brand */}
            <div className="flex md:hidden items-center justify-start mr-3 shrink-0">
              <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent truncate">
                LifeOS Admin
              </span>
            </div>

            {/* Desktop Sidebar Toggle */}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:block p-2 mr-4 rounded-lg hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
            >
              <LayoutDashboard className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-300 hidden md:block truncate">
              {navItems.find(i => checkIsActive(i.path))?.name || 'Admin Panel'}
            </h2>
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-4 shrink-0">
            <ThemeToggle theme={adminTheme} toggleTheme={toggleAdminTheme} />
            <button onClick={handleLogout} className="md:hidden p-2 rounded-full hover:bg-gray-100 dark:bg-gray-700 transition-colors text-red-500">
              <LogOut className="w-5 h-5" />
            </button>
            <div className="hidden md:flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                A
              </div>
              <span className="font-medium text-sm text-gray-700 dark:text-gray-200">Admin</span>
            </div>
          </div>
        </header>

        {/* Mobile Secondary Nav */}
        <AdminTopNav items={topNavItems} checkIsActive={checkIsActive} topNavRef={topNavRef} />

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-16 md:pb-6 scroll-smooth z-10 relative">
          <Outlet />
        </div>

        {/* Mobile Primary Nav */}
        <AdminBottomNav items={bottomNavItems} checkIsActive={checkIsActive} />
        
      </main>
    </div>
    </div>
  );
};

export default AdminLayout;
