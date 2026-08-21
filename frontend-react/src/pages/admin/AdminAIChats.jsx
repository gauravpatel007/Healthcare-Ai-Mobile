import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { 
  ThumbsUp, BarChart2, Users, Activity, Bot
} from 'lucide-react';
import CustomSelect from '../../components/ui/CustomSelect';

export default function AdminAIChats() {
  const [chats, setChats] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  
  // Expanded row
  const [expandedChatId, setExpandedChatId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [moduleFilter, search]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const stats = await api.getAdminChatAnalytics();
      setAnalytics(stats);
      
      const chatList = await api.getAdminChats(moduleFilter, search, 100);
      setChats(chatList || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const handleFlag = async (id, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      await api.flagAdminChat(id, newStatus);
      setChats(chats.map(c => c.id === id ? { ...c, is_flagged: newStatus } : c));
    } catch(e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Delete this chat message permanently?")) return;
    try {
      await api.deleteAdminChat(id);
      setChats(chats.filter(c => c.id !== id));
      // Refresh analytics softly
      if(analytics) {
        setAnalytics({...analytics, total_chats: Math.max(0, analytics.total_chats - 1)});
      }
    } catch(e) { console.error(e); }
  };

  return (
    <div className="space-y-6">
      
      {/* Analytics KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard title="Total AI Chats" value={analytics.total_chats} icon={MessageSquare} color="blue" />
          <KPICard title="Avg Chat Length" value={analytics.avg_length} suffix="msgs" icon={Activity} color="indigo" />
          <KPICard title="Success Rate" value={analytics.success_rate} suffix="%" icon={ThumbsUp} color="emerald" />
          <KPICard title="User Satisfaction" value={analytics.user_satisfaction} suffix="/ 5" icon={Users} color="amber" />
        </div>
      )}

      {/* Main Container */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-[600px]">
        
        {/* Header / Filters */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" /> AI Conversation Logs
          </h2>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" placeholder="Search message content..." 
                value={search} onChange={e => setSearch(e.target.value)}
                onBlur={fetchData}
                onKeyDown={e => e.key === 'Enter' && fetchData()}
                className="pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 w-64"
              />
            </div>
            <CustomSelect
              value={moduleFilter}
              onChange={e => setModuleFilter(e.target.value)}
              options={[
                { value: "all", label: "All Modules" },
                { value: "assistant", label: "Medical Assistant" },
                { value: "symptom", label: "Symptom Checker" },
                { value: "fitness", label: "Fitness Coach" },
                { value: "nutrition", label: "Diet Planner" },
                { value: "mental", label: "Mental Health" },
                { value: "report_parser", label: "Scan Analyzer" }
              ]}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 font-medium py-[8px]"
            />
          </div>
        </div>

        {/* Chats Table/List */}
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4">
          {loading ? (
            <div className="flex justify-center p-8 text-gray-400">Loading chat logs...</div>
          ) : chats.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-full text-gray-400">
              <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
              <p>No chat logs found matching your criteria.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {chats.map(chat => (
                <div key={chat.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden flex flex-col">
                  
                  {/* Chat Summary Row */}
                  <div 
                    onClick={() => setExpandedChatId(expandedChatId === chat.id ? null : chat.id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:bg-gray-900 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 overflow-hidden">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        chat.role === 'assistant' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {chat.role === 'assistant' ? <Bot className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900 dark:text-white">{chat.role === 'assistant' ? 'AI Assistant' : chat.user_name}</span>
                          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                            {chat.module}
                          </span>
                          {chat.is_flagged && (
                            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 rounded-lg flex items-center gap-1">
                              <Flag className="w-3 h-3" /> Flagged
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">{chat.content}</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 font-medium whitespace-nowrap ml-4">
                      {new Date(chat.created_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedChatId === chat.id && (
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <div className="text-sm text-gray-800 dark:text-gray-300 whitespace-pre-wrap leading-relaxed font-sans bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-600">
                        {chat.content}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex justify-end gap-2 mt-3">
                        <button 
                          onClick={() => handleFlag(chat.id, chat.is_flagged)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                            chat.is_flagged ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <Flag className="w-3.5 h-3.5" /> {chat.is_flagged ? 'Unflag' : 'Flag as Inappropriate'}
                        </button>
                        <button 
                          onClick={() => handleDelete(chat.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Log
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}

function KPICard({ title, value, suffix, icon: Icon, color }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl bg-${color}-50 flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 text-${color}-600`} />
      </div>
      <div>
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
        <div className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
          {value} <span className="text-sm font-bold text-gray-400">{suffix}</span>
        </div>
      </div>
    </div>
  );
}
