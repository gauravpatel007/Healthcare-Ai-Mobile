import React, { useState, useRef, useEffect, useCallback } from 'react';
import API from '../utils/api';

/**
 * "Hey LifeOS" — Always-on wake word voice assistant.
 * 
 * States:
 *   idle        → mic not yet enabled (needs one-time click)
 *   passive     → continuously listening for "hey lifeos" wake word
 *   active      → wake word detected, capturing command
 *   processing  → sending command to backend AI
 */
const VoiceLogger = ({ onLogSuccess, onAction }) => {
  const [state, setState] = useState('idle'); // idle | passive | active | processing
  const [command, setCommand] = useState('');
  const [interimText, setInterimText] = useState('');
  const [messages, setMessages] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const restartTimeoutRef = useRef(null);
  const commandTimeoutRef = useRef(null);
  const isStoppedManuallyRef = useRef(false);
  const wakeDetectedRef = useRef(false);
  const stateRef = useRef('idle');
  const startListeningRef = useRef(null);
  const isEnabledRef = useRef(false);
  const isSpeakingRef = useRef(false);

  // Keep stateRef in sync so callbacks can read the latest state
  useEffect(() => { stateRef.current = state; }, [state]);

  // ── Audio feedback: subtle chime when wake word detected ──
  const playChime = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      // Audio not supported, silent fallback
    }
  }, []);

  // ── Text-to-Speech (TTS) ──
  const speakText = useCallback((text) => {
    if (!('speechSynthesis' in window)) return;

    isSpeakingRef.current = true;

    // Stop listening temporarily to avoid echo loop
    if (recognitionRef.current) {
      isStoppedManuallyRef.current = true;
      try { recognitionRef.current.stop(); } catch (e) { }
    }

    const utterance = new SpeechSynthesisUtterance(text);
    // Prevent garbage collection bug in Chrome
    window._speechUtterances = window._speechUtterances || [];
    window._speechUtterances.push(utterance);
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      isSpeakingRef.current = false;
      // Remove from global array
      window._speechUtterances = window._speechUtterances.filter(u => u !== utterance);
      
      // Resume listening if it was enabled
      if (isEnabledRef.current && startListeningRef.current) {
        setTimeout(() => {
          isStoppedManuallyRef.current = false;
          startListeningRef.current();
        }, 300);
      }
    };

    utterance.onerror = (e) => {
      console.error("Speech synthesis error:", e);
      isSpeakingRef.current = false;
      window._speechUtterances = window._speechUtterances.filter(u => u !== utterance);
      if (isEnabledRef.current && startListeningRef.current) {
        setTimeout(() => {
          isStoppedManuallyRef.current = false;
          startListeningRef.current();
        }, 300);
      }
    };

    // Ensure any previous speech is cancelled to prevent queue lockups
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  // ── Process voice command through backend AI ──
  const processVoiceCommand = useCallback(async (text, isAiChat = false) => {
    if (text !== 'code red') {
      setState('processing');
      setCommand(text);
      setMessages(prev => [...prev, { id: Date.now() + '-user', role: 'user', text }]);
      setIsChatOpen(true);
    }
    try {
      // If "Hey AI" was used, send directly to AI chat
      if (isAiChat) {
        if (onAction) {
          onAction({
            target_feature: 'ai-chat',
            action_name: 'send_message',
            data: { message: text }
          });
        }
        return;
      }

      const res = await API.post('/trackers/voice-log', { text });

      if (res.type === 'action' && res.success) {
        setMessages(prev => [...prev, { id: Date.now() + '-ai', role: 'ai', text: res.message || "Action processed." }]);
        if (res.target_feature === 'voice' && res.action_name === 'speak') {
          speakText(res.data?.text || "I'm sorry, I couldn't process that.");
        } else {
          if (res.message) speakText(res.message);
          if (onAction) {
            onAction({
              target_feature: res.target_feature,
              action_name: res.action_name,
              data: res.data || {}
            });
          }
        }
      } else if (res.success) {
        setMessages(prev => [...prev, { id: Date.now() + '-ai', role: 'ai', text: res.message }]);
        if (onLogSuccess) onLogSuccess(res.message);
      } else {
        setMessages(prev => [...prev, { id: Date.now() + '-error', role: 'error', text: res.message || "Failed to process voice command" }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now() + '-error', role: 'error', text: "Error processing voice command" }]);
    } finally {
      if (isEnabledRef.current) {
        setState('passive');
        setCommand('');
        setInterimText('');
        wakeDetectedRef.current = false;
        wakeTypeRef.current = null;
        if (startListeningRef.current) {
          setTimeout(() => {
            if (!isSpeakingRef.current) {
              isStoppedManuallyRef.current = false;
              startListeningRef.current();
            }
          }, 300);
        }
      } else {
        setState('idle');
        setCommand('');
        setInterimText('');
        wakeDetectedRef.current = false;
        wakeTypeRef.current = null;
      }
    }
  }, [onAction, onLogSuccess, speakText]);

  // ── Check if text contains the wake word ──
  const wakeTypeRef = useRef(null);
  const detectWakeWord = useCallback((text) => {
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

    // Check for "Hey AI" or "Hello AI" first (for AI chat)
    const aiPatterns = ['hey ai', 'hey a i', 'a ai', 'hello ai', 'hello a i'];
    for (const pattern of aiPatterns) {
      const idx = normalized.indexOf(pattern);
      if (idx !== -1) {
        const afterWake = normalized.substring(idx + pattern.length).trim();
        return { detected: true, command: afterWake, wakeType: 'ai' };
      }
    }

    // Check for "Hey Jarvis" (main wake word)
    const jarvisPatterns = [
      'hey jarvis', 'hello jarvis', 'hi jarvis', 'a jarvis',
      'hey travis', 'hello travis', 'hey garvis', 'hello garvis',
      'hay jarvis', 'jarvis', 'travis', 'garvis'
    ];
    for (const pattern of jarvisPatterns) {
      const idx = normalized.indexOf(pattern);
      if (idx !== -1) {
        const afterWake = normalized.substring(idx + pattern.length).trim();
        return { detected: true, command: afterWake, wakeType: 'siri' };
      }
    }

    // Silent SOS
    const silentPatterns = ['code red', 'silent emergency'];
    for (const pattern of silentPatterns) {
      const idx = normalized.indexOf(pattern);
      if (idx !== -1) {
        return { detected: true, command: 'code red', wakeType: 'silent' };
      }
    }

    return { detected: false, command: '', wakeType: null };
  }, []);

  // ── Initialize and start continuous recognition ──
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser. Please use Chrome or Edge.");
      return;
    }

    isEnabledRef.current = true;

    // Clean up existing instance
    if (recognitionRef.current) {
      isStoppedManuallyRef.current = true;
      try { recognitionRef.current.stop(); } catch (e) { }
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isStoppedManuallyRef.current = false;
      if (stateRef.current === 'idle' || stateRef.current === 'processing') {
        // Don't override processing state
        if (stateRef.current !== 'processing') {
          setState('passive');
        }
      }
    };

    recognition.onresult = (event) => {
      if (isStoppedManuallyRef.current) return; // Completely block duplicate events after stopping
      
      // Build full transcript from all results
      let finalText = '';
      let interimTextLocal = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript + ' ';
        } else {
          interimTextLocal += result[0].transcript;
        }
      }

      const fullText = (finalText + interimTextLocal).trim();
      setInterimText(interimTextLocal);

      // If we already detected wake word and are collecting the command
      if (wakeDetectedRef.current) {
        // Check final results for the full command
        if (finalText.trim()) {
          const wake = detectWakeWord(finalText.trim());
          const cmd = wake.detected ? wake.command : finalText.trim();
          if (cmd.length > 2) {
            // Clear timeout and process
            if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
            isStoppedManuallyRef.current = true;
            wakeDetectedRef.current = false; // Prevent double-firing
            try { recognition.stop(); } catch (e) { }
            processVoiceCommand(cmd, wakeTypeRef.current === 'ai');
          }
        }
        return;
      }

      // Check for wake word in the full text
      const wakeResult = detectWakeWord(fullText);
      if (wakeResult.detected) {
        wakeDetectedRef.current = true;
        wakeTypeRef.current = wakeResult.wakeType;

        if (wakeResult.wakeType !== 'silent') {
          setState('active');
          setIsChatOpen(true);
          playChime();
        }

        // If there's already a command after the wake word in final text
        if (wakeResult.command.length > 2 && finalText.trim()) {
          isStoppedManuallyRef.current = true;
          wakeDetectedRef.current = false; // Prevent double-firing
          try { recognition.stop(); } catch (e) { }
          processVoiceCommand(wakeResult.command, wakeResult.wakeType === 'ai');
          return;
        }

        // Set a timeout — if no command follows within 5 seconds, go back to passive
        if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
        commandTimeoutRef.current = setTimeout(() => {
          wakeDetectedRef.current = false;
          wakeTypeRef.current = null;
          setState('passive');
          setInterimText('');
          isStoppedManuallyRef.current = true;
          try { recognition.stop(); } catch (e) { }
          setTimeout(() => startListening(), 200);
        }, 5000);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') {
        // These are normal — auto-restart
        return;
      }
      console.error("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      // Auto-restart unless manually stopped or processing
      if (isEnabledRef.current && !isStoppedManuallyRef.current && stateRef.current !== 'processing') {
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = setTimeout(() => {
          if (stateRef.current !== 'active') {
            wakeDetectedRef.current = false;
          }
          startListening();
        }, 300);
      }
    };

    startListeningRef.current = startListening;
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
      // Retry after a delay
      setTimeout(() => startListening(), 1000);
    }
  }, [detectWakeWord, playChime, processVoiceCommand]);

  // ── Proactive Reminders ──
  useEffect(() => {
    let reminderPlayed = false;

    const interval = setInterval(() => {
      const now = new Date();
      // Real reminder at 2:00 PM
      if (now.getHours() === 14 && now.getMinutes() === 0 && !reminderPlayed) {
        if (isEnabledRef.current && !isSpeakingRef.current) {
          playChime();
          speakText("Hey Gaurav, it's 2 PM. Time to take your blood pressure medication.");
          reminderPlayed = true;
        }
      }

      // Reset reminder flag at midnight
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        reminderPlayed = false;
      }
    }, 30000); // Check every 30 seconds

    return () => {
      clearInterval(interval);
    };
  }, [playChime, speakText]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      isStoppedManuallyRef.current = true;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { }
      }
    };
  }, []);

  // ── Enable / disable always-on listening ──
  const toggleAlwaysOn = () => {
    if (state === 'idle') {
      startListening();
    } else {
      // Turn off
      isEnabledRef.current = false;
      isStoppedManuallyRef.current = true;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { }
      }
      setState('idle');
      wakeDetectedRef.current = false;
      setInterimText('');
      setCommand('');
    }
  };

  // ── Determine visual styling based on state ──
  const getButtonStyle = () => {
    const base = {
      width: '52px',
      height: '52px',
      borderRadius: '50%',
      color: 'white',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      position: 'relative',
    };
    switch (state) {
      case 'idle':
        return { ...base, background: 'linear-gradient(135deg, #64748b, #475569)', boxShadow: '0 4px 15px rgba(100, 116, 139, 0.3)' };
      case 'passive':
        return { ...base, background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)', animation: 'breathe 3s ease-in-out infinite' };
      case 'active':
        return { ...base, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 0 20px rgba(59, 130, 246, 0.6)', animation: 'activePulse 1s infinite' };
      case 'processing':
        return { ...base, background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)' };
      default:
        return base;
    }
  };

  const getStatusText = () => {
    switch (state) {
      case 'idle': return 'Click to enable voice';
      case 'passive': return 'Say "Hey Jarvis"';
      case 'active': return interimText ? `Hearing: "${interimText}"` : 'Listening for command...';
      case 'processing': return `Processing: "${command}"`;
      default: return '';
    }
  };

  const getStatusDot = () => {
    switch (state) {
      case 'passive': return '#10b981';
      case 'active': return '#3b82f6';
      case 'processing': return '#f59e0b';
      default: return 'transparent';
    }
  };

  useEffect(() => {
    if (isChatOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen, state, interimText]);

  return (
    <>
      {/* Fixed bottom-right floating assistant */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '10px',
      }}>
        {/* Chat window — shown when chat is open */}
        {isChatOpen && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-[320px] max-h-[400px] flex flex-col shadow-[0_10px_40px_rgba(0,0,0,0.2)] border border-slate-200 dark:border-gray-700 overflow-hidden mb-2" style={{ animation: 'fadeSlideUp 0.3s ease' }}>
            <div className="px-4 py-3 bg-slate-50 dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700 flex justify-between items-center">
              <span className="font-semibold text-sm text-slate-800 dark:text-gray-100 flex items-center gap-2">
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: getStatusDot(),
                  animation: state === 'active' ? 'activePulse 1s infinite' : state === 'passive' ? 'breathe 2s infinite' : 'none',
                }} />
                Voice Assistant
              </span>
              <button onClick={() => setIsChatOpen(false)} className="text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 bg-slate-50/50 dark:bg-gray-800">
              {messages.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginTop: '20px' }}>Say "Hey Jarvis" to start</div>}
              {messages.map(m => (
                <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <div className={`px-3.5 py-2.5 text-sm shadow-sm ${m.role === 'user' ? 'text-white bg-emerald-500 rounded-[14px] rounded-br-[4px]' : (m.role === 'error' ? 'text-red-800 bg-red-100 border border-red-300 rounded-[14px] rounded-bl-[4px] dark:bg-red-900/30 dark:border-red-800 dark:text-red-200' : 'text-slate-800 bg-white border border-slate-200 rounded-[14px] rounded-bl-[4px] dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100')}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {(state === 'active' || state === 'processing') && (
                 <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                   <div className="px-3.5 py-2.5 text-sm text-slate-500 bg-white border border-slate-200 rounded-[14px] rounded-bl-[4px] shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300">
                     <span style={{ display: 'inline-block', animation: state === 'processing' ? 'breathe 1s infinite' : 'none' }}>
                       {state === 'processing' ? '...' : (interimText ? `"${interimText}"` : 'Listening...')}
                     </span>
                   </div>
                 </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Status tooltip — shown when not idle and chat is closed */}
        {state !== 'idle' && !isChatOpen && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(12px)',
            color: '#f1f5f9',
            padding: '10px 16px',
            borderRadius: '14px',
            fontSize: '0.82rem',
            fontWeight: 500,
            maxWidth: '280px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeSlideUp 0.3s ease',
            cursor: 'pointer'
          }} onClick={() => setIsChatOpen(true)}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: getStatusDot(),
              flexShrink: 0,
              animation: state === 'active' ? 'activePulse 1s infinite' : state === 'passive' ? 'breathe 2s infinite' : 'none',
            }} />
            {getStatusText()}
          </div>
        )}

        {/* Main button */}
        <button onClick={toggleAlwaysOn} style={getButtonStyle()} title={getStatusText()}>
          {state === 'processing' ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : state === 'active' ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          )}

          {/* Outer ring animation for active/passive states */}
          {(state === 'passive' || state === 'active') && (
            <span style={{
              position: 'absolute',
              top: '-4px', left: '-4px', right: '-4px', bottom: '-4px',
              borderRadius: '50%',
              border: `2px solid ${state === 'active' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(16, 185, 129, 0.3)'}`,
              animation: state === 'active' ? 'ringPulse 1.5s infinite' : 'breatheRing 3s ease-in-out infinite',
            }} />
          )}
        </button>
      </div>

      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.03); opacity: 0.85; }
        }
        @keyframes breatheRing {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.1); opacity: 0.1; }
        }
        @keyframes activePulse {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
          70% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
        @keyframes ringPulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default VoiceLogger;
