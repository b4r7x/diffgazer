export type WebTheme = "auto" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";

export interface ThemeContextValue {
  theme: WebTheme;
  resolved: ResolvedTheme;
  setTheme: (theme: WebTheme) => void;
  setPreview: (theme: ResolvedTheme | null) => void;
}
