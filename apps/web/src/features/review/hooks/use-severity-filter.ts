import { filterIssuesBySeverity } from "@diffgazer/core/review";
import { SEVERITY_ORDER } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue, ReviewSeverity } from "@diffgazer/core/schemas/review";
import { useState } from "react";

interface UseSeverityFilterOptions {
  issues: ReviewIssue[];
}

const EMPTY_FILTER: ReadonlySet<ReviewSeverity> = new Set();

export function useSeverityFilter({ issues }: UseSeverityFilterOptions) {
  const [severityFilter, setSeverityFilter] = useState<ReadonlySet<ReviewSeverity>>(EMPTY_FILTER);
  const [focusedFilterIndex, setFocusedFilterIndex] = useState(0);

  const filteredIssues = filterIssuesBySeverity(issues, severityFilter);
  const selectedCount = severityFilter.size;
  const isFilterActive = selectedCount > 0;

  const toggleSeverityFilter = () => {
    const sev = SEVERITY_ORDER[focusedFilterIndex];
    if (!sev) return;
    setSeverityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  };

  const resetSeverityFilter = () => {
    setSeverityFilter(EMPTY_FILTER);
  };

  return {
    severityFilter,
    setSeverityFilter,
    filteredIssues,
    focusedFilterIndex,
    setFocusedFilterIndex,
    toggleSeverityFilter,
    resetSeverityFilter,
    selectedCount,
    isFilterActive,
  };
}
