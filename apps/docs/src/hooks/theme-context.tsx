import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

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

/**
 * Pre-hydration bootstrap, injected inline in the document head (routes/__root.tsx)
 * so the stored preference reaches the document before the first paint. It stamps
 * exactly what {@link applyTheme} stamps and labels the server-rendered toggle as
 * its markup is parsed. Everything interpolated below is a module constant.
 *
 * The theme-color meta is created here rather than rendered by React: React 19
 * treats meta as a hoistable it matches by attributes during hydration, so a tag
 * this script had already retinted would be duplicated rather than adopted.
 *
 * The whole body is wrapped in one try/catch, as next-themes' own ThemeScript is:
 * this runs in <head> before anything is painted, so a browser missing matchMedia
 * or MutationObserver would otherwise abort the bootstrap half-applied and report
 * an uncaught error on every load. Bailing out leaves the shell's served theme in
 * place. The inner storage try/catch stays: that one is a partial failure the
 * script recovers from rather than a reason to give up.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;var p=${JSON.stringify(DEFAULT_PREFERENCE)};try{var s=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(s==="dark"||s==="light"||s==="system")p=s}catch(e){}var t=p==="system"?(window.matchMedia(${JSON.stringify(DARK_SCHEME_QUERY)}).matches?"dark":"light"):p;d.setAttribute("data-theme",t);d.style.colorScheme=t;var c=document.createElement("meta");c.setAttribute("name","theme-color");c.setAttribute("content",${JSON.stringify(THEME_COLORS)}[t]);document.head.appendChild(c);var L=${JSON.stringify(TOGGLE_LABELS)};function u(e){e.setAttribute("aria-label",L[p]);e.textContent=p}function y(e){if(e.nodeType!==1)return;if(e.matches("[data-docs-theme-toggle]"))u(e);e.querySelectorAll("[data-docs-theme-toggle]").forEach(u)}var o=new MutationObserver(function(r){r.forEach(function(m){m.addedNodes.forEach(y)})});o.observe(d,{childList:true,subtree:true});y(d);document.addEventListener("DOMContentLoaded",function(){o.disconnect()},{once:true})}catch(err){}})();`;

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
