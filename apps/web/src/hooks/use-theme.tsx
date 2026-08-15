import { useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import {
  isSelectableTheme,
  type ResolvedSelectableTheme,
  resolveSelectableTheme,
  type SelectableTheme,
  toSelectableTheme,
} from "@diffgazer/core/schemas/config";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { applyResolvedTheme, THEME_STORAGE_KEY } from "@/theme-bootstrap";
import type { ThemeContextValue } from "@/types/theme";

function subscribeToSystemTheme(callback: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getSystemTheme(): ResolvedSelectableTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** The single narrowing point between stored theme strings and the app. */
function fromStoredTheme(value: string | null): SelectableTheme {
  return isSelectableTheme(value) ? value : "auto";
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
  return accessThemeStorage((storage) => storage.getItem(THEME_STORAGE_KEY), null);
}

function writeStoredTheme(theme: string | null): void {
  accessThemeStorage((storage) => {
    if (theme === null) storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, theme);
  }, undefined);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [localOverride, setLocalOverride] = useState<SelectableTheme | null>(null);
  const [fallbackTheme, setFallbackTheme] = useState<SelectableTheme>(() =>
    fromStoredTheme(readStoredTheme()),
  );

  const { data: settings } = useSettings();
  const { mutateAsync: saveSettingsAsync } = useSaveSettings();

  const system: ResolvedSelectableTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
  );
  const latestSaveRef = useRef(0);

  // "terminal" is a legacy persisted value with no producer left on either
  // surface; web and TUI both normalize it to "auto" on read.
  const settingsTheme = settings?.theme ? toSelectableTheme(settings.theme) : null;
  const effectiveTheme: SelectableTheme = localOverride ?? settingsTheme ?? fallbackTheme;
  const resolved = resolveSelectableTheme(effectiveTheme, system);

  // The pre-paint bootstrap in index.html already themed the document; this
  // re-applies it once the stored settings resolve to a different theme.
  useEffect(() => {
    applyResolvedTheme(resolved);
  }, [resolved]);

  const setTheme = useCallback(
    async (newTheme: SelectableTheme): Promise<void> => {
      const save = ++latestSaveRef.current;
      const previousOverride = localOverride;
      const previousStored = readStoredTheme();
      setLocalOverride(newTheme);
      writeStoredTheme(newTheme);
      try {
        await saveSettingsAsync({ theme: newTheme });
        // The override only covers the save window: the settings cache already
        // refetched by now, so dropping it lets a theme saved by another tab or
        // the TUI reach this one instead of staying shadowed for the session.
        // The fallback carries the pick in case that refetch returned nothing.
        if (latestSaveRef.current === save) {
          setFallbackTheme(newTheme);
          setLocalOverride(null);
        }
      } catch (error) {
        // A later pick already replaced this one; rolling back now would undo the
        // theme the user is looking at.
        if (latestSaveRef.current === save) {
          setLocalOverride(previousOverride);
          writeStoredTheme(previousStored);
        }
        throw error;
      }
    },
    [localOverride, saveSettingsAsync],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: effectiveTheme, resolved, system, setTheme }),
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
