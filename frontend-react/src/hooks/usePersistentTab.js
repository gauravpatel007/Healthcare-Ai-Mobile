import { useState, useEffect } from 'react';

export function usePersistentTab(key, defaultValue) {
  const storageKey = `lifeos_tab_${key}`;
  
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved !== null ? saved : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, activeTab);
    } catch (e) {
      console.error('Failed to save active tab to localStorage:', e);
    }
  }, [activeTab, storageKey]);

  return [activeTab, setActiveTab];
}
