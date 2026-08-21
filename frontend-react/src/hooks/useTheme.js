import { useState, useCallback, useEffect } from 'react';

/**
 * Fully isolated theme hook. Each call manages its own localStorage key.
 * Does NOT touch document.documentElement — the wrapper div handles dark class.
 */
const useTheme = (storageKey) => {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem(storageKey, newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [storageKey]);

  // Apply on mount
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  const setThemeValue = useCallback((value) => {
    setTheme(value);
  }, [setTheme]);

  return { theme, toggleTheme, setThemeValue };
};

export default useTheme;
