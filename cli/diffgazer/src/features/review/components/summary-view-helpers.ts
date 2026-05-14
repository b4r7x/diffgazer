import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import type { LensStats } from "@diffgazer/core/schemas/ui";

export function buildLensStats(issues: ReviewIssue[]): LensStats[] {
  const counts: Record<string, number> = {};
  for (const issue of issues) {
    counts[issue.category] = (counts[issue.category] ?? 0) + 1;
  }
  return Object.entries(counts).map(([category, count]) => ({
    id: category,
    name: category.charAt(0).toUpperCase() + category.slice(1),
    icon: "",
    count,
    change: 0,
  }));
}
