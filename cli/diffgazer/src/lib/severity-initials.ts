import type { ReviewSeverity } from "@diffgazer/core/schemas/review";

/** Single-letter severity labels for panes too narrow to spell the word out. */
export const SEVERITY_INITIALS: Record<ReviewSeverity, string> = {
  blocker: "B",
  high: "H",
  medium: "M",
  low: "L",
  nit: "N",
};
