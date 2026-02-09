import type { ReviewMetadata } from "@diffgazer/schemas/review";
import type { TimelineItem } from "@diffgazer/schemas/ui";
import { HISTORY_SECTION_ALL_ID, HISTORY_SECTION_ALL_LABEL } from "@/features/history/constants";

export function getDateKey(dateStr: string): string {
  return dateStr.slice(0, 10); // "2024-01-15T..." -> "2024-01-15"
}

export function getDateLabel(dateStr: string): string {
  const dateKey = getDateKey(dateStr);
  const now = new Date();
  const today = getDateKey(now.toISOString());
  const yesterday = getDateKey(new Date(now.getTime() - 86400000).toISOString());

  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function getRunSummary(metadata: ReviewMetadata): React.ReactNode {
  const { blockerCount, highCount, mediumCount, lowCount, issueCount } = metadata;

  if (issueCount === 0) return "Passed with no issues.";

  const parts: React.ReactNode[] = [];

  if (blockerCount > 0) parts.push(<span key="blocker" className="text-tui-red">{blockerCount} blocker</span>);
  if (highCount > 0) parts.push(<span key="high" className="text-tui-yellow">{highCount} high</span>);
  if (mediumCount > 0) parts.push(<span key="medium" className="text-tui-blue">{mediumCount} medium</span>);
  if (lowCount > 0) parts.push(<span key="low" className="text-tui-cyan">{lowCount} low</span>);

  if (parts.length === 0) {
    return `Found ${issueCount} issue${issueCount === 1 ? "" : "s"}.`;
  }

  return <>{parts.reduce<React.ReactNode[]>((acc, part, i) => {
    if (i > 0) acc.push(", ");
    acc.push(part);
    return acc;
  }, [])}</>;
}

export function formatDuration(durationMs: number | null | undefined): string {
  if (!durationMs) return "--";
  const seconds = Math.floor(durationMs / 1000);
  if (seconds === 0) return `${durationMs}ms`;
  if (seconds < 60) return `${seconds}.${Math.floor((durationMs % 1000) / 100)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function buildTimelineItems(reviews: ReviewMetadata[]): TimelineItem[] {
  const allItem: TimelineItem = {
    id: HISTORY_SECTION_ALL_ID,
    label: HISTORY_SECTION_ALL_LABEL,
    count: reviews.length,
  };

  if (reviews.length === 0) {
    return [allItem];
  }

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
