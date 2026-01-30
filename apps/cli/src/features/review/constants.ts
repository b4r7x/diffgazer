import type { TriageSeverity } from "@repo/schemas/triage";

export type IssueTab = "details" | "explain" | "trace" | "patch";

export const TAB_ORDER = ["details", "explain", "trace", "patch"] as const;

export const TAB_LABELS: Record<IssueTab, string> = {
  details: "Details",
  explain: "Explain",
  trace: "Trace",
  patch: "Patch",
};

export const TAB_KEYS: Record<IssueTab, string> = {
  details: "1",
  explain: "2",
  trace: "3",
  patch: "4",
};

export const TRIAGE_SEVERITY_COLORS: Record<TriageSeverity, string> = {
  blocker: "red",
  high: "magenta",
  medium: "yellow",
  low: "blue",
  nit: "gray",
};
