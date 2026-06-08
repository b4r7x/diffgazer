import { useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ResolvedTheme, ThemeContextValue, WebTheme } from "@/types/theme";

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

function resolveTheme(theme: WebTheme, systemTheme: ResolvedTheme): ResolvedTheme {
  if (theme === "auto") return systemTheme;
  return theme;
}

function getInitialFallbackTheme(): WebTheme {
  if (typeof window === "undefined") return "auto";
  return resolveWebTheme(localStorage.getItem(STORAGE_KEY));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [localOverride, setLocalOverride] = useState<WebTheme | null>(null);
  const [fallbackTheme] = useState<WebTheme>(getInitialFallbackTheme);

  const { data: settings } = useSettings();
  const { mutateAsync: saveSettingsAsync } = useSaveSettings();

  const systemTheme: ResolvedTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    () => "dark" as const,
  );

  const settingsTheme = settings?.theme ? mapSettingsTheme(settings.theme) : null;
  const effectiveTheme: WebTheme = localOverride ?? settingsTheme ?? fallbackTheme;
  const resolved = resolveTheme(effectiveTheme, systemTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  const setTheme = useCallback(
    async (newTheme: WebTheme): Promise<void> => {
      const previousOverride = localOverride;
      const previousStored = localStorage.getItem(STORAGE_KEY);
      setLocalOverride(newTheme);
      localStorage.setItem(STORAGE_KEY, newTheme);
      try {
        await saveSettingsAsync({ theme: newTheme });
      } catch (error) {
        setLocalOverride(previousOverride);
        if (previousStored === null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, previousStored);
        throw error;
      }
    },
    [localOverride, saveSettingsAsync],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: effectiveTheme,
      resolved,
      setTheme,
    }),
    [effectiveTheme, resolved, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
