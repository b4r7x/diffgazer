import type { ReviewHistoryMetadata } from "@repo/schemas/review-history";
import type { SessionMetadataInfo } from "@repo/core/storage";
import type { TriageIssue } from "@repo/schemas";

export type TabId = "runs" | "sessions";
export type FocusZone = "timeline" | "runs" | "insights";

export interface TimelineItem {
  id: string;
  label: string;
  count: number;
}

export interface HistoryRun {
  id: string;
  displayId: string;
  date: string;
  branch: string;
  provider: string;
  timestamp: string;
  summary: string;
  issues: TriageIssue[];
  issueCount: number;
  criticalCount: number;
  warningCount: number;
}

export interface HistoryState {
  activeTab: TabId;
  focusZone: FocusZone;
  selectedDateId: string;
  selectedRunId: string | null;
  expandedRunId: string | null;
}

// Transform ReviewHistoryMetadata to HistoryRun
export function toHistoryRun(review: ReviewHistoryMetadata): HistoryRun {
  const date = new Date(review.createdAt);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let dateLabel: string;
  if (date.toDateString() === today.toDateString()) {
    dateLabel = "today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    dateLabel = "yesterday";
  } else {
    dateLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase().replace(" ", "");
  }

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

  const dateOrder = ["today", "yesterday"];
  const items: TimelineItem[] = [];

  for (const [date, count] of grouped) {
    const label = date === "today" ? "Today" : date === "yesterday" ? "Yesterday" : date.charAt(0).toUpperCase() + date.slice(1);
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
