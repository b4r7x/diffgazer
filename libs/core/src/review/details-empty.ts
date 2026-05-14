export type DetailsEmptyKind = "no-issues" | "filter-empty" | "no-selection";

export function selectDetailsEmptyKind(
  totalCount: number,
  filteredCount: number,
): DetailsEmptyKind {
  if (totalCount === 0) return "no-issues";
  if (filteredCount === 0) return "filter-empty";
  return "no-selection";
}
