import { useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isWebTheme, type ThemeContextValue, type WebTheme } from "@/types/theme";

const STORAGE_KEY = "diffgazer-theme";
const DEFAULT_THEME: WebTheme = "dark";
const THEME_COLORS: Record<WebTheme, string> = {
  dark: "#0d1117",
  light: "#ffffff",
};

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** The single narrowing point between the shared config schema and the web app. */
function toWebTheme(value: string | null | undefined): WebTheme {
  return value !== undefined && isWebTheme(value) ? value : DEFAULT_THEME;
}

function accessThemeStorage<T>(operation: (storage: Storage) => T, fallback: T): T {
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [localOverride, setLocalOverride] = useState<WebTheme | null>(null);
  const [fallbackTheme] = useState<WebTheme>(() => toWebTheme(readStoredTheme()));

  const { data: settings } = useSettings();
  const { mutateAsync: saveSettingsAsync } = useSaveSettings();

  const settingsTheme = settings?.theme ? toWebTheme(settings.theme) : null;
  const theme: WebTheme = localOverride ?? settingsTheme ?? fallbackTheme;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute("content", THEME_COLORS[theme]);
  }, [theme]);

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

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
