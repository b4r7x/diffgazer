import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ResolvedTheme, ThemeContextValue, WebTheme } from "@/types/theme";
import { useSettings, useSaveSettings } from "@diffgazer/api/hooks";

function subscribeToSystemTheme(callback: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const STORAGE_KEY = "diffgazer-theme";

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
  const context = useContext(ThemeContext);
  const resolved = context?.resolved ?? "dark";

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
  const [localOverride, setLocalOverride] = useState<WebTheme | null>(null);

  const { data: settings } = useSettings();
  const saveSettings = useSaveSettings();

  const systemTheme: ResolvedTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    () => "dark"
  );

  const settingsTheme = settings?.theme ? mapSettingsTheme(settings.theme) : null;

  useEffect(() => {
    if (!settingsTheme) return;

    if (localOverride) {
      if (settingsTheme === localOverride) {
        setLocalOverride(null);
      }
      return;
    }

    setThemeState(settingsTheme);
    localStorage.setItem(STORAGE_KEY, settingsTheme);
  }, [settingsTheme, localOverride]);

  const effectiveTheme = localOverride ?? theme;
  const resolved: ResolvedTheme =
    effectiveTheme === "auto"
      ? systemTheme
      : effectiveTheme === "dark"
        ? "dark"
        : "light";

  const setTheme = useCallback((newTheme: WebTheme) => {
    setThemeState(newTheme);
    setLocalOverride(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    saveSettings.mutate({ theme: newTheme });
  }, [saveSettings]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme: effectiveTheme,
    resolved,
    setTheme,
  }), [effectiveTheme, resolved, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      <ThemeStyleApplicator />
      {children}
    </ThemeContext.Provider>
  );
}
