/**
 * Canonical theme token vocabulary shared between every rendering app
 * (web Tailwind/CSS variables, CLI Ink hex colors). Canonical dark and light
 * values live in palette-values.ts.
 *
 * This module owns the vocabulary; `cli/diffgazer/src/theme/palettes.ts`,
 * `apps/web/src/styles/theme-overrides.css` and `libs/ui/styles/theme.css`
 * implement it. The CSS variable names are mapped, not identical — the maps and
 * the enforcement live in `libs/ui/theme/theme-parity.test.ts` and
 * `apps/web/src/styles/theme-overrides.test.ts`.
 */

export const PRIMITIVE_TOKEN_KEYS = [
  "bg",
  "fg",
  "blue",
  "violet",
  "green",
  "red",
  "yellow",
  "border",
  "muted",
] as const;

export const SEMANTIC_TOKEN_KEYS = ["success", "warning", "error", "info", "accent"] as const;

export const SEVERITY_TOKEN_KEYS = [
  "severityBlocker",
  "severityHigh",
  "severityMedium",
  "severityLow",
  "severityNit",
] as const;

export const STATUS_TOKEN_KEYS = ["statusRunning", "statusComplete", "statusPending"] as const;

export const THEME_TOKEN_KEYS = [
  ...PRIMITIVE_TOKEN_KEYS,
  ...SEMANTIC_TOKEN_KEYS,
  ...SEVERITY_TOKEN_KEYS,
  ...STATUS_TOKEN_KEYS,
] as const;

export type PrimitiveTokenKey = (typeof PRIMITIVE_TOKEN_KEYS)[number];

export type ThemeTokenKey = (typeof THEME_TOKEN_KEYS)[number];
