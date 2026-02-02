import type { IssueTab } from "@repo/schemas/ui";

export type { IssueTab } from "@repo/schemas/ui";

export const TAB_ORDER: IssueTab[] = ["details", "explain", "trace", "patch"];

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

export const AGENT_PANEL_WIDTH = 28;
export const MAX_PATCH_LINES = 30;
