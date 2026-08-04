import type { Theme } from "@diffgazer/core/schemas/config";

/**
 * The three themes the web app offers. The shared config schema is wider — the
 * TUI also has "terminal" — so config values are narrowed on read.
 */
export type WebTheme = Extract<Theme, "auto" | "dark" | "light">;

/** What actually gets painted: "auto" resolves to one of these via the OS preference. */
export type ResolvedTheme = Extract<Theme, "dark" | "light">;

export interface ThemeContextValue {
  /** The reader's choice, including "auto". */
  theme: WebTheme;
  /** The choice after "auto" is resolved against `system`; this is what the document wears. */
  resolved: ResolvedTheme;
  /** The current OS color scheme, tracked live. */
  system: ResolvedTheme;
  setTheme: (theme: WebTheme) => Promise<void>;
}

export function isWebTheme(value: string | null): value is WebTheme {
  return value === "auto" || value === "dark" || value === "light";
}
