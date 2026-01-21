import type { ReviewSeverity } from "@repo/schemas/review";

export const SEVERITY_COLORS: Record<ReviewSeverity, string> = {
  critical: "red",
  warning: "yellow",
  suggestion: "blue",
  nitpick: "gray",
};
