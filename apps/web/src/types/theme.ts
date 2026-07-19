import type { Theme } from "@diffgazer/core/schemas/config";

export type WebTheme = Extract<Theme, "auto" | "dark" | "light">;
export type ResolvedTheme = Extract<Theme, "dark" | "light">;

export interface ThemeContextValue {
  theme: WebTheme;
  resolved: ResolvedTheme;
  system: ResolvedTheme;
  setTheme: (theme: WebTheme) => Promise<void>;
}
