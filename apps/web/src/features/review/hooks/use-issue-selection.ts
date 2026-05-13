import { useEffect, useRef, useState } from "react";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";

interface UseIssueSelectionOptions {
  filteredIssues: ReviewIssue[];
  sourceKey?: string;
}

export function useIssueSelection({ filteredIssues, sourceKey }: UseIssueSelectionOptions) {
  const [selection, setSelection] = useState<{ sourceKey: string | undefined; issueId: string | null }>({
    sourceKey,
    issueId: null,
  });
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelection((current) =>
      current.sourceKey === sourceKey ? current : { sourceKey, issueId: null },
    );
  }, [sourceKey]);

  const selectedIssueId = selection.sourceKey === sourceKey ? selection.issueId : null;

  const setSelectedIssueId = (issueId: string | null) => {
    setSelection({ sourceKey, issueId });
  };

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
