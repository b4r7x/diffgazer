import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { type ThemeBootstrapConfig, themeBootstrap } from "./theme-bootstrap";

export type DocsTheme = "dark" | "light";
export type ThemePreference = DocsTheme | "system";

const STORAGE_KEY = "@diffgazer/docs-theme";
const DEFAULT_PREFERENCE: ThemePreference = "system";
const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

/** Browser and PWA chrome color per theme; mirrors the lib `--base-bg` values. */
export const THEME_COLORS: Record<DocsTheme, string> = {
  dark: "#0a0a0a",
  light: "#f7f8f5",
};

/** Toggle cycle: pin dark, pin light, then hand the choice back to the OS. */
const NEXT_PREFERENCE: Record<ThemePreference, ThemePreference> = {
  dark: "light",
  light: "system",
  system: "dark",
};

export function nextThemePreference(current: ThemePreference): ThemePreference {
  return NEXT_PREFERENCE[current];
}

/**
 * Accessible name for the chrome toggle. Its visible text is the current mode on
 * its own, so the name repeats that word (WCAG 2.5.3 Label in Name) and adds
 * what a click does. The bootstrap script writes the same strings pre-hydration.
 */
export function themeToggleLabel(preference: ThemePreference): string {
  return `Theme: ${preference}. Switch to ${NEXT_PREFERENCE[preference]}.`;
}

const TOGGLE_LABELS: Record<ThemePreference, string> = {
  dark: themeToggleLabel("dark"),
  light: themeToggleLabel("light"),
  system: themeToggleLabel("system"),
};

interface ThemeContextValue {
  /** What the reader chose: a pinned theme, or "system" to follow the OS. */
  theme: ThemePreference;
  /** The theme actually on the document, with "system" resolved. */
  resolved: DocsTheme;
  setTheme: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light" || stored === "system") return stored;
  } catch {
    // Reading storage throws in locked-down browsers; fall back to the default.
  }
  return DEFAULT_PREFERENCE;
}

function readSystemTheme(): DocsTheme {
  return window.matchMedia(DARK_SCHEME_QUERY).matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference, systemTheme: DocsTheme): DocsTheme {
  return preference === "system" ? systemTheme : preference;
}

function applyTheme(theme: DocsTheme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[theme]);
}

export const THEME_BOOTSTRAP_CONFIG: ThemeBootstrapConfig = {
  storageKey: STORAGE_KEY,
  defaultPreference: DEFAULT_PREFERENCE,
  darkQuery: DARK_SCHEME_QUERY,
  themeColors: THEME_COLORS,
  toggleLabels: TOGGLE_LABELS,
};

/**
 * {@link themeBootstrap} serialized for the inline head script in routes/__root.tsx,
 * so the stored preference reaches the document before the first paint. It stamps
 * exactly what {@link applyTheme} stamps and labels the server-rendered toggle as its
 * markup is parsed.
 */
export const THEME_INIT_SCRIPT = `(${themeBootstrap.toString()})(${JSON.stringify(THEME_BOOTSTRAP_CONFIG)});`;

const useClientLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(DEFAULT_PREFERENCE);
  const [systemTheme, setSystemTheme] = useState<DocsTheme>("dark");
  const resolved = resolveTheme(preference, systemTheme);

  // Server markup and the first client render must agree, so the real preference
  // and OS scheme are read after mount — in the layout phase, so the corrected
  // theme still lands before the browser paints. The same effect keeps both
  // inputs live: the OS scheme while "system" is active, and another tab of the
  // site writing the preference.
  useClientLayoutEffect(() => {
    setPreference(readStoredPreference());
    setSystemTheme(readSystemTheme());

    const scheme = window.matchMedia(DARK_SCHEME_QUERY);
    const handleSchemeChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setPreference(readStoredPreference());
    };

    scheme.addEventListener("change", handleSchemeChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      scheme.removeEventListener("change", handleSchemeChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // The bootstrap script owns the first stamp; from here the document follows the
  // resolved theme, whichever of the three inputs moved it.
  useClientLayoutEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  function setTheme(next: ThemePreference) {
    setPreference(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persistence is best-effort; ignore storage failures.
    }
  }

  return <ThemeContext value={{ theme: preference, resolved, setTheme }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
