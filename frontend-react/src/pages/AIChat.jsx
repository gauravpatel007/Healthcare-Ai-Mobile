import React, { useState, useEffect, useRef } from 'react';
import API from '../utils/api';
import MedicalDisclaimer from '../components/MedicalDisclaimer';
import { useLang } from '../contexts/LangContext';
import { 
  Bot,
  MessageSquare,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Mic,
  Send,
  Pill,
  Stethoscope,
  FileText,
  HeartPulse,
  Lightbulb,
  Trash2,
  X,
  Star,
  Check,
  History,
  Plus
} from 'lucide-react';

/* ─── Reusable Action Card (Matches Dashboard StatCard) ──────────── */
const ActionCard = ({ title, value, subtitle, icon: Icon, colorClass, onClick }) => (
  <div 
    onClick={onClick}
    tabIndex={0}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e); } }}
    className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1.5 relative overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 flex flex-col justify-between h-full"
  >
    <div className={`absolute top-0 right-0 w-32 h-32 ${colorClass} opacity-10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110`}></div>
    <div className="flex items-start justify-between relative z-10">
      <div>
        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1 tracking-wide uppercase">{title}</p>
        <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight leading-tight">{value}</h3>
      </div>
      <div className={`p-3 ${colorClass} bg-opacity-10 dark:bg-opacity-20 rounded-2xl shadow-sm transition-transform duration-300 ease-out group-hover:scale-125 shrink-0 ml-3`}>
        <Icon className="w-6 h-6" style={{ color: 'currentColor' }} />
      </div>
    </div>
    <div className="mt-5 flex items-center text-sm relative z-10">
      <span className="font-semibold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-3 py-1 rounded-full">
        {subtitle}
      </span>
    </div>
  </div>
);

const AIChat = ({ voiceAction, onVoiceActionConsumed }) => {
  const { t } = useLang();
  useEffect(() => {
    const appContainer = document.querySelector('.app-container');
    const rightPanel = document.querySelector('.right-panel');
    if (appContainer && rightPanel) {
      appContainer.style.gridTemplateColumns = 'var(--sidebar-width) 1fr';
      rightPanel.style.display = 'none';
    }
    return () => {
      if (appContainer && rightPanel) {
        appContainer.style.gridTemplateColumns = 'var(--sidebar-width) 1fr var(--right-panel-width)';
        rightPanel.style.display = 'flex';
      }
    };
  }, []);
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showTipsModal, setShowTipsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [healthTips, setHealthTips] = useState([]);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [chatSessions, setChatSessions] = useState([]);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const chatClearedRef = useRef(false);
  const abortControllerRef = useRef(null);
  
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const startVoiceRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(t('error_voice_support'));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const speechResult = event.results[0][0].transcript;
      setInput(speechResult);
    };
    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      alert(t('error_voice'));
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const sampleQuestions = [t('sample_q_1'), t('sample_q_2'), t('sample_q_3'), t('sample_q_4')];

  const defaultGreeting = (
    <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-[2rem] p-6 mb-6 w-full max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Bot className="w-7 h-7" />
        </div>
        <div>
          <h3 className="font-extrabold text-gray-900 dark:text-white text-lg">{t('greeting_title')}</h3>
          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{t('health_assistant_role')}</p>
        </div>
      </div>
      <p className="text-gray-700 dark:text-gray-300 font-medium leading-relaxed mb-5">
        {t('greeting_message')}
      </p>
      <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-700/50">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('try_asking_me')}</p>
        <ul className="space-y-3">
          {sampleQuestions.map((q, i) => (
            <li 
              key={i} 
              className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800" 
              onClick={() => setInput(q)}
            >
              <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                <MessageSquare className="w-3 h-3 text-indigo-500" />
              </div>
              {q}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  useEffect(() => {
    const initChat = async () => {
      try {
        const [sessionsRes, tipsRes] = await Promise.all([
          API.get('/ai/chat/sessions').catch(() => []),
          API.get('/ai/chat/tips').catch(() => ({}))
        ]);
        
        if (tipsRes && tipsRes.tips) {
          setHealthTips(tipsRes.tips.map(tip => tip.tip));
        }
        
        const isFirstVisit = !sessionStorage.getItem('aiChatVisited');
        sessionStorage.setItem('aiChatVisited', 'true');

        if (isFirstVisit) {
          setSessionId(null);
          setMessages([{ role: 'assistant', custom: defaultGreeting }]);
          if (sessionsRes && sessionsRes.length > 0) {
            setChatSessions(sessionsRes);
          }
        } else if (sessionsRes && sessionsRes.length > 0) {
          setChatSessions(sessionsRes);
          const latestSessionId = sessionsRes[0].session_id;
          setSessionId(latestSessionId);
          const historyRes = await API.get(`/ai/chat/history?session_id=${latestSessionId}`).catch(() => []);
          if (historyRes && historyRes.length > 0) {
            setMessages(historyRes.map(m => ({ role: m.role, text: m.content, id: m.id, feedback: m.feedback })));
          } else {
            setMessages([{ role: 'assistant', custom: defaultGreeting }]);
          }
        } else {
          setMessages([{ role: 'assistant', custom: defaultGreeting }]);
        }
      } catch (e) {
        console.error(e);
      }
    };
    initChat();
  }, []);
  
  const loadSession = async (sid) => {
    try {
      setShowHistoryModal(false);
      setSessionId(sid);
      setMessages([]); // clear current
      const historyRes = await API.get(`/ai/chat/history?session_id=${sid}`);
      if (historyRes && historyRes.length > 0) {
        setMessages(historyRes.map(m => ({ role: m.role, text: m.content, id: m.id, feedback: m.feedback })));
      } else {
        setMessages([{ role: 'assistant', custom: defaultGreeting }]);
      }
    } catch(e) {
      console.error(e);
    }
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleFeedback = async (messageId, rating, messageIndex) => {
    if (!messageId) return;
    try {
      await API.post(`/ai/chat/${messageId}/feedback`, { feedback: rating });
      setMessages(prev => prev.map((msg, i) => i === messageIndex ? { ...msg, feedback: rating } : msg));
    } catch (e) {
      console.error('Failed to submit feedback', e);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }).catch(err => {
      console.error('Failed to copy', err);
    });
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    chatClearedRef.current = false;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setInput('');
    setIsTyping(true);

    try {
      const payload = { message: userMessage };
      if (sessionId) payload.session_id = sessionId;
      
      const res = await API.request('/ai/chat', {
        method: 'POST',
        body: payload,
        signal: controller.signal
      });
      if (!chatClearedRef.current) {
        setMessages(prev => [...prev, { role: 'assistant', text: res.response, id: res.message_id }]);
        if (res.session_id && res.session_id !== sessionId) {
          setSessionId(res.session_id);
          // Refresh sessions list
          API.get('/ai/chat/sessions').then(setChatSessions).catch(console.error);
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') return; 
      if (!chatClearedRef.current) {
        setMessages(prev => [...prev, { role: 'assistant', text: t('error_server') }]);
      }
    } finally {
      setIsTyping(false);
      abortControllerRef.current = null;
    }
  };

  const startNewChat = () => {
    chatClearedRef.current = true;
    setIsTyping(false);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setSessionId(null);
    setMessages([{ role: 'assistant', custom: defaultGreeting }]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  useEffect(() => {
    if (voiceAction && voiceAction.target_feature === 'ai-chat') {
      if (voiceAction.action_name === 'send_message' && voiceAction.data?.message) {
        const msg = voiceAction.data.message;
        setInput(msg);
        setTimeout(() => {
          const userMessage = msg.trim();
          if (!userMessage) return;
          chatClearedRef.current = false;
          if (abortControllerRef.current) abortControllerRef.current.abort();
          const controller = new AbortController();
          abortControllerRef.current = controller;
          setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
          setInput('');
          setIsTyping(true);
          const payload = { message: userMessage };
          if (sessionId) payload.session_id = sessionId;
          API.request('/ai/chat', { method: 'POST', body: payload, signal: controller.signal })
            .then(res => { 
              if (!chatClearedRef.current) {
                setMessages(prev => [...prev, { role: 'assistant', text: res.response, id: res.message_id }]); 
                if (res.session_id && res.session_id !== sessionId) {
                  setSessionId(res.session_id);
                  API.get('/ai/chat/sessions').then(setChatSessions).catch(console.error);
                }
              }
            })
            .catch(e => { if (e.name !== 'AbortError' && !chatClearedRef.current) setMessages(prev => [...prev, { role: 'assistant', text: t('error_server') }]); })
            .finally(() => { setIsTyping(false); abortControllerRef.current = null; });
        }, 500);
      } else if (voiceAction.action_name === 'open_history') {
        setShowHistoryModal(true);
      } else if (voiceAction.action_name === 'open_daily_tips') {
        setShowTipsModal(true);
      } else if (voiceAction.action_name === 'new_chat') {
        startNewChat();
      } else if (voiceAction.action_name === 'like_last_message') {
        const aiMsgs = messagesRef.current.map((m, i) => ({ ...m, originalIndex: i })).filter(m => (m.role === 'ai' || m.role === 'assistant') && !m.custom);
        if (aiMsgs.length > 0) {
          const lastMsg = aiMsgs[aiMsgs.length - 1];
          handleFeedback(lastMsg.id, 1, lastMsg.originalIndex);
        }
      } else if (voiceAction.action_name === 'dislike_last_message') {
        const aiMsgs = messagesRef.current.map((m, i) => ({ ...m, originalIndex: i })).filter(m => (m.role === 'ai' || m.role === 'assistant') && !m.custom);
        if (aiMsgs.length > 0) {
          const lastMsg = aiMsgs[aiMsgs.length - 1];
          handleFeedback(lastMsg.id, -1, lastMsg.originalIndex);
        }
      } else if (voiceAction.action_name === 'copy_last_message') {
        const aiMsgs = messagesRef.current.map((m, i) => ({ ...m, originalIndex: i })).filter(m => (m.role === 'ai' || m.role === 'assistant') && !m.custom);
        if (aiMsgs.length > 0) {
          const lastMsg = aiMsgs[aiMsgs.length - 1];
          copyToClipboard(lastMsg.text, lastMsg.id || lastMsg.originalIndex);
        }
      }
      if (onVoiceActionConsumed) onVoiceActionConsumed();
    }
  }, [voiceAction]);

  const quickAction = (type) => {
    const prompts = {
      medicine: t('sample_q_1'),
      firstaid: t('sample_q_2'),
      report: t('sample_q_3'),
      general: t('sample_q_4')
    };
    setInput(prompts[type] || '');
  };

  const formatMessage = (text) => {
    if (!text) return null;
    if (typeof text !== 'string') return text;
    let formatted = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\n/g, '<br />');
    formatted = formatted.replace(/(^|<br \/>)\s*[\*\-]\s+/g, '$1• ');
    return <span dangerouslySetInnerHTML={{ __html: formatted }} style={{ lineHeight: '1.6' }} />;
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20">
      
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-hidden w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Bot className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              {t('ai_health_assistant_title')}
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse shrink-0"></span>
              {t('ai_health_assistant_subtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 relative z-10 shrink-0 ml-auto pr-2">
          <button 
            onClick={() => setShowHistoryModal(true)} 
            className="flex items-center gap-2 p-3 rounded-xl transition-all bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            title="Chat History"
          >
            <History className="w-5 h-5 shrink-0" />
          </button>
          <button 
            onClick={() => setShowTipsModal(true)} 
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
          >
            <Lightbulb className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">{t('daily_tips_btn')}</span>
          </button>
          <button 
            onClick={startNewChat} 
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">New Chat</span>
          </button>
        </div>
      </div>

      <MedicalDisclaimer />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[
          { id: 'medicine', icon: Pill, title: t('medicine_info'), desc: t('drug_information'), color: 'bg-indigo-500 text-indigo-500' },
          { id: 'firstaid', icon: Stethoscope, title: t('first_aid'), desc: t('emergency_guide'), color: 'bg-emerald-500 text-emerald-500' },
          { id: 'report', icon: FileText, title: t('report_qa'), desc: t('explain_results'), color: 'bg-sky-500 text-sky-500' },
          { id: 'general', icon: HeartPulse, title: t('general_health'), desc: t('any_question'), color: 'bg-amber-500 text-amber-500' }
        ].map(action => (
          <ActionCard
            key={action.id}
            title={t('quick_action')}
            value={action.title}
            subtitle={action.desc}
            icon={action.icon}
            colorClass={action.color}
            onClick={() => quickAction(action.id)}
          />
        ))}
      </div>

      {/* Main Chat Interface */}
      <div className="flex flex-col bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden h-[500px] lg:h-[600px] max-h-[60vh]">
        
        {/* Messages area */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          {messages.length === 0 ? defaultGreeting : messages.map((m, i) => {
            const isAI = m.role === 'ai' || m.role === 'assistant';
            return (
              <div key={i} className={`flex flex-col ${isAI ? 'items-start' : 'items-end'}`}>
                {isAI && !m.custom && (
                  <div className="flex items-center gap-2 mb-2 ml-1">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{t('greeting_title')}</span>
                  </div>
                )}
                
                {m.custom ? m.custom : (
                  <div className={`max-w-[85%] md:max-w-[75%] rounded-3xl p-4 lg:p-5 text-sm lg:text-base font-medium ${
                    isAI 
                      ? 'bg-gray-50 dark:bg-gray-900/50 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-800 rounded-tl-none' 
                      : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md rounded-tr-none'
                  }`}>
                    {formatMessage(m.text)}
                  </div>
                )}

                {isAI && m.text && !m.custom && (
                  <div className="flex items-center gap-1 mt-2 ml-2">
                    <button onClick={() => copyToClipboard(m.text, m.id || i)} className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors flex items-center gap-1" title="Copy">
                      {copiedMessageId === (m.id || i) ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-bold text-emerald-500">{t('copied')}</span>
                        </>
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button onClick={() => handleFeedback(m.id, 1, i)} className={`p-2 rounded-lg transition-colors ${m.feedback === 1 ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`} title="Helpful">
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleFeedback(m.id, -1, i)} className={`p-2 rounded-lg transition-colors ${m.feedback === -1 ? 'text-rose-500 bg-rose-50 dark:bg-rose-900/30' : 'text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30'}`} title="Not Helpful">
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {isTyping && (
            <div className="flex flex-col items-start">
               <div className="flex items-center gap-2 mb-2 ml-1">
                 <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                   <Bot className="w-3.5 h-3.5" />
                 </div>
                 <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{t('greeting_title')}</span>
               </div>
               <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-3xl rounded-tl-none p-5 flex gap-2">
                 <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                 <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                 <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 lg:p-6 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/80 p-2 pl-4 rounded-[2.5rem] border border-gray-200 dark:border-gray-700 focus-within:border-indigo-500/50 dark:focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
            <button 
              onClick={startVoiceRecognition}
              className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-all ${
                isListening 
                  ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)] animate-pulse' 
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-indigo-600 border border-gray-200 dark:border-gray-700 shadow-sm'
              }`}
              title="Voice Input"
            >
              <Mic className="w-5 h-5" />
            </button>
            <input 
              type="text"
              placeholder={t('chat_placeholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 font-medium"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-12 h-12 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Send className="w-5 h-5 m-0 p-0" />
            </button>
          </div>
        </div>
      </div>

      {/* Daily Tips Modal */}
      {showTipsModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm !mt-0"
          onClick={(e) => { if (e.target === e.currentTarget) setShowTipsModal(false); }}
        >
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-700 transform transition-all h-fit overflow-hidden flex flex-col">
            <div className="p-6 lg:p-8 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <Lightbulb className="w-6 h-6 text-amber-500" />
                {t('daily_health_tips')}
              </h3>
              <button 
                onClick={() => setShowTipsModal(false)}
                className="p-2 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full text-gray-500 dark:text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 lg:p-8 overflow-y-auto max-h-[60vh] custom-scrollbar">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-[2rem] p-6 text-center border border-indigo-100 dark:border-indigo-800/30 mb-8">
              <Star className="w-10 h-10 text-amber-400 mx-auto mb-3 drop-shadow-sm" />
              <h4 className="font-extrabold text-gray-900 dark:text-white mb-2">{t('todays_tip')}</h4>
              <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200 leading-relaxed">
                {healthTips[new Date().getDate() % (healthTips.length || 1)] || t('fallback_tip_1')}
              </p>
            </div>
            
            <div>
              <h4 className="font-extrabold text-gray-900 dark:text-white mb-3 text-sm px-2 uppercase tracking-wider">{t('more_tips')}</h4>
              <div className="space-y-2">
                {(healthTips.length > 0 ? healthTips.slice(0, 5) : [t('fallback_tip_2'), t('fallback_tip_3')]).map((tip, i) => (
                  <div key={i} className="px-5 py-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl text-sm font-semibold text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-700/50">
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Chat History Modal */}
      {showHistoryModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm !mt-0"
          onClick={(e) => { if (e.target === e.currentTarget) setShowHistoryModal(false); }}
        >
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-700 transform transition-all h-fit overflow-hidden flex flex-col">
            <div className="p-6 lg:p-8 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <History className="w-6 h-6 text-indigo-500" />
                Recent Chats
              </h3>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="p-2 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full text-gray-500 dark:text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 lg:p-8 space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {chatSessions.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-6 font-medium">No recent chats found.</div>
              ) : (
                chatSessions.map((session, i) => (
                  <div 
                    key={i} 
                    onClick={() => loadSession(session.session_id)}
                    className={`cursor-pointer px-5 py-4 rounded-2xl transition-all border ${
                      sessionId === session.session_id 
                        ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' 
                        : 'bg-gray-50 border-gray-100 hover:bg-indigo-50/50 dark:bg-gray-900/50 dark:border-gray-800 dark:hover:bg-gray-800/80 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="font-bold text-sm mb-1 truncate">{session.title || "Chat Session"}</div>
                    <div className="flex items-center justify-between text-xs opacity-70">
                      <span>{new Date(session.created_at).toLocaleDateString()}</span>
                      <span>{session.message_count} msgs</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChat;
