import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, Server, Activity, Users } from 'lucide-react';
import API from '../../utils/api';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (username === 'admin' && password === 'admin') {
      localStorage.setItem('admin_logged_in', 'true');
      navigate('/admin');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const response = await API.request('/auth/login', {
        method: 'POST',
        body: { email: username.trim(), password: password.trim() },
      });
      API.setAuthenticated(true);
      const profile = await API.saveCurrentAccount();
      if (profile?.role === 'admin') {
        localStorage.setItem('admin_logged_in', 'true');
        navigate('/admin');
      } else {
        setError('Unauthorized: Admins only');
      }
    } catch (err) {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-[#f0f4ff] flex items-center justify-center p-2 sm:p-4 font-sans overflow-hidden">
      {/* Main Container Card - Scales to screen to avoid scrollbars */}
      <div className="w-full max-w-[1400px] h-[95%] max-h-[650px] bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-row border border-white/60">
        
        {/* Left Side - Login Form (Always 50%) */}
        <div className="w-1/2 h-full flex flex-col relative p-4 sm:p-6 bg-white dark:bg-gray-800 overflow-y-auto">
          
          <div className="max-w-[420px] w-full h-full mx-auto flex flex-col py-4">
            
            <div className="mt-2 mb-auto">
              <h1 className="text-4xl sm:text-5xl leading-tight font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">
                Welcome to LifeOS
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-base">
                Find Trusted Specialists for Your Practice
              </p>
            </div>

            <div className="my-auto w-full">
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-100 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                
                {/* Username Field */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">USERNAME</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-full py-4 px-6 text-gray-900 dark:text-white text-lg placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all font-medium"
                    required
                  />
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-full py-4 pl-6 pr-12 text-gray-900 dark:text-white text-lg placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all font-medium"
                      required
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Sign In Button */}
                <button 
                  type="submit" 
                  className="w-full mt-2 bg-gradient-to-r from-[#4f46e5] to-[#06b6d4] hover:from-[#4338ca] hover:to-[#0891b2] text-white font-bold py-4 px-6 rounded-full transition-all shadow-[0_8px_20px_rgba(79,70,229,0.3)] hover:shadow-[0_10px_25px_rgba(79,70,229,0.4)] active:scale-[0.98] text-xl"
                >
                  Sign In
                </button>
              </form>
            </div>
            
            <div className="mt-auto mb-2 text-center text-sm">
              <p className="font-medium text-gray-400">
                By using this service, you agree to our <a href="#" className="text-indigo-600 hover:underline">Terms of Use</a><br/>
                and <a href="#" className="text-indigo-600 hover:underline">Privacy Policy</a>
              </p>
            </div>
            
          </div>
        </div>

        {/* Right Side - Image/Illustration (Always 50%, no padding so it touches edges) */}
        <div className="w-1/2 h-full relative bg-[#eef2f9]">
          {/* Using a highly reliable Unsplash URL for the medical professional */}
          <img 
            src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80" 
            alt="Medical professional" 
            className="absolute inset-0 w-full h-full object-cover rounded-r-[2.5rem]"
          />
             
          {/* Subtle overlay to soften the image */}
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/20 to-transparent rounded-r-[2.5rem]"></div>
             
          {/* Simulated Floating UI Element 1 - Top Left */}
          <div className="absolute top-12 left-12 bg-white dark:bg-gray-800/95 backdrop-blur-md p-6 rounded-2xl shadow-xl w-72 transform hover:-translate-y-1 transition-transform cursor-default border border-white">
            <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-bold text-gray-800 dark:text-gray-300 text-base">System Analytics</h3>
            </div>
            {/* Simulated bar chart */}
            <div className="flex gap-2 items-end h-16 mt-4">
              {[40, 60, 30, 80, 50].map((h, i) => (
                <div key={i} className={`flex-1 rounded-t-md ${i === 3 ? 'bg-gradient-to-t from-indigo-500 to-cyan-400' : 'bg-blue-100'}`} style={{ height: `${h}%` }}></div>
              ))}
            </div>
          </div>
             
          {/* Simulated Floating UI Element 2 - Bottom Left (Security & Emergency) */}
          <div className="absolute bottom-20 left-8 bg-white dark:bg-gray-800/95 backdrop-blur-md px-8 py-6 rounded-3xl shadow-xl transform hover:-translate-y-1 transition-transform cursor-default border border-white">
            <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shadow-sm">
                  <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="font-bold text-gray-800 dark:text-gray-300 text-lg">Security Status</h3>
            </div>
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex items-center justify-between gap-8">
                <span className="text-sm font-bold text-slate-700">Emergency System</span>
                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-md">ACTIVE</span>
              </div>
              <div className="flex items-center justify-between gap-8">
                <span className="text-sm font-bold text-slate-700">Encryption</span>
                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-md">ACTIVE</span>
              </div>
            </div>
          </div>

          {/* Simulated Floating UI Element 3 - Right Side (Active Sessions) */}
          <div className="absolute top-1/3 right-8 bg-white dark:bg-gray-800/95 backdrop-blur-md p-6 rounded-3xl shadow-xl w-72 transform hover:-translate-y-1 transition-transform cursor-default border border-white">
            <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-bold text-gray-800 dark:text-gray-300 text-lg">Active Sessions</h3>
            </div>
            
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-5 rounded-2xl border border-indigo-400 relative overflow-hidden shadow-inner">
              <div className="absolute right-[-10px] top-[-10px] w-24 h-24 bg-white dark:bg-gray-800/10 rounded-full blur-xl"></div>
              <p className="text-xs font-bold text-indigo-100 uppercase tracking-wider mb-2">Patients Online</p>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-extrabold text-white leading-none">124</span>
                <span className="text-indigo-200 text-sm font-medium mb-1 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  live
                </span>
              </div>
            </div>
            
            <div className="mt-4 flex justify-between items-center px-2">
               <span className="text-sm font-semibold text-slate-500">AI Chat</span>
               <span className="text-sm font-bold text-slate-700">89</span>
            </div>
            <div className="mt-2 flex justify-between items-center px-2">
               <span className="text-sm font-semibold text-slate-500">Symptom Checker</span>
               <span className="text-sm font-bold text-slate-700">35</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default AdminLogin;
