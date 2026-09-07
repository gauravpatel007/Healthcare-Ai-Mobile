import React, { useState, useRef, useEffect } from 'react';
import API from '../utils/api';

const LandingChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm the LifeOS AI assistant demo. Try asking about sleep, symptoms, or what LifeOS can track." }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const chatRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && chatRef.current && !chatRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    // Simulate network delay for demo
    setTimeout(() => {
      let responseText = "";
      const lowerMsg = userMessage.toLowerCase();
      
      if (lowerMsg.includes('sleep')) {
        responseText = "**Here are some tips for better sleep:**\n\n- Stick to a consistent sleep schedule.\n- Create a relaxing bedtime routine.\n- Limit screen time 1 hour before bed.\n- Ensure your room is cool and dark.";
      } else if (lowerMsg.includes('track') || lowerMsg.includes('features') || lowerMsg.includes('what can you do') || lowerMsg.includes('what this app do')) {
        responseText = "**LifeOS can track a variety of health metrics:**\n\n- **Vitals:** Heart rate, Blood pressure\n- **Lifestyle:** Sleep, Hydration, Nutrition\n- **Activity:** Steps, Workouts, Calories burned\n- **Medical:** Symptoms, Medications, Appointments\n\nI can also analyze your data and give you AI-driven insights!";
      } else if (lowerMsg.includes('headache') || lowerMsg.includes('symptom')) {
        responseText = "**Common causes for a headache include:**\n\n- Dehydration\n- Lack of sleep\n- Stress or tension\n- Eye strain\n\n*Disclaimer: I am an AI demo, not a doctor. Please consult a healthcare professional for medical advice.*";
      } else if (lowerMsg.includes('hi') || lowerMsg.includes('hello') || lowerMsg.includes('hey')) {
        responseText = "Hello! 👋 I am the **LifeOS AI Assistant**. How can I help you today?";
      } else if (lowerMsg.includes('who are you') || lowerMsg.includes('what are you')) {
        responseText = "I am the **LifeOS AI Assistant**. I'm here to help you track your health metrics, provide wellness tips, and make managing your health journey as seamless as possible!";
      } else {
        responseText = "That's a great question! Sign up for a free LifeOS account to get personalized AI health insights, track your symptoms, and unlock your full health potential.";
      }

      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div ref={chatRef}>
      <div 
        className={`fixed bottom-[150px] md:bottom-[90px] right-4 md:right-6 z-[60] w-[340px] md:w-[380px] h-[500px] max-h-[70vh] bg-slate-50 dark:bg-slate-950 rounded-[24px] shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
      >
        <div className="bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">smart_toy</span>
            <div>
              <div className="font-bold text-sm leading-tight">LifeOS AI Assistant</div>
              <div className="text-[11px] opacity-80 leading-tight">Demo preview · not medical advice</div>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white bg-transparent border-none cursor-pointer p-1">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50 dark:bg-slate-950">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-white ${msg.role === 'user' ? 'bg-slate-800 dark:bg-slate-700' : 'bg-gradient-to-br from-blue-600 to-cyan-500'}`}>
                <span className="material-symbols-outlined text-[14px]">
                  {msg.role === 'user' ? 'person' : 'smart_toy'}
                </span>
              </div>
              <div 
                className={`${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm whitespace-pre-wrap' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0'} text-sm rounded-2xl px-4 py-2.5 shadow-sm`}
                dangerouslySetInnerHTML={msg.role === 'user' ? undefined : { __html: window.marked ? window.marked.parse(msg.content) : msg.content }}
              >
                {msg.role === 'user' ? msg.content : null}
              </div>
            </div>
          ))}
          {isTyping && (
             <div className="flex gap-2 max-w-[85%]">
             <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white">
               <span className="material-symbols-outlined text-[14px]">smart_toy</span>
             </div>
             <div className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
             </div>
           </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="flex gap-2 flex-wrap px-4 pb-2">
          <button onClick={() => {setInput('How can I sleep better?');}} className="text-[11px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors border-none cursor-pointer">Sleep tips</button>
          <button onClick={() => {setInput('What does LifeOS track?');}} className="text-[11px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors border-none cursor-pointer">What it tracks</button>
          <button onClick={() => {setInput('I have a headache');}} className="text-[11px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors border-none cursor-pointer">Symptom check</button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 p-3 bg-white dark:bg-slate-900 m-0">
          <input 
            type="text" 
            placeholder="Ask me anything about health..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 text-sm bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/40 border-none m-0" 
          />
          <button type="submit" className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white flex items-center justify-center hover:shadow-lg transition-shadow border-none cursor-pointer p-0">
            <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
          </button>
        </form>
      </div>

      <button 
        onClick={() => setIsOpen(!isOpen)} 
        aria-label="Open AI chat demo"
        className="fixed bottom-[88px] md:bottom-6 right-4 md:right-6 z-[60] w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center hover:-translate-y-1 hover:shadow-xl transition-all border-none cursor-pointer"
      >
        <span className="material-symbols-outlined text-[26px]">
          {isOpen ? 'close' : 'chat'}
        </span>
      </button>
    </div>
  );
};

export default LandingChatbot;
