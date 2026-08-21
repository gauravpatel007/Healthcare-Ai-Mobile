import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import API from '../utils/api';
import { toast } from 'react-hot-toast';
import { Trophy, Flame, Medal, Target, Users, Star, Activity, Pill, Footprints, Utensils, Moon, Dumbbell, Droplets } from 'lucide-react';
import { useLang } from '../contexts/LangContext';

export default function GamificationTab() {
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [showMoreLeaderboard, setShowMoreLeaderboard] = useState(false);
  const [zoomAvatarUrl, setZoomAvatarUrl] = useState(null);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [selectedLeaderboardUser, setSelectedLeaderboardUser] = useState(null);

  useEffect(() => {
    fetchGamificationData();
  }, []);

  const fetchGamificationData = async () => {
    try {
      const [dashRes, leadRes, challRes] = await Promise.all([
        API.get('/gamification/dashboard'),
        API.get('/gamification/leaderboard'),
        API.get('/gamification/challenges')
      ]);

      if (dashRes.error) throw new Error(dashRes.error);
      if (leadRes.error) throw new Error(leadRes.error);

      setDashboard(dashRes);
      setLeaderboard(leadRes.leaderboard || []);
      setCurrentUserRank(leadRes.current_user_rank);
      setChallenges(challRes.challenges || []);
    } catch (e) {
      console.error("Error fetching gamification data:", e);
      toast.error(`Error: ${e.message || "Failed to load Gamification data"}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-bold animate-pulse">Loading Gamification...</p>
      </div>
    );
  }

  if (!dashboard) return null;

  const xpPercent = Math.min(100, (dashboard.xp / dashboard.next_level_xp) * 100);

  const getStreakIcon = (key) => {
    switch (key) {
      case 'medication': return <Pill className="w-6 h-6 stroke-[2]" style={{ color: 'currentColor' }} />;
      case 'workout': return <Dumbbell className="w-6 h-6 stroke-[2]" style={{ color: 'currentColor' }} />;
      case 'steps': return <Footprints className="w-6 h-6 stroke-[2]" style={{ color: 'currentColor' }} />;
      case 'nutrition': return <Flame className="w-6 h-6 stroke-[2]" style={{ color: 'currentColor' }} />;
      case 'sleep': return <Moon className="w-6 h-6 stroke-[2]" style={{ color: 'currentColor' }} />;
      default: return <Flame className="w-6 h-6 stroke-[2]" style={{ color: 'currentColor' }} />;
    }
  };

  const getStreakLabel = (key) => {
    const labels = {
      medication: 'Medication',
      workout: 'Workout Goal',
      steps: 'Daily Steps',
      nutrition: 'Daily Calories',
      sleep: 'Sleep Goal'
    };
    return labels[key] || key;
  };

  const getStreakColor = (key) => {
    switch (key) {
      case 'medication': return 'bg-rose-500 text-rose-500';
      case 'workout': return 'bg-emerald-500 text-emerald-500';
      case 'steps': return 'bg-amber-500 text-amber-500';
      case 'nutrition': return 'bg-cyan-500 text-cyan-500';
      case 'sleep': return 'bg-indigo-500 text-indigo-500';
      default: return 'bg-blue-500 text-blue-500';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up relative">
      {zoomAvatarUrl && (
        <div className="fixed inset-0 bg-black/85 z-[9999] flex items-center justify-center cursor-zoom-out backdrop-blur-sm transition-opacity" onClick={() => setZoomAvatarUrl(null)}>
          <img src={`http://localhost:8000${zoomAvatarUrl}`} alt="Avatar Zoom" className="max-w-[90vw] max-h-[90vh] rounded-3xl object-contain shadow-2xl" />
          <div className="absolute top-6 right-8 text-white text-4xl font-light hover:text-gray-300 transition-colors">&times;</div>
        </div>
      )}

      {/* XP & Level Header */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-[2rem] p-6 lg:p-8 shadow-sm border border-amber-100 dark:border-amber-800/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

        <div className="flex items-center gap-6 relative z-10">
          <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full shadow-lg flex flex-col items-center justify-center text-white border-4 border-white dark:border-gray-800 shrink-0">
            <span className="text-sm font-bold opacity-90 uppercase tracking-wider">Level</span>
            <span className="text-4xl font-extrabold leading-none">{dashboard.level}</span>
          </div>

          <div className="flex-1 w-full">
            <div className="flex justify-between items-end mb-2">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  {dashboard.nickname}
                  {currentUserRank === 1 && (
                    <img src="/trophy.png" alt="Champion Trophy" className="w-6 h-6 ml-1 drop-shadow-md transform hover:scale-110 hover:-rotate-6 transition-all duration-300 cursor-default" title="Current Champion" />
                  )}
                </h2>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mt-1">Keep it up! You need {dashboard.next_level_xp - dashboard.xp} XP to reach Level {dashboard.level + 1}.</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-amber-600 dark:text-amber-400">{dashboard.xp}</span>
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400 ml-1">XP</span>
              </div>
            </div>

            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner w-full">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-1000 ease-out relative"
                style={{ width: `${xpPercent}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Streaks & Badges */}
        <div className="lg:col-span-2 space-y-6">

          {/* Active Streaks */}
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-500">
                <Flame className="w-5 h-5 fill-rose-500" />
              </div>
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Active Streaks</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {['workout', 'steps', 'nutrition', 'medication', 'sleep'].map((key) => {
                const streak = dashboard.streaks[key];
                if (!streak) return null;
                const colorClass = getStreakColor(key);
                return (
                  <div key={key} className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 relative overflow-hidden group flex flex-col justify-between h-full cursor-pointer focus:outline-none">
                    {/* Background shape matching Dashboard Overview */}
                    <div className={`absolute top-0 right-0 w-32 h-32 ${colorClass.split(' ')[0]} opacity-10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110`}></div>

                    <div className="flex items-start justify-between relative z-10 mb-4">
                      <div>
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1 tracking-wide uppercase">{getStreakLabel(key)}</p>
                        <div className="flex items-baseline gap-1.5">
                          <h3 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
                            {streak.current}
                          </h3>
                          <span className="text-sm font-bold text-gray-400">days</span>
                        </div>
                      </div>

                      <div className={`p-4 ${colorClass.split(' ')[0]} bg-opacity-10 dark:bg-opacity-20 rounded-2xl shadow-sm transition-transform duration-300 ease-out group-hover:scale-125`}>
                        <div className={colorClass.split(' ')[1]}>
                          {getStreakIcon(key)}
                        </div>
                      </div>
                    </div>

                    <div className="relative z-10 mt-auto">
                      {streak.current > 0 ? (
                        <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wide flex items-center gap-1">
                          <Flame className="w-3 h-3 fill-rose-500" /> on fire!
                        </div>
                      ) : (
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                          Best: {streak.best}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Badges */}
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-500">
                <Medal className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Badges & Achievements</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {dashboard.badges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex flex-col items-center text-center group cursor-pointer"
                  onClick={() => setSelectedBadge(badge)}
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-3 shadow-sm transition-transform duration-300 group-hover:scale-110 ${badge.earned ? 'bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/40 border-2 border-amber-300 dark:border-amber-600' : 'bg-gray-100 dark:bg-gray-800 opacity-50 grayscale'}`}>
                    {badge.icon}
                  </div>
                  <span className={`text-xs font-bold ${badge.earned ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                    {badge.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Community Challenges */}
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-500">
                  <Target className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Community Challenges</h3>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-full">{challenges.length} Active</span>
            </div>

            <div className="space-y-4">
              {challenges.map((c) => {
                const progressPct = Math.min(100, (c.user_progress / c.target) * 100);
                return (
                  <div key={c.id} className="p-4 rounded-2xl border border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-lg">
                          {c.icon}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">{c.title}</h4>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Users className="w-3 h-3" /> {c.participants.toLocaleString()} participants
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-gray-900 dark:text-white">{(c.user_progress).toLocaleString()}</span>
                        <span className="text-xs font-medium text-gray-500"> / {c.target.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${progressPct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${progressPct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column: Leaderboard */}
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col self-start">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-500">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Leaderboard</h3>
                <p className="text-xs font-medium text-gray-500 mt-0.5">Top community members by XP</p>
              </div>
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            <div className="space-y-2">
              {leaderboard.slice(0, showMoreLeaderboard ? 20 : 10).map((user) => (
                <div
                  key={user.rank}
                  onClick={() => setSelectedLeaderboardUser(user)}
                  className={`flex items-center p-3 rounded-2xl transition-colors cursor-pointer ${user.is_current ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/50' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                >
                  <div className="w-8 text-center font-bold text-gray-400 flex-shrink-0">
                    {user.rank === 1 ? <span className="text-amber-500 text-lg">🥇</span> :
                      user.rank === 2 ? <span className="text-gray-400 text-lg">🥈</span> :
                        user.rank === 3 ? <span className="text-amber-700 text-lg">🥉</span> :
                          <span className="text-sm">{user.rank}</span>}
                  </div>

                  <div
                    className={`w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900/40 dark:to-blue-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-sm mx-3 flex-shrink-0 overflow-hidden shadow-sm ${user.avatar_url ? 'hover:ring-2 hover:ring-indigo-300 transition-all' : ''}`}
                    onClick={(e) => {
                      if (user.avatar_url) {
                        e.stopPropagation();
                        setZoomAvatarUrl(user.avatar_url);
                      }
                    }}
                  >
                    {user.avatar_url ? (
                      <img src={`http://localhost:8000${user.avatar_url}`} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      user.nickname.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${user.is_current ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                      {user.nickname} {user.is_current && "(You)"}
                    </p>
                    <p className="text-xs font-medium text-gray-500">Level {user.level}</p>
                  </div>

                  <div className="text-right flex-shrink-0 ml-2">
                    <span className={`text-sm font-extrabold ${user.is_current ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`}>{user.xp.toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-gray-400 ml-1">XP</span>
                  </div>
                </div>
              ))}
            </div>

            {!showMoreLeaderboard && leaderboard.length > 10 && (
              <button
                onClick={() => setShowMoreLeaderboard(true)}
                className="w-full mt-4 py-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
              >
                See {Math.min(10, leaderboard.length - 10)} more
              </button>
            )}
          </div>

          {currentUserRank && currentUserRank > 15 && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/50">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center font-bold text-gray-500 text-sm">{currentUserRank}</span>
                  <div className="w-10 h-10 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-200 font-bold text-sm">You</div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">{dashboard.xp.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-gray-400 ml-1">XP</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Profile Modal */}
      {selectedLeaderboardUser && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedLeaderboardUser(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col transform transition-all p-8 text-center relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full transition-colors" onClick={() => setSelectedLeaderboardUser(null)}>
              <div className="text-2xl font-light">&times;</div>
            </button>

            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900/40 dark:to-blue-900/40 flex items-center justify-center text-4xl mb-4 shadow-md overflow-hidden text-indigo-600 dark:text-indigo-300 font-bold">
              {selectedLeaderboardUser.avatar_url ? (
                <img src={`http://localhost:8000${selectedLeaderboardUser.avatar_url}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                selectedLeaderboardUser.nickname.charAt(0).toUpperCase()
              )}
            </div>

            <h3 className="text-2xl font-extrabold mb-1 text-gray-900 dark:text-white">
              {selectedLeaderboardUser.name !== "Unknown" ? selectedLeaderboardUser.name : selectedLeaderboardUser.nickname}
            </h3>
            <p className="text-sm font-medium text-indigo-500 dark:text-indigo-400 mb-6">
              Level {selectedLeaderboardUser.level} • {selectedLeaderboardUser.xp.toLocaleString()} XP
            </p>

            <div className="space-y-4 text-left bg-gray-50 dark:bg-gray-700/50 p-5 rounded-2xl">
              <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-600 pb-3">
                <span className="text-sm text-gray-500 dark:text-gray-400 font-bold">Email</span>
                <span className="text-sm text-gray-900 dark:text-white font-medium">{selectedLeaderboardUser.email}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-600 pb-3">
                <span className="text-sm text-gray-500 dark:text-gray-400 font-bold">Age</span>
                <span className="text-sm text-gray-900 dark:text-white font-medium">{selectedLeaderboardUser.age}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400 font-bold">Gender</span>
                <span className="text-sm text-gray-900 dark:text-white font-medium capitalize">{selectedLeaderboardUser.gender}</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Badge Details Modal */}
      {selectedBadge && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedBadge(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col transform transition-all p-8 text-center relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full transition-colors" onClick={() => setSelectedBadge(null)}>
              <div className="text-2xl font-light">&times;</div>
            </button>

            <div className={`w-28 h-28 mx-auto rounded-3xl flex items-center justify-center text-6xl mb-6 shadow-lg ${selectedBadge.earned ? 'bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/40 border-4 border-amber-300 dark:border-amber-600' : 'bg-gray-100 dark:bg-gray-700 opacity-50 grayscale'}`}>
              {selectedBadge.icon}
            </div>

            <h3 className={`text-2xl font-extrabold mb-2 ${selectedBadge.earned ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
              {selectedBadge.name}
            </h3>

            <p className="text-gray-600 dark:text-gray-300 font-medium mb-4">
              {selectedBadge.desc}
            </p>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between items-center text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">
                <span>Progress</span>
                <span>{selectedBadge.progress.toLocaleString()} / {selectedBadge.target.toLocaleString()}</span>
              </div>
              <div className="h-2.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${selectedBadge.earned ? 'bg-amber-400' : 'bg-indigo-500'}`}
                  style={{ width: `${Math.min(100, (selectedBadge.progress / selectedBadge.target) * 100)}%` }}
                ></div>
              </div>
            </div>

            <div className={`py-3 px-6 rounded-xl font-bold text-sm inline-block ${selectedBadge.earned ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
              {selectedBadge.earned ? '🏆 Badge Earned!' : '🔒 Locked'}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
