import type { Theme } from '@repo/schemas';

export type WebTheme = Exclude<Theme, "terminal">;  // "auto" | "dark" | "light"
export type ResolvedTheme = "dark" | "light";

export interface ThemeContextValue {
  theme: WebTheme;
  resolved: ResolvedTheme;
  setTheme: (theme: WebTheme) => void;
}
