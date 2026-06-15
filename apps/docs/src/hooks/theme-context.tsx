import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

export type DocsTheme = "dark" | "light";

const STORAGE_KEY = "@diffgazer/docs-theme";
const DEFAULT_THEME: DocsTheme = "dark";

interface ThemeContextValue {
  theme: DocsTheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: DocsTheme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

function readStoredTheme(): DocsTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<DocsTheme>(DEFAULT_THEME);

  // The no-flash inline script in the root document sets data-theme before
  // hydration; adopt the stored value into React state on mount so the toggle
  // and the consuming components stay in sync.
  useEffect(() => {
    setThemeState(readStoredTheme());
  }, []);

  function setTheme(next: DocsTheme) {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persistence is best-effort; ignore storage failures.
    }
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return <ThemeContext value={{ theme, toggleTheme }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
