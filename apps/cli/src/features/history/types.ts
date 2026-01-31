import type { ReviewHistoryMetadata } from "@repo/schemas/review-history";
import type { TimelineItem } from "@repo/schemas/ui";
import { capitalize } from "@repo/core";
import { formatDateLabel } from "../../lib/format.js";
import type {
  HistoryRun,
  HistoryTabId as TabId,
  HistoryFocusZone as FocusZone,
  HistoryState,
} from "@repo/schemas/history";

export type { TimelineItem, HistoryRun, HistoryState };
export type { HistoryTabId as TabId, HistoryFocusZone as FocusZone } from "@repo/schemas/history";

// Transform ReviewHistoryMetadata to HistoryRun
export function toHistoryRun(review: ReviewHistoryMetadata): HistoryRun {
  const date = new Date(review.createdAt);
  const dateLabel = formatDateLabel(date);

  // Build summary from counts
  const parts: string[] = [];
  if (review.criticalCount > 0) parts.push(`${review.criticalCount} critical`);
  if (review.warningCount > 0) parts.push(`${review.warningCount} warnings`);
  const issueText = review.issueCount === 1 ? "issue" : "issues";
  const summary = parts.length > 0
    ? `${review.issueCount} ${issueText}: ${parts.join(", ")}`
    : `${review.issueCount} ${issueText} found`;

  return {
    id: review.id,
    displayId: `#${review.id.slice(0, 4)}`,
    date: dateLabel,
    branch: review.branch ?? "unknown",
    provider: review.staged ? "Staged" : "Unstaged",
    timestamp: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    summary,
    issues: [],
    issueCount: review.issueCount,
    criticalCount: review.criticalCount,
    warningCount: review.warningCount,
  };
}

// Group runs by date into timeline items
export function toTimelineItems(runs: HistoryRun[]): TimelineItem[] {
  const grouped = new Map<string, number>();
  for (const run of runs) {
    grouped.set(run.date, (grouped.get(run.date) ?? 0) + 1);
  }

  const dateOrder = ["all", "today", "yesterday"];
  const items: TimelineItem[] = [];

  // Always add "All" option first
  items.push({ id: "all", label: "All", count: runs.length });

  for (const [date, count] of grouped) {
    const label = date === "today" ? "Today" : date === "yesterday" ? "Yesterday" : capitalize(date);
    items.push({ id: date, label, count });
  }

  items.sort((a, b) => {
    const aIdx = dateOrder.indexOf(a.id);
    const bIdx = dateOrder.indexOf(b.id);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.id.localeCompare(b.id);
  });

  return items;
}
