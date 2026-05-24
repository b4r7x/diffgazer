// Color is decoration (WCAG 1.4.1) — consumers must pair intent with a glyph or text cue.
export type SidebarIntent =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "accent";

const INTENT_DICTIONARY: Record<string, SidebarIntent> = {
  added: "success",
  create: "success",
  new: "success",
  passed: "success",
  deleted: "danger",
  remove: "danger",
  failed: "danger",
  modified: "warning",
  updated: "warning",
  draft: "warning",
  renamed: "info",
  moved: "info",
  running: "info",
  active: "info",
  archived: "neutral",
  all: "neutral",
  pending: "neutral",
};

function normalizeIntentKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function resolveSidebarIntent(
  explicitIntent: SidebarIntent | undefined,
  value: string | undefined,
): SidebarIntent {
  if (explicitIntent) return explicitIntent;
  if (!value) return "neutral";
  return INTENT_DICTIONARY[normalizeIntentKey(value)] ?? "neutral";
}
