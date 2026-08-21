import { useState, useEffect } from 'react';
import { 
  Users, Activity, Bot, Cpu, Calendar, AlertTriangle, Pill, RefreshCcw,
  Stethoscope, FileText, Droplets, SmilePlus, Dumbbell, Salad, Clock, Zap,
  XCircle, Coins, TrendingUp, UserPlus, Wifi, BarChart3, Globe, ThumbsUp, Shield, Lock
} from 'lucide-react';
import API from '../../utils/api';

/* ─── Reusable Card (EXACT same design as Overview) ──────────── */
const StatCard = ({ title, value, subtitle, icon: Icon, colorClass, onClick }) => (
  <div 
    onClick={onClick}
    tabIndex={0}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e); } }}
    className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 relative overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
  >
    <div className={`absolute top-0 right-0 w-32 h-32 ${colorClass} opacity-10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110`}></div>
    <div className="flex items-start justify-between relative z-10">
      <div>
        <p className="text-sm font-bold text-gray-500 mb-1 tracking-wide uppercase">{title}</p>
        <h3 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{value}</h3>
      </div>
      <div className={`p-4 ${colorClass} bg-opacity-10 rounded-2xl shadow-sm`}>
        <Icon className="w-7 h-7" style={{ color: 'currentColor' }} />
      </div>
    </div>
    <div className="mt-5 flex items-center text-sm">
      <span className="font-semibold text-gray-400 bg-gray-50 dark:bg-gray-900 px-3 py-1 rounded-full">
        {subtitle}
      </span>
    </div>
  </div>
);

/* ─── Section Header ─────────────────────────────────────────── */
const SectionHeader = ({ title, subtitle }) => (
  <div className="flex items-center gap-3 mb-2 mt-8">
    <div className="w-1.5 h-8 bg-gradient-to-b from-indigo-500 to-cyan-400 rounded-full"></div>
    <div>
      <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">{title}</h2>
      {subtitle && <p className="text-gray-400 text-sm font-medium">{subtitle}</p>}
    </div>
  </div>
);

const AdminAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await API.get('/admin/analytics/detailed');
      setData(res);
    } catch (error) {
      console.error("Failed to fetch detailed analytics:", error);
      // Fallback structure
      setData({
        demographics: { dau: 0, mau: 0, retention_rate: 0, gender: {}, age_groups: {}, languages: {} },
        ai_performance: { modules: [], daily_queries: 0, weekly_queries: 0, feedback_score: 0, avg_response_time: 0 },
        health_outcomes: { sleep_completion: 0, workout_completion: 0, medication_adherence_count: 0, top_symptoms: [] },
        feature_adoption: { medical_records: 0, emergency_sos: 0, family_profiles: 0 },
        security: { failed_logins: 0, blocked_ips: 0, api_errors: 0 }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading || !data) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const { demographics, ai_performance, health_outcomes, feature_adoption, security } = data;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* ── Header ─────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-visible w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <BarChart3 className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              Detailed Analytics
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              Deep dive into usage, performance, and outcomes.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 relative z-10 shrink-0 ml-auto pr-2 flex-wrap">
          <button onClick={fetchAnalytics} className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shadow-sm">
            <RefreshCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 1. User & Demographic Analytics */}
      <SectionHeader title="User & Demographic Analytics" subtitle="Understanding who uses the platform and how often." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Daily Active (DAU)" value={demographics.dau.toLocaleString()} subtitle="Logged in today" icon={Activity} colorClass="bg-cyan-500" />
        <StatCard title="Monthly Active (MAU)" value={demographics.mau.toLocaleString()} subtitle="Active last 30 days" icon={Users} colorClass="bg-pink-500" />
        <StatCard title="Retention Rate" value={`${demographics.retention_rate}%`} subtitle="MAU / Total Users" icon={TrendingUp} colorClass="bg-emerald-500" />
      </div>

      {/* 2. AI Usage & Performance */}
      <SectionHeader title="AI Usage & Performance" subtitle="How effectively the AI is serving users." />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Daily Queries" value={ai_performance.daily_queries.toLocaleString()} subtitle="Requests today" icon={Bot} colorClass="bg-purple-500" />
        <StatCard title="Weekly Queries" value={ai_performance.weekly_queries.toLocaleString()} subtitle="Requests this week" icon={Zap} colorClass="bg-amber-500" />
        <StatCard title="AI Feedback" value={`${ai_performance.feedback_score}%`} subtitle="Thumbs up ratio" icon={ThumbsUp} colorClass="bg-emerald-500" />
        <StatCard title="Avg Response" value={`${ai_performance.avg_response_time}ms`} subtitle="Processing speed" icon={Clock} colorClass="bg-rose-500" />
      </div>

      {/* 3. Health Outcomes & Engagement */}
      <SectionHeader title="Health Outcomes & Engagement" subtitle="Goal completions and tracking consistency." />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Sleep Goals" value={`${health_outcomes.sleep_completion}%`} subtitle="Users completing" icon={SmilePlus} colorClass="bg-cyan-500" />
        <StatCard title="Workout Completion" value={`${data.health_outcomes.workout_completion}%`} subtitle="Logged a workout" icon={Dumbbell} colorClass="bg-orange-500" />
        <StatCard title="Meds Adherence" value={health_outcomes.medication_adherence_count.toLocaleString()} subtitle="Logs recorded" icon={Pill} colorClass="bg-rose-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-extrabold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Stethoscope className="text-rose-500 w-5 h-5" /> Top Symptoms Checked
          </h3>
          {health_outcomes.top_symptoms.length > 0 ? (
            <div className="space-y-3">
              {health_outcomes.top_symptoms.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center font-extrabold text-sm">{i + 1}</span>
                    <span className="font-bold text-gray-700 dark:text-gray-300">{s.name}</span>
                  </div>
                  <span className="text-sm font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-3 py-1 rounded-full">{s.count}</span>
                </div>
              ))}
            </div>
          ) : (
             <p className="text-gray-400 font-medium text-sm">No symptom data yet.</p>
          )}
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-extrabold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Bot className="text-purple-500 w-5 h-5" /> AI Modules Used
          </h3>
          {ai_performance.modules.length > 0 ? (
            <div className="space-y-3">
              {ai_performance.modules.map((m, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center font-extrabold text-sm">{i + 1}</span>
                    <span className="font-bold text-gray-700 dark:text-gray-300 capitalize">{m.name}</span>
                  </div>
                  <span className="text-sm font-bold bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-3 py-1 rounded-full">{m.usage}</span>
                </div>
              ))}
            </div>
          ) : (
             <p className="text-gray-400 font-medium text-sm">No module data yet.</p>
          )}
        </div>
      </div>

      {/* 4. Feature Adoption */}
      <SectionHeader title="Feature Adoption" subtitle="Which platform features are utilized." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Medical Records" value={feature_adoption.medical_records.toLocaleString()} subtitle="Files uploaded" icon={FileText} colorClass="bg-cyan-500" />
        <StatCard title="Emergency SOS" value={feature_adoption.emergency_sos.toLocaleString()} subtitle="Contacts configured" icon={AlertTriangle} colorClass="bg-rose-500" />
        <StatCard title="Family Profiles" value={feature_adoption.family_profiles.toLocaleString()} subtitle="Members managed" icon={Users} colorClass="bg-emerald-500" />
      </div>

      {/* 5. System Security & Health */}
      <SectionHeader title="System Security & Health" subtitle="Monitoring the safety of the application." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Failed Logins" value={security.failed_logins.toLocaleString()} subtitle="Unsuccessful attempts" icon={Lock} colorClass="bg-rose-500" />
        <StatCard title="Blocked IPs" value={security.blocked_ips.toLocaleString()} subtitle="Restricted access" icon={Shield} colorClass="bg-orange-500" />
        <StatCard title="API Error Rate" value={`${security.api_errors}%`} subtitle="Estimated failure rate" icon={XCircle} colorClass="bg-purple-500" />
      </div>

    </div>
  );
};

export default AdminAnalytics;
