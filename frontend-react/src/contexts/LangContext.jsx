/**
 * LangContext — App-wide language / i18n
 * Reads initial language from user profile, persists via backend.
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import translations from '../i18n/translations';

const LangContext = createContext();

export const useLang = () => useContext(LangContext);

export const LangProvider = ({ children }) => {
  const [lang, setLangState] = useState(
    () => localStorage.getItem('lifeos_lang') || 'en'
  );

  const setLang = useCallback((code) => {
    setLangState(code);
    localStorage.setItem('lifeos_lang', code);
  }, []);

  // Listen for language changes in other tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'lifeos_lang' && e.newValue) {
        setLangState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  /**
   * t(key) — Translate a key to the current language.
   * Falls back to English if key not found in selected lang.
   */
  const t = useCallback((key) => {
    return (
      translations[lang]?.[key] ||
      translations['en']?.[key] ||
      key
    );
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
};
