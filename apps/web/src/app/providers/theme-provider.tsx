"use client";

import { createContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ResolvedTheme, ThemeContextValue, WebTheme } from "@/types/theme";
import { api } from "@/lib/api";

function subscribeToSystemTheme(callback: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const STORAGE_KEY = "stargazer-theme";

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveWebTheme(value: string | null): WebTheme {
  if (value === "dark" || value === "light" || value === "auto") return value;
  return "auto";
}

function mapSettingsTheme(theme: string): WebTheme {
  if (theme === "terminal") return "dark";
  return resolveWebTheme(theme);
}

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [theme, setThemeState] = useState<WebTheme>(() => {
    if (typeof window === "undefined") return "auto";
    return resolveWebTheme(localStorage.getItem(STORAGE_KEY));
  });

  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    () => "dark" as ResolvedTheme
  );

  const resolved: ResolvedTheme = theme === "auto" ? systemTheme : theme;

  useEffect(() => {
    let isMounted = true;

    api
      .getSettings()
      .then((settings) => {
        if (!isMounted) return;
        if (settings?.theme) {
          const webTheme = mapSettingsTheme(settings.theme);
          setThemeState(webTheme);
          localStorage.setItem(STORAGE_KEY, webTheme);
        }
      })
      .catch(() => {
        // Fallback: keep local storage value
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  const setTheme = (newTheme: WebTheme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    api.saveSettings({ theme: newTheme }).catch((err) => {
      console.error("Failed to sync theme to server:", err);
    });
  };

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}
