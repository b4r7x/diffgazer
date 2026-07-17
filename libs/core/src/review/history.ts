import { getDateKey, getDateLabel, getTimestamp } from "../format.js";
import type { SeverityCounts, TimelineItem } from "../schemas/presentation/index.js";
import { SEVERITY_ORDER } from "../schemas/presentation/index.js";
import type {
  ReviewIssue,
  ReviewListWarning,
  ReviewMetadata,
  ReviewSeverity,
} from "../schemas/review/index.js";
import { pluralize } from "../strings.js";

export const HISTORY_SECTION_ALL_ID = "all";
export const HISTORY_SECTION_ALL_LABEL = "All";

export interface HistoryWarningSummary {
  unreadableReviewCount: number;
  droppedIssueCount: number;
  indexBuildFailed: boolean;
  indexRewriteFailed: boolean;
}

export function summarizeHistoryWarnings(
  warnings: readonly ReviewListWarning[],
): HistoryWarningSummary {
  const summary: HistoryWarningSummary = {
    unreadableReviewCount: 0,
    droppedIssueCount: 0,
    indexBuildFailed: false,
    indexRewriteFailed: false,
  };

  for (const warning of warnings) {
    switch (warning.kind) {
      case "unreadable_review":
        summary.unreadableReviewCount += 1;
        break;
      case "invalid_issues_dropped":
        summary.droppedIssueCount += warning.count;
        break;
      case "index_build_failed":
        summary.indexBuildFailed = true;
        break;
      case "index_rewrite_failed":
        summary.indexRewriteFailed = true;
        break;
      default: {
        const unhandledWarning: never = warning;
        return unhandledWarning;
      }
    }
  }

  return summary;
}

export interface SeverityPart {
  severity: ReviewSeverity;
  count: number;
}

export interface RunSummaryParts {
  passed: boolean;
  partial: boolean;
  failedLensCount: number;
  parts: SeverityPart[];
  issueCount: number;
}

const MIN_RUN_ID_PREFIX_LENGTH = 8;

function getRunIdPrefixLength(id: string, peerIds: readonly string[]): number {
  const normalizedId = id.toLowerCase();
  const normalizedPeers = peerIds
    .map((peerId) => peerId.toLowerCase())
    .filter((peerId) => peerId !== normalizedId);
  let length = Math.min(MIN_RUN_ID_PREFIX_LENGTH, id.length);

  while (
    length < id.length &&
    normalizedPeers.some((peerId) => peerId.startsWith(normalizedId.slice(0, length)))
  ) {
    length += 1;
  }
  return length;
}

export function formatRunId(id: string, peerIds: readonly string[] = []): string {
  return `#${id.slice(0, getRunIdPrefixLength(id, peerIds))}`;
}

export function getRunDisplayId(metadata: ReviewMetadata, peerIds: readonly string[] = []): string {
  return formatRunId(metadata.id, peerIds);
}

export function getRunBranchLabel(metadata: ReviewMetadata): string {
  return metadata.mode === "staged" ? "Staged" : (metadata.branch ?? "Main");
}

export function getRunSummaryParts(metadata: ReviewMetadata): RunSummaryParts {
  const { blockerCount, highCount, mediumCount, lowCount, nitCount, issueCount } = metadata;
  const failedLensCount = metadata.failedLensCount ?? 0;
  const partial = failedLensCount > 0;

  const parts: SeverityPart[] = [];
  if (blockerCount > 0) parts.push({ severity: "blocker", count: blockerCount });
  if (highCount > 0) parts.push({ severity: "high", count: highCount });
  if (mediumCount > 0) parts.push({ severity: "medium", count: mediumCount });
  if (lowCount > 0) parts.push({ severity: "low", count: lowCount });
  if (nitCount > 0) parts.push({ severity: "nit", count: nitCount });

  return {
    passed: issueCount === 0 && !partial,
    partial,
    failedLensCount,
    parts,
    issueCount,
  };
}

export function getRunSummaryText(metadata: ReviewMetadata): string {
  const summary = getRunSummaryParts(metadata);
  if (summary.partial) {
    const findings =
      summary.issueCount === 0
        ? "no issues found"
        : `${pluralize(summary.issueCount, "issue")} found`;
    return `Partial analysis: ${pluralize(summary.failedLensCount, "lens", "lenses")} failed; ${findings}.`;
  }
  if (summary.passed) return "Passed with no issues.";
  if (summary.parts.length === 0) {
    return `Found ${pluralize(summary.issueCount, "issue")}.`;
  }
  return summary.parts.map((p) => `${p.count} ${p.severity}`).join(", ");
}

export interface HistoryRunSummary {
  id: string;
  displayId: string;
  branch: string;
  timestamp: string;
  summary: string;
}

export function buildHistoryRunSummary(
  metadata: ReviewMetadata,
  peerIds: readonly string[] = [],
): HistoryRunSummary {
  return {
    id: metadata.id,
    displayId: getRunDisplayId(metadata, peerIds),
    branch: getRunBranchLabel(metadata),
    timestamp: getTimestamp(metadata.createdAt),
    summary: getRunSummaryText(metadata),
  };
}

export function metadataToSeverityCounts(metadata: ReviewMetadata | null): SeverityCounts | null {
  if (!metadata) return null;
  return {
    blocker: metadata.blockerCount,
    high: metadata.highCount,
    medium: metadata.mediumCount,
    low: metadata.lowCount,
    nit: metadata.nitCount,
  };
}

export function matchesHistoryQuery(
  metadata: ReviewMetadata,
  query: string,
  peerIds: readonly string[] = [],
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  if (metadata.id.toLowerCase().includes(normalized)) return true;
  if (getRunDisplayId(metadata, peerIds).toLowerCase().includes(normalized)) return true;
  const branchText =
    metadata.mode === "staged" ? "staged" : (metadata.branch?.toLowerCase() ?? "main");
  if (branchText.includes(normalized)) return true;
  if (metadata.projectPath.toLowerCase().includes(normalized)) return true;
  return false;
}

export function filterReviewsForHistory(
  reviews: ReviewMetadata[],
  selectedDateId: string,
  searchQuery: string,
): ReviewMetadata[] {
  const bySection =
    selectedDateId === HISTORY_SECTION_ALL_ID
      ? reviews
      : reviews.filter((r) => getDateKey(r.createdAt) === selectedDateId);

  const query = searchQuery.trim().toLowerCase();
  if (!query) return bySection;
  const peerIds = reviews.map((review) => review.id);
  return bySection.filter((review) => matchesHistoryQuery(review, query, peerIds));
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
      groups.set(key, { label: getDateLabel(key), count: 1 });
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

export function resolveSelectedId<T extends { id: string }>(
  selectedId: string | null,
  items: T[],
): string | null {
  if (selectedId !== null && items.some((item) => item.id === selectedId)) {
    return selectedId;
  }
  return items[0]?.id ?? null;
}

export const HISTORY_SEARCH_PLACEHOLDER = "Search runs by ID...";

export function getEmptyRunsMessage(
  hasReviews: boolean,
  hasSearchQuery: boolean,
  selectedDateId: string,
): string {
  if (!hasReviews) return "No runs yet";
  if (hasSearchQuery) return "No runs match this search";
  if (selectedDateId === HISTORY_SECTION_ALL_ID) return "No runs available";
  return "No runs for this date";
}

/** Orders review issues by descending severity, preserving original order within a tier. */
export function sortIssuesBySeverity(issues: readonly ReviewIssue[] | undefined): ReviewIssue[] {
  if (!issues || issues.length === 0) return [];
  return [...issues].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}
