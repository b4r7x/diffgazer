import { createContext, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ResolvedTheme, ThemeContextValue, WebTheme } from "@/types/theme";
import { useSettings } from "@/hooks/use-settings";
import { api } from "@/lib/api";

function subscribeToSystemTheme(callback: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const STORAGE_KEY = "stargazer-theme";

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveWebTheme(value: string | null): WebTheme {
  if (value === "dark" || value === "light" || value === "auto") return value;
  return "auto";
}

function mapSettingsTheme(theme: string): WebTheme {
  if (theme === "terminal") return "dark";
  return resolveWebTheme(theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<WebTheme>(() => {
    if (typeof window === "undefined") return "auto";
    return resolveWebTheme(localStorage.getItem(STORAGE_KEY));
  });

  const { settings } = useSettings();

  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    () => "dark" as ResolvedTheme
  );

  const resolved: ResolvedTheme = theme === "auto" ? systemTheme : theme;

  useEffect(() => {
    if (settings?.theme) {
      const webTheme = mapSettingsTheme(settings.theme);
      setThemeState(webTheme);
      localStorage.setItem(STORAGE_KEY, webTheme);
    }
  }, [settings]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  const setTheme = useCallback((newTheme: WebTheme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    api.saveSettings({ theme: newTheme }).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
