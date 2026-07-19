import { filterIssuesBySeverity, toggleSeverity } from "@diffgazer/core/review";
import { SEVERITY_ORDER, type UISeverityFilter } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { useState } from "react";

interface UseSeverityFilterOptions {
  issues: ReviewIssue[];
}

const EMPTY_FILTER: UISeverityFilter = new Set();

export function useSeverityFilter({ issues }: UseSeverityFilterOptions) {
  const [severityFilter, setSeverityFilter] = useState<UISeverityFilter>(EMPTY_FILTER);
  const [focusedFilterIndex, setFocusedFilterIndex] = useState(0);

  const filteredIssues = filterIssuesBySeverity(issues, severityFilter);
  const selectedCount = severityFilter.size;
  const isFilterActive = selectedCount > 0;

  const toggleSeverityFilter = () => {
    const sev = SEVERITY_ORDER[focusedFilterIndex];
    if (!sev) return;
    setSeverityFilter((prev) => toggleSeverity(prev, sev));
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
