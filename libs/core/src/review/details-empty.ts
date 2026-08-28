export type DetailsEmptyKind = "filter-empty" | "no-selection";

/**
 * Why the details pane has nothing to show. The results screen is unreachable
 * for a zero-issue run — that run lands on the clean-run state instead — so the
 * only emptiness left here is a filter that matched nothing, or nothing picked.
 */
export function selectDetailsEmptyKind(filteredCount: number): DetailsEmptyKind {
  return filteredCount === 0 ? "filter-empty" : "no-selection";
}
