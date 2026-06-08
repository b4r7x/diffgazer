/**
 * Canonical theme token vocabulary shared between every rendering app
 * (web Tailwind/CSS variables, CLI Ink hex colors). Values are NOT part of
 * the contract — each app maps these keys to its own medium.
 *
 * Groupings:
 *   - PRIMITIVE_TOKEN_KEYS — raw color slots (bg/fg + palette ramps + chrome).
 *   - SEMANTIC_TOKEN_KEYS  — role-based slots (success/warning/error/info/accent).
 *   - SEVERITY_TOKEN_KEYS  — review-issue severity slots.
 *   - STATUS_TOKEN_KEYS    — pipeline/run status slots.
 *
 * Source of truth derived from `cli/diffgazer/src/theme/palettes.ts`
 * (CliColorTokens) and the matching `--tui-*` / `--severity-*` / `--status-*`
 * CSS variables in `apps/web/src/styles/theme-overrides.css`. Vocabulary
 * already aligns 1:1; this module locks the alignment as a type contract.
 */
export declare const PRIMITIVE_TOKEN_KEYS: readonly [
  "bg",
  "fg",
  "blue",
  "violet",
  "green",
  "red",
  "yellow",
  "border",
  "muted",
];
export declare const SEMANTIC_TOKEN_KEYS: readonly [
  "success",
  "warning",
  "error",
  "info",
  "accent",
];
export declare const SEVERITY_TOKEN_KEYS: readonly [
  "severityBlocker",
  "severityHigh",
  "severityMedium",
  "severityLow",
  "severityNit",
];
export declare const STATUS_TOKEN_KEYS: readonly [
  "statusRunning",
  "statusComplete",
  "statusPending",
];
export declare const THEME_TOKEN_KEYS: readonly [
  "bg",
  "fg",
  "blue",
  "violet",
  "green",
  "red",
  "yellow",
  "border",
  "muted",
  "success",
  "warning",
  "error",
  "info",
  "accent",
  "severityBlocker",
  "severityHigh",
  "severityMedium",
  "severityLow",
  "severityNit",
  "statusRunning",
  "statusComplete",
  "statusPending",
];
export type PrimitiveTokenKey = (typeof PRIMITIVE_TOKEN_KEYS)[number];
export type SemanticTokenKey = (typeof SEMANTIC_TOKEN_KEYS)[number];
export type SeverityTokenKey = (typeof SEVERITY_TOKEN_KEYS)[number];
export type StatusTokenKey = (typeof STATUS_TOKEN_KEYS)[number];
export type ThemeTokenKey = (typeof THEME_TOKEN_KEYS)[number];
