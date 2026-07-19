import { useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { resolveSelectableTheme, toSelectableTheme } from "@diffgazer/core/schemas/config";
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
const THEME_COLORS: Record<ResolvedTheme, string> = {
  dark: "#0d1117",
  light: "#ffffff",
};

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveWebTheme(value: string | null): WebTheme {
  if (value === "dark" || value === "light" || value === "auto") return value;
  return "auto";
}

function accessThemeStorage<T>(operation: (storage: Storage) => T, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return operation(window.localStorage);
  } catch (error) {
    if (error instanceof DOMException) return fallback;
    throw error;
  }
}

function readStoredTheme(): string | null {
  return accessThemeStorage((storage) => storage.getItem(STORAGE_KEY), null);
}

function writeStoredTheme(theme: string | null): void {
  accessThemeStorage((storage) => {
    if (theme === null) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, theme);
  }, undefined);
}

function getInitialFallbackTheme(): WebTheme {
  return resolveWebTheme(readStoredTheme());
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [localOverride, setLocalOverride] = useState<WebTheme | null>(null);
  const [fallbackTheme] = useState<WebTheme>(getInitialFallbackTheme);

  const { data: settings } = useSettings();
  const { mutateAsync: saveSettingsAsync } = useSaveSettings();

  const system: ResolvedTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    () => "dark" as const,
  );

  const settingsTheme = settings?.theme ? toSelectableTheme(settings.theme) : null;
  const effectiveTheme: WebTheme = localOverride ?? settingsTheme ?? fallbackTheme;
  const resolved = resolveSelectableTheme(effectiveTheme, system);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.style.colorScheme = resolved;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute("content", THEME_COLORS[resolved]);
  }, [resolved]);

  const setTheme = useCallback(
    async (newTheme: WebTheme): Promise<void> => {
      const previousOverride = localOverride;
      const previousStored = readStoredTheme();
      setLocalOverride(newTheme);
      writeStoredTheme(newTheme);
      try {
        await saveSettingsAsync({ theme: newTheme });
      } catch (error) {
        setLocalOverride(previousOverride);
        writeStoredTheme(previousStored);
        throw error;
      }
    },
    [localOverride, saveSettingsAsync],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: effectiveTheme,
      resolved,
      system,
      setTheme,
    }),
    [effectiveTheme, resolved, system, setTheme],
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
