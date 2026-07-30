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

const STORAGE_KEY = "@diffgazer/docs-theme";
const DEFAULT_THEME: DocsTheme = "dark";

/** Browser and PWA chrome color per theme; mirrors the lib `--base-bg` values. */
export const THEME_COLORS: Record<DocsTheme, string> = {
  dark: "#0a0a0a",
  light: "#f7f8f5",
};

const NEXT_THEME: Record<DocsTheme, DocsTheme> = {
  dark: "light",
  light: "dark",
};

export function nextThemePreference(current: DocsTheme): DocsTheme {
  return NEXT_THEME[current];
}

/**
 * Accessible name for the chrome toggle. Its visible text is the current mode on
 * its own, so the name repeats that word (WCAG 2.5.3 Label in Name) and adds
 * what a click does. The bootstrap script writes the same strings pre-hydration.
 */
export function themeToggleLabel(theme: DocsTheme): string {
  return `Theme: ${theme}. Switch to ${NEXT_THEME[theme]}.`;
}

const TOGGLE_LABELS: Record<DocsTheme, string> = {
  dark: themeToggleLabel("dark"),
  light: themeToggleLabel("light"),
};

interface ThemeContextValue {
  theme: DocsTheme;
  setTheme: (next: DocsTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): DocsTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // Reading storage throws in locked-down browsers; fall back to the default.
  }
  return DEFAULT_THEME;
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
  defaultTheme: DEFAULT_THEME,
  themeColors: THEME_COLORS,
  toggleLabels: TOGGLE_LABELS,
};

/**
 * {@link themeBootstrap} serialized for the inline head script in routes/__root.tsx,
 * so the stored theme reaches the document before the first paint. It stamps
 * exactly what {@link applyTheme} stamps and labels the server-rendered toggle as its
 * markup is parsed.
 */
export const THEME_INIT_SCRIPT = `(${themeBootstrap.toString()})(${JSON.stringify(THEME_BOOTSTRAP_CONFIG)});`;

const useClientLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<DocsTheme>(DEFAULT_THEME);

  // Server markup and the first client render must agree, so the stored theme is read
  // after mount — in the layout phase, so it still lands before the browser paints.
  useClientLayoutEffect(() => {
    setThemeState(readStoredTheme());

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setThemeState(readStoredTheme());
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useClientLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function setTheme(next: DocsTheme) {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persistence is best-effort; ignore storage failures.
    }
  }

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
