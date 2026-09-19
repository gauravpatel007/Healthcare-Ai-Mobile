import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

const CACHE_KEY = 'lifeos_settings_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedSettings() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    // Return cached data even if stale — caller does background refresh
    return { data, isStale: Date.now() - ts > CACHE_TTL_MS };
  } catch { return null; }
}

function saveCachedSettings(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* quota exceeded or private mode — ignore */ }
}

export const SettingsProvider = ({ children }) => {
  // Initialize from cache immediately — no loading spinner needed
  const cached = getCachedSettings();
  const [settings, setSettings] = useState(cached?.data || null);
  const [loading, setLoading] = useState(!cached?.data); // only loading if no cache

  const fetchSettings = async () => {
    try {
      const res = await api.getAdminSettings();
      if (res && res.data) {
        setSettings(res.data);
        saveCachedSettings(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch global settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Always fetch fresh settings in background
    fetchSettings();
  }, []);

  // Apply Colors from Admin Settings
  useEffect(() => {
    if (!settings) return;

    // Apply Primary Color overrides
    if (settings.primary_color) {
      const hex = settings.primary_color;
      // Convert hex to rgb for rgba usage if needed
      let r = 0, g = 0, b = 0;
      if (hex.length === 7) {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
      }
      
      const styleEl = document.getElementById('dynamic-theme-styles');
      const cssRules = `
          :root {
            --primary-color: ${hex};
            --primary-rgb: ${r}, ${g}, ${b};
          }
          /* Override common Tailwind primary classes */
          .text-blue-600 { color: var(--primary-color) !important; }
          .bg-blue-600 { background-color: var(--primary-color) !important; }
          .border-blue-600 { border-color: var(--primary-color) !important; }
          .hover\\:bg-blue-700:hover { background-color: rgba(var(--primary-rgb), 0.9) !important; }
          .hover\\:text-blue-700:hover { color: rgba(var(--primary-rgb), 0.9) !important; }
          .ring-blue-500 { --tw-ring-color: var(--primary-color) !important; }
          .from-blue-600 { --tw-gradient-from: var(--primary-color) !important; }
          .to-blue-600 { --tw-gradient-to: var(--primary-color) !important; }
          .text-blue-500 { color: rgba(var(--primary-rgb), 0.9) !important; }
          .bg-blue-500 { background-color: rgba(var(--primary-rgb), 0.9) !important; }
          .bg-blue-50 { background-color: rgba(var(--primary-rgb), 0.1) !important; }
          .text-blue-700 { color: rgba(var(--primary-rgb), 0.8) !important; }
      `;
      
      if (styleEl) {
        styleEl.innerHTML = cssRules;
      } else {
        const style = document.createElement('style');
        style.id = 'dynamic-theme-styles';
        style.innerHTML = cssRules;
        document.head.appendChild(style);
      }
    }
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ 
      settings, 
      loading, 
      refreshSettings: fetchSettings
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

