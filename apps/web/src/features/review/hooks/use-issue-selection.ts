import { useRef, useState } from "react";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";

interface UseIssueSelectionOptions {
  filteredIssues: ReviewIssue[];
  sourceKey?: string;
}

export function useIssueSelection({ filteredIssues, sourceKey }: UseIssueSelectionOptions) {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [trackedSourceKey, setTrackedSourceKey] = useState(sourceKey);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset selection when the source list context changes (e.g. severity
  // filter switches): the previously selected issue may still exist in the
  // new list, but the user just changed scope so we anchor on the first item.
  if (sourceKey !== trackedSourceKey) {
    setTrackedSourceKey(sourceKey);
    setSelectedIssueId(null);
  }

  // Ensure selectedIssueId is valid for current filtered list
  const effectiveSelectedId = filteredIssues.some(i => i.id === selectedIssueId)
    ? selectedIssueId
    : filteredIssues[0]?.id ?? null;

  const selectedIssue = filteredIssues.find(i => i.id === effectiveSelectedId) ?? null;

  return {
    selectedIssue,
    selectedIssueId: effectiveSelectedId,
    setSelectedIssueId,
    highlightedIssueId: effectiveSelectedId,
    listRef,
  };
}
