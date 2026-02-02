import type { ReviewHistoryMetadata } from "@repo/schemas/review-history";
import type { TriageReviewMetadata } from "@repo/schemas/triage-storage";
import type { TimelineItem } from "@repo/schemas/ui";
import { capitalize } from "@repo/core";
import { formatDateLabel } from "../../lib/format.js";
import type {
  HistoryRun,
  HistoryFocusZone as FocusZone,
  HistoryState,
} from "@repo/schemas/history";

// CLI-specific tab type that includes sessions (web app removed this)
export type TabId = "runs" | "sessions";
export type { TimelineItem, HistoryRun, HistoryState };
export type { HistoryFocusZone as FocusZone } from "@repo/schemas/history";

type AnyReviewMetadata = ReviewHistoryMetadata | TriageReviewMetadata;

function isTriageMetadata(meta: AnyReviewMetadata): meta is TriageReviewMetadata {
  return "blockerCount" in meta;
}

export function toHistoryRun(review: AnyReviewMetadata): HistoryRun {
  const date = new Date(review.createdAt);
  const isTriage = isTriageMetadata(review);

  const critical = isTriage ? review.blockerCount : review.criticalCount;
  const warning = isTriage ? review.highCount : review.warningCount;

  const parts: string[] = [];
  if (critical > 0) parts.push(`${critical} ${isTriage ? "blocker" : "critical"}`);
  if (warning > 0) parts.push(`${warning} ${isTriage ? "high" : "warnings"}`);

  const issueText = review.issueCount === 1 ? "issue" : "issues";
  const summary = parts.length > 0
    ? `${review.issueCount} ${issueText}: ${parts.join(", ")}`
    : `${review.issueCount} ${issueText} found`;

  return {
    id: review.id,
    displayId: `#${review.id.slice(0, 4)}`,
    date: formatDateLabel(date),
    branch: review.branch ?? "unknown",
    provider: review.staged ? "Staged" : "Unstaged",
    timestamp: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    summary,
    issues: [],
    issueCount: review.issueCount,
    criticalCount: critical,
    warningCount: warning,
  };
}

function getDateLabel(date: string): string {
  if (date === "today") return "Today";
  if (date === "yesterday") return "Yesterday";
  return capitalize(date);
}

export function toTimelineItems(runs: HistoryRun[]): TimelineItem[] {
  const grouped = new Map<string, number>();
  for (const run of runs) {
    grouped.set(run.date, (grouped.get(run.date) ?? 0) + 1);
  }

  const dateOrder = ["all", "today", "yesterday"];
  const items: TimelineItem[] = [{ id: "all", label: "All", count: runs.length }];

  for (const [date, count] of grouped) {
    items.push({ id: date, label: getDateLabel(date), count });
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
