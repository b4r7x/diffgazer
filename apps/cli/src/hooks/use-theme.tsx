import { createContext, useContext, useMemo, type ReactNode, type ReactElement } from "react";
import type { Theme } from "@repo/schemas/settings";
import { getTheme, getThemeColors, type ThemeTokens, type ThemeColors } from "../lib/theme.js";

interface ThemeContextValue {
  theme: Theme;
  tokens: ThemeTokens;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  theme: Theme;
  children: ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps): ReactElement {
  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      tokens: getTheme(theme),
      colors: getThemeColors(theme),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: "auto",
      tokens: getTheme("auto"),
      colors: getThemeColors("auto"),
    };
  }
  return context;
}

export function useThemeTokens(): ThemeTokens {
  const context = useContext(ThemeContext);
  if (!context) {
    return getTheme("auto");
  }
  return context.tokens;
}

export function useThemeColors(): ThemeColors {
  const context = useContext(ThemeContext);
  if (!context) {
    return getThemeColors("auto");
  }
  return context.colors;
}

export type { ThemeTokens, ThemeColors, ThemeContextValue };
