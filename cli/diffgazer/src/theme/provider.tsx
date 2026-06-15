import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import type { CliColorTokens } from "./palettes";
import { darkPalette, lightPalette, palettes } from "./palettes";

interface CliThemeContextValue {
  tokens: CliColorTokens;
  themeName: string;
  setTheme: (name: string) => void;
}

const CliThemeContext = createContext<CliThemeContextValue | null>(null);

/**
 * Map COLORFGBG to a palette name. The last segment is the terminal background
 * color (rxvt/Konsole/vim convention): 0-6 or 8 mean a dark background, 7 or
 * 9-15 mean a light background; a missing or unparsable value defaults to dark.
 */
export function detectPaletteNameFromColorFgBg(value: string | undefined): "dark" | "light" {
  if (!value) {
    return "dark";
  }
  const parts = value.split(";");
  const last = parts[parts.length - 1];
  if (last === undefined) {
    return "dark";
  }
  const num = Number.parseInt(last, 10);
  if (Number.isNaN(num)) {
    return "dark";
  }
  return num === 7 || (num >= 9 && num <= 15) ? "light" : "dark";
}

function detectDefaultPalette(): { name: string; tokens: CliColorTokens } {
  const name = detectPaletteNameFromColorFgBg(process.env.COLORFGBG);
  return { name, tokens: name === "light" ? lightPalette : darkPalette };
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
  const [theme, setThemeState] = useState(() => resolvePalette(initialTheme ?? "auto"));

  const setTheme = (name: string) => {
    setThemeState(resolvePalette(name));
  };

  const value: CliThemeContextValue = {
    tokens: theme.tokens,
    themeName: theme.name,
    setTheme,
  };

  return <CliThemeContext value={value}>{children}</CliThemeContext>;
}

export function useTheme(): CliThemeContextValue {
  const value = useContext(CliThemeContext);
  if (!value) {
    throw new Error("useTheme must be used within a CliThemeProvider");
  }
  return value;
}
