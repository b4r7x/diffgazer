import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CliColorTokens } from "./palettes.js";
import { darkPalette, lightPalette, highContrastPalette, palettes } from "./palettes.js";

interface CliThemeContextValue {
  tokens: CliColorTokens;
  themeName: string;
  setTheme: (name: string) => void;
}

const CliThemeContext = createContext<CliThemeContextValue | null>(null);

function detectDefaultPalette(): { name: string; tokens: CliColorTokens } {
  const colorfgbg = process.env["COLORFGBG"];
  if (colorfgbg) {
    const parts = colorfgbg.split(";");
    const last = parts[parts.length - 1];
    if (last !== undefined) {
      const num = Number.parseInt(last, 10);
      if (!Number.isNaN(num) && num <= 6) {
        return { name: "light", tokens: lightPalette };
      }
    }
  }
  return { name: "dark", tokens: darkPalette };
}

function resolvePalette(name: string): { name: string; tokens: CliColorTokens } {
  if (name === "auto") {
    return detectDefaultPalette();
  }
  const tokens = palettes[name];
  if (tokens) {
    return { name, tokens };
  }
  return { name: "dark", tokens: darkPalette };
}

interface CliThemeProviderProps {
  initialTheme?: string;
  children: ReactNode;
}

export function CliThemeProvider({ initialTheme, children }: CliThemeProviderProps) {
  const [theme, setThemeState] = useState(() =>
    resolvePalette(initialTheme ?? "auto"),
  );

  const setTheme = useCallback((name: string) => {
    setThemeState(resolvePalette(name));
  }, []);

  const value = useMemo<CliThemeContextValue>(() => ({
    tokens: theme.tokens,
    themeName: theme.name,
    setTheme,
  }), [theme.tokens, theme.name, setTheme]);

  return (
    <CliThemeContext value={value}>
      {children}
    </CliThemeContext>
  );
}

export function useTheme(): CliThemeContextValue {
  const value = useContext(CliThemeContext);
  if (!value) {
    throw new Error("useTheme must be used within a CliThemeProvider");
  }
  return value;
}
