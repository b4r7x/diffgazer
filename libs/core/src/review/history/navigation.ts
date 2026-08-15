import { buildRunIdLookup, getDateKey, getDateLabel, type RunIdLookup } from "../../format.js";
import type { TimelineItem } from "../../schemas/presentation/index.js";
import type { ReviewMetadata } from "../../schemas/review/index.js";
import { getRunBranchLabel, resolveRunDisplayId } from "./run-presentation.js";

export const HISTORY_SECTION_ALL_ID = "all";
const HISTORY_SECTION_ALL_LABEL = "All";

function timelineDateLabel(dateKey: string, now: Date): string {
  const currentYear = now.getFullYear().toString();
  const year = /^(\d{4})-/.exec(dateKey)?.[1];
  return getDateLabel(
    dateKey,
    year !== undefined && year !== currentYear ? { showYear: true } : undefined,
  );
}

export type HistoryDetailState =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "ready" };

export function deriveHistoryDetailState({
  isLoading,
  error,
  refetch,
}: {
  isLoading: boolean;
  error: Error | null;
  refetch: () => unknown;
}): HistoryDetailState {
  if (isLoading) return { status: "loading" };
  if (error) {
    return {
      status: "error",
      message: error.message,
      retry: () => {
        void refetch();
      },
    };
  }
  return { status: "ready" };
}

export function matchesHistoryQuery(
  metadata: ReviewMetadata,
  query: string,
  runIdLookup?: RunIdLookup,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  if (metadata.id.toLowerCase().includes(normalized)) return true;
  if (resolveRunDisplayId(metadata, runIdLookup).toLowerCase().includes(normalized)) return true;
  if (getRunBranchLabel(metadata).toLowerCase().includes(normalized)) return true;
  if (metadata.projectPath.toLowerCase().includes(normalized)) return true;
  return false;
}

export function filterReviewsForHistory(
  reviews: ReviewMetadata[],
  selectedDateId: string,
  searchQuery: string,
  runIdLookup?: RunIdLookup,
): ReviewMetadata[] {
  const bySection =
    selectedDateId === HISTORY_SECTION_ALL_ID
      ? reviews
      : reviews.filter((r) => getDateKey(r.createdAt) === selectedDateId);

  const query = searchQuery.trim().toLowerCase();
  if (!query) return bySection;
  const lookup = runIdLookup ?? buildRunIdLookup(reviews.map((review) => review.id));
  return bySection.filter((review) => matchesHistoryQuery(review, query, lookup));
}

export function buildTimelineItems(reviews: ReviewMetadata[]): TimelineItem[] {
  const allItem: TimelineItem = {
    id: HISTORY_SECTION_ALL_ID,
    label: HISTORY_SECTION_ALL_LABEL,
    count: reviews.length,
  };

  if (reviews.length === 0) return [allItem];

  const groups = new Map<string, { label: string; count: number }>();
  const now = new Date();

  for (const review of reviews) {
    const key = getDateKey(review.createdAt);
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
    } else {
      groups.set(key, { label: timelineDateLabel(key, now), count: 1 });
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

export const HISTORY_SEARCH_PLACEHOLDER = "Search ID, branch, path, staged...";

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
