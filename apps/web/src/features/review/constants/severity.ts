import type { TriageSeverity } from "@repo/schemas";

export type SeverityLevel = "blocker" | "high" | "medium" | "low";

export interface SeverityConfig {
  icon: string;
  color: string;
  label: string;
}

export const SEVERITY_CONFIG: Record<SeverityLevel, SeverityConfig> = {
  blocker: { icon: "X", color: "text-tui-red", label: "BLOCKER" },
  high: { icon: "!", color: "text-tui-yellow", label: "HIGH" },
  medium: { icon: "-", color: "text-gray-400", label: "MED" },
  low: { icon: ".", color: "text-gray-500", label: "LOW" },
};

export const SEVERITY_ORDER: readonly SeverityLevel[] = ["blocker", "high", "medium", "low"] as const;

export function getSeverityCounts<T extends { severity: TriageSeverity }>(
  issues: T[]
): Record<SeverityLevel, number> {
  return issues.reduce(
    (acc, issue) => {
      const sev = issue.severity as SeverityLevel;
      if (sev in acc) acc[sev]++;
      return acc;
    },
    { blocker: 0, high: 0, medium: 0, low: 0 }
  );
}
