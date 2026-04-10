import type { ReviewMetadata } from "@diffgazer/schemas/review";
import { getDateKey, getDateLabel, getTimestamp } from "@diffgazer/core/format";
import type { ReviewItem, DateGroup } from "./types.js";

export function formatDurationSeconds(durationMs: number | undefined): number {
  if (!durationMs) return 0;
  return Math.round(durationMs / 1000);
}

export function getRunSummary(r: ReviewMetadata): string {
  if (r.issueCount === 0) return "Passed with no issues.";
  const parts: string[] = [];
  if (r.blockerCount > 0) parts.push(`${r.blockerCount} blocker`);
  if (r.highCount > 0) parts.push(`${r.highCount} high`);
  if (r.mediumCount > 0) parts.push(`${r.mediumCount} medium`);
  if (r.lowCount > 0) parts.push(`${r.lowCount} low`);
  if (parts.length === 0) return `Found ${r.issueCount} issue${r.issueCount === 1 ? "" : "s"}.`;
  return parts.join(", ");
}

export function metadataToSeverities(r: ReviewMetadata): Array<{ severity: string; count: number }> {
  const severities: Array<{ severity: string; count: number }> = [];
  if (r.blockerCount > 0) severities.push({ severity: "blocker", count: r.blockerCount });
  if (r.highCount > 0) severities.push({ severity: "high", count: r.highCount });
  if (r.mediumCount > 0) severities.push({ severity: "medium", count: r.mediumCount });
  if (r.lowCount > 0) severities.push({ severity: "low", count: r.lowCount });
  if (r.nitCount > 0) severities.push({ severity: "nit", count: r.nitCount });
  return severities;
}

export function toReviewItem(r: ReviewMetadata): ReviewItem {
  return {
    id: r.id,
    displayId: `#${r.id.slice(0, 4)}`,
    branch: r.mode === "staged" ? "Staged" : r.branch ?? "Main",
    timestamp: getTimestamp(r.createdAt),
    summary: getRunSummary(r),
    date: r.createdAt,
    issueCount: r.issueCount,
    severities: metadataToSeverities(r),
    duration: formatDurationSeconds(r.durationMs),
    mode: r.mode ?? "unstaged",
  };
}

export function matchesSearch(r: ReviewMetadata, query: string): boolean {
  if (r.id.toLowerCase().includes(query)) return true;
  if (`#${r.id.slice(0, 4)}`.toLowerCase().includes(query)) return true;
  const branchText = r.mode === "staged" ? "staged" : (r.branch?.toLowerCase() ?? "main");
  if (branchText.includes(query)) return true;
  if (r.projectPath.toLowerCase().includes(query)) return true;
  return false;
}

export function groupByDate(reviews: ReviewMetadata[]): DateGroup[] {
  const groups = new Map<string, { label: string; items: ReviewItem[] }>();

  for (const r of reviews) {
    const key = getDateKey(r.createdAt);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(toReviewItem(r));
    } else {
      groups.set(key, { label: getDateLabel(r.createdAt), items: [toReviewItem(r)] });
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, { label, items }]) => ({ dateKey, label, reviews: items }));
}
