import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

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

function readDocumentTheme(): DocsTheme {
  const theme = document.documentElement.getAttribute("data-theme");
  return theme === "light" || theme === "dark" ? theme : DEFAULT_THEME;
}

export const THEME_INIT_SCRIPT = `(function(){var t="dark";try{var s=localStorage.getItem("@diffgazer/docs-theme");if(s==="light"||s==="dark")t=s}catch(e){}document.documentElement.setAttribute("data-theme",t);function u(e){var n=t==="dark"?"light":"dark";e.setAttribute("aria-label","Switch to "+n+" theme");e.textContent=n}function y(e){if(e.nodeType!==1)return;if(e.matches("[data-docs-theme-toggle]"))u(e);e.querySelectorAll("[data-docs-theme-toggle]").forEach(u)}var o=new MutationObserver(function(r){r.forEach(function(m){m.addedNodes.forEach(y)})});o.observe(document.documentElement,{childList:true,subtree:true});y(document.documentElement);document.addEventListener("DOMContentLoaded",function(){o.disconnect()},{once:true})})();`;

const useClientLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<DocsTheme>(DEFAULT_THEME);

  useClientLayoutEffect(() => {
    setThemeState(readDocumentTheme());
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
