import type { Theme } from '@repo/schemas/settings';

export type WebTheme = Exclude<Theme, "terminal">;  // "auto" | "dark" | "light"
export type ResolvedTheme = "dark" | "light";

export interface ThemeContextValue {
  theme: WebTheme;
  resolved: ResolvedTheme;
  setTheme: (theme: WebTheme) => void;
}

export function toWebTheme(theme: Theme): WebTheme {
  return theme === "terminal" ? "dark" : theme;
}
