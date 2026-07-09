import { resolveSelectedId } from "@diffgazer/core/review";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { useRef, useState } from "react";

interface UseIssueSelectionOptions {
  filteredIssues: ReviewIssue[];
  sourceKey?: string;
  initialIssueId?: string | null;
}

export function useIssueSelection({
  filteredIssues,
  sourceKey,
  initialIssueId,
}: UseIssueSelectionOptions) {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(initialIssueId ?? null);
  const [prevSourceKey, setPrevSourceKey] = useState(sourceKey);
  const [prevRouteIssueId, setPrevRouteIssueId] = useState(initialIssueId ?? null);
  const listRef = useRef<HTMLDivElement>(null);

  if (prevSourceKey !== sourceKey) {
    setPrevSourceKey(sourceKey);
    setSelectedIssueId(null);
  }

  const routeIssueId = initialIssueId ?? null;
  if (prevRouteIssueId !== routeIssueId) {
    setPrevRouteIssueId(routeIssueId);
    if (routeIssueId !== null) setSelectedIssueId(routeIssueId);
  }

  const effectiveSelectedId = resolveSelectedId(selectedIssueId, filteredIssues);

  const selectedIssue = filteredIssues.find((i) => i.id === effectiveSelectedId) ?? null;

  return {
    selectedIssue,
    selectedIssueId: effectiveSelectedId,
    setSelectedIssueId,
    highlightedIssueId: effectiveSelectedId,
    listRef,
  };
}
