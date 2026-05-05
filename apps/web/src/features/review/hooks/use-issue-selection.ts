import { useRef, useState } from "react";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";

interface UseIssueSelectionOptions {
  filteredIssues: ReviewIssue[];
}

export function useIssueSelection({ filteredIssues }: UseIssueSelectionOptions) {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Ensure selectedIssueId is valid for current filtered list
  const effectiveSelectedId = filteredIssues.some(i => i.id === selectedIssueId)
    ? selectedIssueId
    : filteredIssues[0]?.id ?? null;

  const selectedIssue = filteredIssues.find(i => i.id === effectiveSelectedId) ?? null;

  const moveIssue = (delta: -1 | 1) => {
    const idx = filteredIssues.findIndex(i => i.id === effectiveSelectedId);
    const nextIdx = idx + delta;
    if (nextIdx < 0) return "boundary-top" as const;
    if (nextIdx >= filteredIssues.length) return "boundary-bottom" as const;
    setSelectedIssueId(filteredIssues[nextIdx]!.id);
    return "moved" as const;
  };

  return {
    selectedIssue,
    selectedIssueId: effectiveSelectedId,
    setSelectedIssueId,
    focusedValue: effectiveSelectedId,
    listRef,
    moveIssue,
  };
}
