import { z } from "zod";
import { REVIEW_SEVERITY, type ReviewSeverity } from "../review/issues.js";

export { REVIEW_SEVERITY as SEVERITY_ORDER };

// Lower rank = more severe (matches index in REVIEW_SEVERITY).
export const severityRank = (severity: ReviewSeverity): number =>
  REVIEW_SEVERITY.indexOf(severity);

export const SEVERITY_LABELS: Record<ReviewSeverity, string> = {
  blocker: "BLOCKER",
  high: "HIGH",
  medium: "MED",
  low: "LOW",
  nit: "NIT",
};

export type UISeverityFilter = ReviewSeverity | "all";

const SeverityCountsSchema = z.object({
  blocker: z.number(),
  high: z.number(),
  medium: z.number(),
  low: z.number(),
  nit: z.number(),
});
export type SeverityCounts = z.infer<typeof SeverityCountsSchema>;

export function calculateSeverityCounts(issues: { severity: ReviewSeverity }[]): SeverityCounts {
  const counts: SeverityCounts = { blocker: 0, high: 0, medium: 0, low: 0, nit: 0 };
  for (const issue of issues) {
    counts[issue.severity]++;
  }
  return counts;
}
