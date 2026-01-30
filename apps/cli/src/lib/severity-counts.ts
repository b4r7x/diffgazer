import type { SeverityLevel } from "../types/severity.js";

export type SeverityCounts = Record<SeverityLevel, number>;

interface HasSeverity {
  severity: SeverityLevel;
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
