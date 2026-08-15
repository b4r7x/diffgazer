import { REVIEW_SEVERITY, type ReviewSeverity } from "../review/issues.js";

export { REVIEW_SEVERITY as SEVERITY_ORDER };

export const SEVERITY_LABELS: Record<ReviewSeverity, string> = {
  blocker: "BLOCKER",
  high: "HIGH",
  medium: "MED",
  low: "LOW",
  nit: "NIT",
};

export type UISeverityFilter = ReadonlySet<ReviewSeverity>;
