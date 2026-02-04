import type { TriageSeverity } from "@stargazer/schemas/triage";
import type { SeverityCounts } from "@stargazer/schemas/ui";

// Re-export display constants from @stargazer/schemas for backwards compatibility
export {
  SEVERITY_ORDER,
  SEVERITY_LABELS,
  SEVERITY_ICONS,
  SEVERITY_COLORS,
  HISTOGRAM_SEVERITIES,
} from "@stargazer/schemas/ui";

export type { SeverityCounts };

interface HasSeverity {
  severity: TriageSeverity;
}

/**
 * Calculate the count of each severity level from a list of issues.
 */
export function calculateSeverityCounts<T extends HasSeverity>(issues: T[]): SeverityCounts {
  const counts: SeverityCounts = {
    blocker: 0,
    high: 0,
    medium: 0,
    low: 0,
    nit: 0,
  };

  for (const issue of issues) {
    counts[issue.severity]++;
  }

  return counts;
}
