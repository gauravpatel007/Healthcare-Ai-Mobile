import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, Pill, Stethoscope, Clock3, Moon, Footprints, Flame, Bot, Check, Bell, BarChart3 } from 'lucide-react';
import LandingChatbot from '../components/LandingChatbot';
import LoginModal from '../components/LoginModal';
import { useSettings } from '../contexts/SettingsContext';

const LandingPage = () => {
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();
  const { settings } = useSettings();

  const [landingTheme, setLandingTheme] = useState(() => {
    return localStorage.getItem('landing_theme') || 'light';
  });

  // Listen for live changes from AdminSettings
  useEffect(() => {
    const handler = () => {
      setLandingTheme(localStorage.getItem('landing_theme') || 'light');
    };
    window.addEventListener('landing-theme-change', handler);
    return () => window.removeEventListener('landing-theme-change', handler);
  }, []);

  useEffect(() => {
    if (window.location.search.includes('login=true')) {
      setShowLogin(true);
    }
  }, []);

  const scrollToSection = (e, id) => {
    e.preventDefault();
    const container = document.getElementById('landing-scroll-container');
    if (!container) return;

    if (id === 'top') {
      container.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      const headerOffset = 0;
      const elementPosition = el.getBoundingClientRect().top;
      const containerPosition = container.getBoundingClientRect().top;
      const offsetPosition = elementPosition - containerPosition + container.scrollTop - headerOffset;
      
      container.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  // Scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0', 'scale-100');
            entry.target.classList.remove('opacity-0', 'translate-y-8', 'translate-y-12', 'translate-x-8', '-translate-x-8', 'scale-95');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('.reveal-on-scroll').forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const isDark = landingTheme === 'dark';

  return (
    <div className={isDark ? 'dark' : ''} style={{colorScheme: landingTheme}} data-theme={landingTheme}>
    <div id="landing-scroll-container" className={`absolute inset-0 w-full h-full overflow-y-auto m-0 p-0 selection:bg-blue-200 selection:text-blue-900 font-['Inter'] transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* ========== TOP NAV BAR ========== */}
      <header className={`fixed top-0 w-full z-50 backdrop-blur-md transition-colors duration-300 ${isDark ? 'bg-slate-950/90 border-b border-slate-800/50' : 'bg-slate-50/90 border-b border-slate-200/50'}`}>
        <nav className="flex justify-between items-center px-6 md:px-10 py-4 max-w-[1440px] mx-auto">
          <div className="flex flex-1 items-center gap-3 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
            <div className="w-9 h-9 rounded-[10px] bg-[#0ea5e9] flex items-center justify-center text-white shadow-sm">
              {settings?.site_logo ? (
                <img src={settings.site_logo} alt="Logo" className={`w-full h-full object-contain ${isDark ? 'bg-transparent' : 'bg-white'}`} />
              ) : (
                <HeartPulse size={20} strokeWidth={2.5} />
              )}
            </div>
            <div className={`text-[22px] font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>LifeOS</div>
          </div>
          {/* Desktop Navigation */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 items-center font-semibold text-[13px] md:text-[15px]">
            <a className={`transition-colors ${isDark ? 'text-slate-300 hover:text-white' : 'text-[#64748b] hover:text-[#0f172a]'}`} href="#top" onClick={(e) => scrollToSection(e, 'top')}>Home</a>
            <a className={`transition-colors ${isDark ? 'text-slate-300 hover:text-white' : 'text-[#64748b] hover:text-[#0f172a]'}`} href="#features" onClick={(e) => scrollToSection(e, 'features')}>Features</a>
            <a className={`transition-colors ${isDark ? 'text-slate-300 hover:text-white' : 'text-[#64748b] hover:text-[#0f172a]'}`} href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')}>How it Works</a>
            <a className={`transition-colors ${isDark ? 'text-slate-300 hover:text-white' : 'text-[#64748b] hover:text-[#0f172a]'}`} href="#testimonials" onClick={(e) => scrollToSection(e, 'testimonials')}>Testimonials</a>
            <a className={`transition-colors ${isDark ? 'text-slate-300 hover:text-white' : 'text-[#64748b] hover:text-[#0f172a]'}`} href="#about-us" onClick={(e) => scrollToSection(e, 'about-us')}>About Us</a>
          </div>
          <div className="flex flex-1 justify-end items-center gap-5">
            {(() => {
              try {
                const offlineRaw = localStorage.getItem('offline_medical_id');
                if (!offlineRaw) return null;
                const offlineData = JSON.parse(offlineRaw);
                const avatar = offlineData?.profile?.avatar || offlineData?.profile?.avatar_url;
                
                return (
                  <a href="/medical-id" className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full text-xs font-bold transition-colors no-underline ${isDark ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                    {avatar ? (
                      <img src={avatar.startsWith('http') ? avatar : `http://localhost:8000${avatar}`} alt="Profile" className="w-[18px] h-[18px] rounded-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-[16px] ml-1">medical_services</span>
                    )}
                    Medical ID
                  </a>
                );
              } catch (e) {
                return null;
              }
            })()}
            <button onClick={() => setShowLogin(true)} className={`text-[15px] font-bold hover:text-[#0ea5e9] transition-colors hidden md:block bg-transparent border-none cursor-pointer ${isDark ? 'text-white' : 'text-[#0f172a]'}`}>Sign In</button>
            <button onClick={() => setShowLogin(true)} className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white px-5 py-[10px] rounded-full text-[15px] font-bold transition-all border-none cursor-pointer shadow-md shadow-sky-500/25 active:scale-95">Get Started</button>
          </div>
        </nav>
      </header>

      <main className={`pt-[74px] overflow-hidden transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        {/* ========== HERO SECTION ========== */}
        <section
          className="relative overflow-hidden"
          style={{
            minHeight: 'calc(100vh - 74px)',
            background: `
              linear-gradient(135deg, #929496 0%, #8b8d8f 48%, #7f8588 100%)
            `,
            backgroundSize: '200% 200%',
            animation: 'heroGlow 18s ease-in-out infinite',
          }}
        >
          {/* ---- Animated Contour Lines (z-index: 1) ---- */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
            <svg
              viewBox="0 0 1600 900"
              preserveAspectRatio="none"
              className="absolute inset-0"
              style={{ width: '100%', height: '100%' }}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Group 1 (Slowest) */}
              <g>
                <animateTransform attributeName="transform" type="translate" from="0 0" to="-1600 0" dur="25s" repeatCount="indefinite" />
                <g>
                  <path d="M0,750 C400,600 1200,900 1600,750" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,700 C450,550 1150,850 1600,700" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,650 C500,500 1100,800 1600,650" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                </g>
                <g transform="translate(1600 0)">
                  <path d="M0,750 C400,600 1200,900 1600,750" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,700 C450,550 1150,850 1600,700" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,650 C500,500 1100,800 1600,650" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                </g>
              </g>

              {/* Group 2 */}
              <g>
                <animateTransform attributeName="transform" type="translate" from="0 0" to="-1600 0" dur="20s" repeatCount="indefinite" />
                <g>
                  <path d="M0,600 C550,450 1050,750 1600,600" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,550 C600,400 1000,700 1600,550" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,500 C650,350 950,650 1600,500" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                </g>
                <g transform="translate(1600 0)">
                  <path d="M0,600 C550,450 1050,750 1600,600" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,550 C600,400 1000,700 1600,550" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,500 C650,350 950,650 1600,500" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                </g>
              </g>

              {/* Group 3 (Densest) */}
              <g>
                <animateTransform attributeName="transform" type="translate" from="0 0" to="-1600 0" dur="15s" repeatCount="indefinite" />
                <g>
                  <path d="M0,450 C700,300 900,600 1600,450" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,420 C720,280 880,560 1600,420" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,390 C740,260 860,520 1600,390" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,360 C760,240 840,480 1600,360" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                </g>
                <g transform="translate(1600 0)">
                  <path d="M0,450 C700,300 900,600 1600,450" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,420 C720,280 880,560 1600,420" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,390 C740,260 860,520 1600,390" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,360 C760,240 840,480 1600,360" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                </g>
              </g>

              {/* Group 4 (Sparse) */}
              <g>
                <animateTransform attributeName="transform" type="translate" from="0 0" to="-1600 0" dur="30s" repeatCount="indefinite" />
                <g>
                  <path d="M0,250 C400,400 1200,100 1600,250" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,180 C450,350 1150,10 1600,180" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,100 C500,300 1100,-100 1600,100" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                </g>
                <g transform="translate(1600 0)">
                  <path d="M0,250 C400,400 1200,100 1600,250" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,180 C450,350 1150,10 1600,180" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                  <path d="M0,100 C500,300 1100,-100 1600,100" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" style={{ vectorEffect: 'non-scaling-stroke' }} />
                </g>
              </g>
            </svg>
          </div>

          {/* ---- Floating Health Icons (z-index: 2) ---- */}
          <div className="absolute left-[6%] top-[38%] w-14 h-14 bg-white rounded-2xl shadow-xl flex items-center justify-center pointer-events-none max-md:hidden" style={{ zIndex: 2, animation: 'float 5.5s ease-in-out infinite' }}>
            <HeartPulse size={24} className="text-red-500" />
          </div>
          <div className="absolute right-[7%] top-[28%] w-14 h-14 bg-white rounded-2xl shadow-xl flex items-center justify-center pointer-events-none max-md:hidden" style={{ zIndex: 2, animation: 'float 6.5s ease-in-out infinite', animationDelay: '1.5s' }}>
            <Stethoscope size={24} className="text-blue-500" />
          </div>
          <div className="absolute right-[8%] top-[62%] w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center pointer-events-none max-lg:hidden" style={{ zIndex: 2, animation: 'float 7s ease-in-out infinite', animationDelay: '3s' }}>
            <Clock3 size={20} className="text-purple-500" />
          </div>
          <div className="absolute left-[10%] top-[68%] w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center pointer-events-none max-lg:hidden" style={{ zIndex: 2, animation: 'float 6s ease-in-out infinite', animationDelay: '2s' }}>
            <Pill size={20} className="text-emerald-500" />
          </div>

          {/* ---- Hero Content (z-index: 3) ---- */}
          <div className="relative flex flex-col items-center text-center max-w-[900px] mx-auto px-5 pt-8 md:pt-12 pb-8" style={{ zIndex: 3 }}>
            {/* AI Badge */}
            <div
              className="hero-entrance-1 inline-flex items-center gap-2 px-4 py-[7px] rounded-full mb-8"
              style={{
                border: '1px solid rgba(37, 111, 255, 0.35)',
                background: 'rgba(37, 111, 255, 0.07)',
                color: '#2368e8',
              }}
            >
              <span className="material-symbols-outlined text-[16px]">show_chart</span>
              <span className="text-xs font-semibold tracking-wide">AI-Powered Health Intelligence</span>
            </div>

            {/* Heading */}
            <h1
              className="hero-entrance-2 font-extrabold leading-[0.98] tracking-[-0.045em] text-center"
              style={{
                maxWidth: '850px',
                color: '#0c172e',
                fontSize: 'clamp(48px, 5vw, 76px)',
              }}
            >
              Your Personal AI Health<br />Operating System
            </h1>

            {/* Description */}
            <p
              className="hero-entrance-3 text-center leading-relaxed mt-6"
              style={{
                maxWidth: '650px',
                color: 'rgba(40, 62, 94, 0.72)',
                fontSize: '17px',
                lineHeight: '1.55',
              }}
            >
              Monitor your health, chat with AI, track fitness, manage medications, analyze wellness trends, and improve your lifestyle—all in one intelligent platform.
            </p>

            {/* CTA Buttons */}
            <div className="hero-entrance-4 flex max-sm:flex-col items-center justify-center gap-3.5 mt-7">
              <button
                onClick={() => setShowLogin(true)}
                className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-8 py-3.5 rounded-full font-semibold shadow-lg shadow-blue-500/25 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/30 transition-all flex items-center gap-2 justify-center border-none cursor-pointer"
              >
                Get Started Free <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
              <button
                className="px-8 py-3.5 rounded-full font-semibold flex items-center gap-2 justify-center cursor-pointer transition-all hover:shadow-md border"
                style={{
                  background: 'rgba(255,255,255,0.75)',
                  backdropFilter: 'blur(12px)',
                  color: '#0c172e',
                  borderColor: 'rgba(255,255,255,0.8)',
                }}
              >
                <span className="material-symbols-outlined text-[20px] text-blue-600">play_circle</span>
                Watch Demo
              </button>
            </div>
          </div>

          {/* ---- Dashboard Preview (z-index: 5) ---- */}
          <div id="dashboard" className="hero-entrance-5 relative px-5 pb-16 md:pb-24" style={{ zIndex: 5, scrollMarginTop: '100px' }}>
            <div
              className="mx-auto"
              style={{
                width: 'min(980px, calc(100% - 40px))',
                padding: '24px',
                borderRadius: '32px',
                background: '#d6d9dd',
                boxShadow: '0 30px 60px rgba(0, 0, 0, 0.12), inset 0 2px 4px rgba(255, 255, 255, 0.5)',
              }}
            >
              {/* Top Row - 4 Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* Health Score */}
                <div className="bg-gradient-to-br from-[#1e88e5] to-[#26c6da] rounded-[24px] p-6 text-white relative shadow-sm text-left flex flex-col justify-between h-[160px]">
                  <div className="text-[14px] font-bold text-white/90">Health Score</div>
                  <div>
                    <div className="text-[52px] font-extrabold tracking-tighter leading-none mb-4">95<span className="text-[20px] font-semibold opacity-90 tracking-normal">/100</span></div>
                    <div className="w-full h-[6px] bg-white/30 rounded-full relative">
                      <div className="w-[95%] h-full bg-white rounded-full relative">
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white/50 rounded-full shadow"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Heart Rate */}
                <div className="bg-white rounded-[24px] p-6 shadow-sm relative text-left h-[160px] flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="text-[14px] font-bold text-[#a0aab8]">Heart Rate</div>
                    <HeartPulse size={20} strokeWidth={2.5} className="text-[#ff5252] opacity-90" />
                  </div>
                  <div>
                    <div className="text-[38px] font-extrabold text-[#111827] tracking-tight leading-none mb-3">72 <span className="text-[15px] text-[#9ca3af] font-semibold">bpm</span></div>
                    <div className="flex items-end gap-[6px] h-9 w-[80%]">
                      <div className="flex-1 bg-[#ffcdd2] h-[25%] rounded-sm"></div>
                      <div className="flex-1 bg-[#ef9a9a] h-[45%] rounded-sm"></div>
                      <div className="flex-1 bg-[#f44336] h-[75%] rounded-sm"></div>
                      <div className="flex-1 bg-[#ffcdd2] h-[40%] rounded-sm"></div>
                      <div className="flex-1 bg-[#ef5350] h-[55%] rounded-sm"></div>
                      <div className="flex-1 bg-[#ffcdd2] h-[30%] rounded-sm"></div>
                    </div>
                  </div>
                </div>

                {/* Sleep */}
                <div className="bg-white rounded-[24px] p-6 shadow-sm relative text-left h-[160px] flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="text-[14px] font-bold text-[#a0aab8]">Sleep</div>
                    <Moon size={20} strokeWidth={2.5} className="text-[#8b5cf6] opacity-90" />
                  </div>
                  <div>
                    <div className="text-[38px] font-extrabold text-[#111827] tracking-tight leading-none mb-4">7h 42m</div>
                    <div className="text-[12px] font-semibold text-[#9ca3af]">Deep sleep 32% · Quality 88%</div>
                  </div>
                </div>

                {/* Steps & Calories */}
                <div className="bg-white rounded-[24px] p-6 shadow-sm text-left h-[160px] flex flex-col justify-between">
                  <div className="flex items-center gap-3">
                    <Footprints size={22} className="text-[#10b981]" strokeWidth={2.5} />
                    <div>
                      <div className="text-[22px] font-extrabold text-[#111827] leading-none mb-1">9,482</div>
                      <div className="text-[12px] font-semibold text-[#9ca3af]">Daily steps</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Flame size={22} className="text-[#f97316]" strokeWidth={2.5} />
                    <div>
                      <div className="text-[22px] font-extrabold text-[#111827] leading-none mb-1">612 kcal</div>
                      <div className="text-[12px] font-semibold text-[#9ca3af]">Calories burned</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row - 3 Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* AI Assistant */}
                <div className="bg-white rounded-[24px] p-6 shadow-sm text-left min-h-[140px]">
                  <div className="flex items-center gap-2 mb-4">
                    <Bot size={18} className="text-[#3b82f6]" strokeWidth={2.5} />
                    <span className="text-[14px] font-bold text-[#a0aab8]">AI Assistant</span>
                  </div>
                  <div className="bg-[#f0f4f8] rounded-xl px-5 py-4">
                    <p className="text-[14px] font-semibold text-[#1e293b] leading-relaxed">Your recovery looks great today. Ready for a 30-minute run?</p>
                  </div>
                </div>

                {/* Medicine Reminder */}
                <div className="bg-white rounded-[24px] p-6 shadow-sm text-left min-h-[140px]">
                  <div className="flex items-center gap-2 mb-4">
                    <Pill size={18} className="text-[#10b981]" strokeWidth={2.5} />
                    <span className="text-[14px] font-bold text-[#a0aab8]">Medicine Reminder</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-[#ecfdf5] rounded-xl px-4 py-3 border-none">
                      <span className="text-[13px] font-bold text-[#065f46]">Vitamin D · 8:00 AM</span>
                      <Check size={18} className="text-[#10b981]" strokeWidth={3} />
                    </div>
                    <div className="flex items-center justify-between bg-[#f8fafc] rounded-xl px-4 py-3 border-none">
                      <span className="text-[13px] font-bold text-[#475569]">Omega-3 · 9:00 PM</span>
                      <Bell size={18} className="text-[#cbd5e1]" strokeWidth={2.5} />
                    </div>
                  </div>
                </div>

                {/* Weekly Analytics */}
                <div className="bg-white rounded-[24px] p-6 shadow-sm text-left min-h-[140px] flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 size={18} className="text-[#06b6d4]" strokeWidth={2.5} />
                    <span className="text-[14px] font-bold text-[#a0aab8]">Weekly Analytics</span>
                  </div>
                  <div className="flex items-end gap-[8px] h-[45px] w-full px-1">
                    <div className="flex-1 bg-[#a5f3fc] h-[40%] rounded-sm"></div>
                    <div className="flex-1 bg-[#67e8f9] h-[60%] rounded-sm"></div>
                    <div className="flex-1 bg-[#a5f3fc] h-[50%] rounded-sm"></div>
                    <div className="flex-1 bg-[#22d3ee] h-[75%] rounded-sm"></div>
                    <div className="flex-1 bg-[#67e8f9] h-[65%] rounded-sm"></div>
                    <div className="flex-1 bg-[#06b6d4] h-[95%] rounded-sm"></div>
                    <div className="flex-1 bg-[#67e8f9] h-[55%] rounded-sm"></div>
                  </div>
                  <div className="text-[13px] text-[#10b981] font-bold mt-4">+18% activity vs. last week</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== FEATURES SECTION ========== */}
        <section id="features" className="py-24 px-6 md:px-10 bg-white dark:bg-slate-900 transition-colors duration-300">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16 reveal-on-scroll opacity-0 translate-y-12 transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]">
              <div className="text-blue-600 dark:text-blue-400 font-bold tracking-widest text-sm mb-4 uppercase">Features</div>
              <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-4">Everything your health needs, in one place</h2>
              <p className="text-lg text-slate-500 dark:text-slate-400">Six intelligent modules working together to keep you healthier, every single day.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: 'smart_toy', color: 'blue', colorHex: 'blue-600', bgHex: 'blue-100', title: 'AI Health Assistant', desc: 'Smart medical guidance with conversational AI chat for personalized recommendations tuned to your body.' },
                { icon: 'monitor_heart', color: 'red', colorHex: 'red-500', bgHex: 'red-100', title: 'Health Monitoring', desc: 'Track heart rate, blood pressure, sleep, oxygen levels, and daily wellness in real time.' },
                { icon: 'fitness_center', color: 'green', colorHex: 'green-500', bgHex: 'green-100', title: 'AI Fitness Coach', desc: 'Personalized workout plans, step tracking, calorie insights, and goal monitoring that adapts to you.' },
                { icon: 'coronavirus', color: 'purple', colorHex: 'purple-600', bgHex: 'purple-100', title: 'Symptom Checker', desc: 'Instantly check your symptoms with our AI triage system to know when you should see a doctor.' },
                { icon: 'restaurant', color: 'cyan', colorHex: 'cyan-600', bgHex: 'cyan-100', title: 'Nutrition Planner', desc: 'Log meals and get AI-generated nutrition plans designed to help you hit your optimal macros.' },
                { icon: 'folder_managed', color: 'orange', colorHex: 'orange-500', bgHex: 'orange-100', title: 'Medical Records', desc: 'Securely store, organize and analyze all your blood tests, MRI scans, and doctors notes.' }
              ].map((f, i) => (
                <div key={i} className={`bg-slate-50 dark:bg-slate-800 rounded-[24px] p-8 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-shadow reveal-on-scroll opacity-0 translate-y-12 transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]`}>
                  <div className={`w-14 h-14 rounded-2xl bg-${f.bgHex} flex items-center justify-center text-${f.colorHex} mb-6`}>
                    <span className="material-symbols-outlined text-[28px]">{f.icon}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{f.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========== STATS / PROOF ========== */}
        <section id="stats" className="py-24 px-6 md:px-10 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-12 reveal-on-scroll opacity-0 translate-y-12 transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]">Why choose LifeOS</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { val: '98%', label: 'AI Accuracy', color: 'cyan-500' },
                { val: '10x', label: 'Faster Insights', color: 'blue-600' },
                { val: 'Smart', label: 'Symptom Analyzer', color: 'blue-500' },
                { val: '24/7', label: 'AI Support', color: 'blue-400' }
              ].map((s, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm reveal-on-scroll opacity-0 translate-y-12 transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]">
                  <div className={`text-5xl font-extrabold text-${s.color} mb-2`}>{s.val}</div>
                  <div className="text-slate-500 dark:text-slate-400 font-semibold">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========== HOW IT WORKS ========== */}
        <section id="how-it-works" className="py-24 px-6 md:px-10 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 transition-colors duration-300">
          <div className="max-w-7xl mx-auto text-center">
            <div className="reveal-on-scroll opacity-0 translate-y-12 transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]">
              <div className="text-blue-600 dark:text-blue-400 font-bold tracking-widest text-sm mb-4 uppercase">How it works</div>
              <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-16">Healthier in four simple steps</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
              <div className="hidden md:block absolute top-8 left-12 right-12 h-0.5 bg-slate-100 dark:bg-slate-800 z-0"></div>
              {[
                { step: 1, color: 'blue-600', shadow: 'blue-500/30', title: 'Connect your health data', desc: 'Sync wearables, apps, and records in minutes.' },
                { step: 2, color: 'blue-500', shadow: 'blue-500/30', title: 'AI analyzes your wellness', desc: 'Patterns and risks surface automatically.' },
                { step: 3, color: 'cyan-500', shadow: 'cyan-500/30', title: 'Receive recommendations', desc: 'Clear, actionable guidance daily.' },
                { step: 4, color: 'teal-500', shadow: 'teal-500/30', title: 'Improve every day', desc: 'Watch your health score climb over time.' }
              ].map((s, i) => (
                <div key={i} className="relative z-10 flex flex-col items-center reveal-on-scroll opacity-0 translate-y-12 transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]">
                  <div className={`w-16 h-16 rounded-full bg-${s.color} text-white flex items-center justify-center text-2xl font-bold mb-6 shadow-lg shadow-${s.shadow}`}>{s.step}</div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{s.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========== TESTIMONIALS ========== */}
        <section id="testimonials" className="py-24 px-6 md:px-10 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 transition-colors duration-300">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16 reveal-on-scroll opacity-0 translate-y-12 transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]">
              <div className="text-blue-600 dark:text-blue-400 font-bold tracking-widest text-sm mb-4 uppercase">Testimonials</div>
              <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-4">Trusted by people taking their health seriously</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-900 rounded-[24px] p-8 shadow-sm border border-slate-100 dark:border-slate-800 reveal-on-scroll opacity-0 translate-y-12 transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]">
                <div className="flex gap-1 text-amber-400 mb-4">
                  {[1, 2, 3, 4, 5].map(j => <span key={j} className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>)}
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-6">"The UI is incredibly clean and intuitive. As a product designer, I appreciate how effortlessly it presents complex health data without overwhelming the user."</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm">RS</div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">Ridhham Solanki</div>
                    <div className="text-slate-400 text-xs">Product Designer</div>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-[24px] p-8 shadow-sm border border-slate-100 dark:border-slate-800 reveal-on-scroll opacity-0 translate-y-12 transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]">
                <div className="flex gap-1 text-amber-400 mb-4">
                  {[1, 2, 3, 4, 5].map(j => <span key={j} className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>)}
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-6">"The architecture behind this app is solid. Everything from the medication reminders to the seamless background syncing works flawlessly."</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center text-white font-bold text-sm">GP</div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">Gaurav Patel</div>
                    <div className="text-slate-400 text-xs">Software Engineer</div>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-[24px] p-8 shadow-sm border border-slate-100 dark:border-slate-800 reveal-on-scroll opacity-0 translate-y-12 transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]">
                <div className="flex gap-1 text-amber-400 mb-4">
                  {[1, 2, 3, 4, 5].map(j => <span key={j} className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>)}
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-6">"The accuracy of the AI triage models is genuinely impressive. It takes a lot of fine-tuning to provide this level of personalized insights."</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm">DP</div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">Dhruv Patel</div>
                    <div className="text-slate-400 text-xs">AI Engineer</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ========== FOOTER ========== */}
      <footer id="about-us" className="bg-slate-900 dark:bg-black py-16 px-6 md:px-10 text-slate-400 transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white overflow-hidden">
              {settings?.site_logo ? (
                <img src={settings.site_logo} alt="Logo" className="w-full h-full object-contain bg-white dark:bg-transparent" />
              ) : (
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
              )}
            </div>
            <div className="text-xl font-bold text-white tracking-tight">LifeOS</div>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium">
            {settings?.privacy_url && (
              <a className="text-slate-300 hover:text-white transition-colors" href={settings.privacy_url} target="_blank" rel="noopener noreferrer">Privacy Policy</a>
            )}
            {settings?.terms_url && (
              <a className="text-slate-300 hover:text-white transition-colors" href={settings.terms_url} target="_blank" rel="noopener noreferrer">Terms of Service</a>
            )}
            {settings?.cookie_url && (
              <a className="text-slate-300 hover:text-white transition-colors" href={settings.cookie_url} target="_blank" rel="noopener noreferrer">Cookie Policy</a>
            )}
          </div>
          <div className="flex gap-4 items-center text-sm font-medium">
            {settings?.social_facebook && (
              <a href={settings.social_facebook} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white transition-colors">Facebook</a>
            )}
            {settings?.social_twitter && (
              <a href={settings.social_twitter} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white transition-colors">Twitter / X</a>
            )}
            {settings?.social_instagram && (
              <a href={settings.social_instagram} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white transition-colors">Instagram</a>
            )}
          </div>
          <div className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} LifeOS. All rights reserved.
          </div>
        </div>
      </footer>

      <LandingChatbot />
      <LoginModal show={showLogin} onClose={() => setShowLogin(false)} />
    </div>
    </div>
  );
};

export default LandingPage;
