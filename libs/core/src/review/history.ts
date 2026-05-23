import type { ReviewMetadata, ReviewSeverity } from "@diffgazer/core/schemas/review";
import type { TimelineItem } from "@diffgazer/core/schemas/presentation";
import { getDateKey, getDateLabel, getTimestamp } from "@diffgazer/core/format";

export const HISTORY_SECTION_ALL_ID = "all";
export const HISTORY_SECTION_ALL_LABEL = "All";

export interface SeverityPart {
  severity: ReviewSeverity;
  count: number;
}

export interface RunSummaryParts {
  passed: boolean;
  parts: SeverityPart[];
  issueCount: number;
}

export interface ReviewListItem {
  id: string;
  displayId: string;
  branch: string;
  timestamp: string;
  summary: string;
  date: string;
  issueCount: number;
  severities: SeverityPart[];
  duration: number;
  mode: string;
}

export interface DateGroup<TItem = ReviewListItem> {
  dateKey: string;
  label: string;
  reviews: TItem[];
}

export function getRunDisplayId(metadata: ReviewMetadata): string {
  return `#${metadata.id.slice(0, 4)}`;
}

export function getRunBranchLabel(metadata: ReviewMetadata): string {
  return metadata.mode === "staged" ? "Staged" : metadata.branch ?? "Main";
}

export function durationMsToSeconds(durationMs: number | undefined | null): number {
  if (durationMs == null) return 0;
  return Math.round(durationMs / 1000);
}

export function getRunSummaryParts(metadata: ReviewMetadata): RunSummaryParts {
  const { blockerCount, highCount, mediumCount, lowCount, nitCount, issueCount } = metadata;

  if (issueCount === 0) {
    return { passed: true, parts: [], issueCount: 0 };
  }

  const parts: SeverityPart[] = [];
  if (blockerCount > 0) parts.push({ severity: "blocker", count: blockerCount });
  if (highCount > 0) parts.push({ severity: "high", count: highCount });
  if (mediumCount > 0) parts.push({ severity: "medium", count: mediumCount });
  if (lowCount > 0) parts.push({ severity: "low", count: lowCount });
  if (nitCount > 0) parts.push({ severity: "nit", count: nitCount });

  return { passed: false, parts, issueCount };
}

export function getRunSummaryText(metadata: ReviewMetadata): string {
  const summary = getRunSummaryParts(metadata);
  if (summary.passed) return "Passed with no issues.";
  if (summary.parts.length === 0) {
    return `Found ${summary.issueCount} issue${summary.issueCount === 1 ? "" : "s"}.`;
  }
  return summary.parts.map((p) => `${p.count} ${p.severity}`).join(", ");
}

export function buildReviewListItem(metadata: ReviewMetadata): ReviewListItem {
  const summary = getRunSummaryParts(metadata);
  return {
    id: metadata.id,
    displayId: getRunDisplayId(metadata),
    branch: getRunBranchLabel(metadata),
    timestamp: getTimestamp(metadata.createdAt),
    summary: getRunSummaryText(metadata),
    date: metadata.createdAt,
    issueCount: metadata.issueCount,
    severities: summary.parts,
    duration: durationMsToSeconds(metadata.durationMs),
    mode: metadata.mode ?? "unstaged",
  };
}

export function matchesHistoryQuery(metadata: ReviewMetadata, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  if (metadata.id.toLowerCase().includes(normalized)) return true;
  if (getRunDisplayId(metadata).toLowerCase().includes(normalized)) return true;
  const branchText =
    metadata.mode === "staged" ? "staged" : metadata.branch?.toLowerCase() ?? "main";
  if (branchText.includes(normalized)) return true;
  if (metadata.projectPath.toLowerCase().includes(normalized)) return true;
  return false;
}

export function groupByDate<TItem>(
  reviews: ReviewMetadata[],
  mapItem: (metadata: ReviewMetadata) => TItem,
): DateGroup<TItem>[] {
  const groups = new Map<string, { label: string; items: TItem[] }>();

  for (const review of reviews) {
    const key = getDateKey(review.createdAt);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(mapItem(review));
    } else {
      groups.set(key, { label: getDateLabel(review.createdAt), items: [mapItem(review)] });
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, { label, items }]) => ({ dateKey, label, reviews: items }));
}

export function buildTimelineItems(reviews: ReviewMetadata[]): TimelineItem[] {
  const allItem: TimelineItem = {
    id: HISTORY_SECTION_ALL_ID,
    label: HISTORY_SECTION_ALL_LABEL,
    count: reviews.length,
  };

  if (reviews.length === 0) return [allItem];

  const groups = new Map<string, { label: string; count: number }>();

  for (const review of reviews) {
    const key = getDateKey(review.createdAt);
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
    } else {
      groups.set(key, { label: getDateLabel(review.createdAt), count: 1 });
    }
  }

  const datedItems = Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([id, { label, count }]) => ({ id, label, count }));

  return [allItem, ...datedItems];
}

export function resolveSelectedDateId(
  selectedDateId: string,
  timelineItems: Array<{ id: string }>,
): string {
  if (timelineItems.some((item) => item.id === selectedDateId)) return selectedDateId;
  return timelineItems[0]?.id ?? HISTORY_SECTION_ALL_ID;
}

export function resolveSelectedRunId<T extends { id: string }>(
  selectedRunId: string | null,
  runs: T[],
): string | null {
  if (selectedRunId !== null && runs.some((run) => run.id === selectedRunId)) {
    return selectedRunId;
  }
  return runs[0]?.id ?? null;
}

export function getEmptyRunsMessage(
  hasReviews: boolean,
  hasSearchQuery: boolean,
  selectedDateId: string,
): string {
  if (!hasReviews) return "No reviews yet";
  if (hasSearchQuery) return "No runs match this search";
  if (selectedDateId === HISTORY_SECTION_ALL_ID) return "No runs available";
  return "No runs for this date";
}
