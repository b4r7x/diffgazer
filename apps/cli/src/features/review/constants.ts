import type { ReviewSeverity } from "@repo/schemas/review";
import type { TriageSeverity } from "@repo/schemas/triage";

export const SEVERITY_COLORS: Record<ReviewSeverity, string> = {
  critical: "red",
  warning: "yellow",
  suggestion: "blue",
  nitpick: "gray",
};

export const TRIAGE_SEVERITY_COLORS: Record<TriageSeverity, string> = {
  blocker: "red",
  high: "magenta",
  medium: "yellow",
  low: "blue",
  nit: "gray",
};

export const TRIAGE_SEVERITY_ORDER: Record<TriageSeverity, number> = {
  blocker: 0,
  high: 1,
  medium: 2,
  low: 3,
  nit: 4,
};
