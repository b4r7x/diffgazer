import type { Theme } from "@diffgazer/core/schemas/config";

// The web UI exposes the subset of core themes it can render and select.
// Core's "terminal" theme is mapped to "dark" at the settings boundary
// (see mapSettingsTheme in theme-provider.tsx), so it is excluded here.
export type WebTheme = Extract<Theme, "auto" | "dark" | "light">;
export type ResolvedTheme = Extract<Theme, "dark" | "light">;

export interface ThemeContextValue {
  theme: WebTheme;
  resolved: ResolvedTheme;
  system: ResolvedTheme;
  setTheme: (theme: WebTheme) => Promise<void>;
}
