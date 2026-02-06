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

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveWebTheme(value: string | null): WebTheme {
  if (value === "dark" || value === "light" || value === "auto") return value;
  return "auto";
}

function mapSettingsTheme(theme: string): WebTheme {
  if (theme === "terminal") return "dark";
  return resolveWebTheme(theme);
}

function ThemeStyleApplicator() {
  const { settings } = useSettings();

  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    () => "dark" as ResolvedTheme
  );

  const resolvedTheme = settings?.theme ? mapSettingsTheme(settings.theme) : "auto";
  const resolved: ResolvedTheme = resolvedTheme === "auto" ? systemTheme : resolvedTheme;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  return null;
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

  const resolvedTheme = settings?.theme ? mapSettingsTheme(settings.theme) : theme;
  const resolved: ResolvedTheme = resolvedTheme === "auto" ? systemTheme : resolvedTheme;

  const setTheme = useCallback((newTheme: WebTheme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    api.saveSettings({ theme: newTheme }).catch((err) => console.error("Failed to save theme settings", err));
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme: resolvedTheme, resolved, setTheme }), [resolvedTheme, resolved, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      <ThemeStyleApplicator />
      {children}
    </ThemeContext.Provider>
  );
}
