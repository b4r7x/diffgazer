'use client';

import { createContext, useState, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { WebTheme, ResolvedTheme, ThemeContextValue } from '@/types/theme';
import { getSettings, saveSettings } from '@/features/settings/api/config-api';

function subscribeToSystemTheme(callback: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const STORAGE_KEY = 'stargazer-theme';

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<WebTheme>(() => {
    if (typeof window === 'undefined') return 'auto';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'auto') return stored;
    return 'auto';
  });

  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    () => 'dark' as ResolvedTheme
  );

  const resolved: ResolvedTheme = theme === 'auto' ? systemTheme : theme;

  useEffect(() => {
    const isValidWebTheme = (t: string): t is WebTheme => ['light', 'dark', 'auto'].includes(t);

    getSettings()
      .then(settings => {
        if (settings?.theme) {
          // Map 'terminal' to 'dark' for web (terminal theme is CLI-only)
          const webTheme = settings.theme === 'terminal'
            ? 'dark'
            : isValidWebTheme(settings.theme)
              ? settings.theme
              : 'auto';
          setThemeState(webTheme);
          localStorage.setItem(STORAGE_KEY, webTheme);
        }
      })
      .catch(() => {
        // Fallback: already using localStorage initial value
      });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
  }, [resolved]);

  const setTheme = (newTheme: WebTheme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    // Sync with backend (fire and forget)
    saveSettings({ theme: newTheme }).catch((err) => {
      console.error('Failed to sync theme to server:', err);
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
