import { useState } from "react";
import type { SeverityFilter } from "@/features/review/components/severity-filter-group";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { SEVERITY_ORDER } from "@diffgazer/core/schemas/ui";
import { filterIssuesBySeverity } from "@diffgazer/core/review";

interface UseSeverityFilterOptions {
  issues: ReviewIssue[];
}

export function useSeverityFilter({ issues }: UseSeverityFilterOptions) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [focusedFilterIndex, setFocusedFilterIndex] = useState(0);

  const filteredIssues = filterIssuesBySeverity(issues, severityFilter);

  const toggleSeverityFilter = () => {
    const sev = SEVERITY_ORDER[focusedFilterIndex];
    setSeverityFilter((f) => (f === sev ? "all" : sev));
  };

  const moveFocusedFilter = (delta: -1 | 1) => {
    if (delta === -1 && focusedFilterIndex > 0) {
      setFocusedFilterIndex((i) => i - 1);
    }
    if (delta === 1 && focusedFilterIndex < SEVERITY_ORDER.length - 1) {
      setFocusedFilterIndex((i) => i + 1);
    }
  };

  return {
    severityFilter,
    setSeverityFilter,
    filteredIssues,
    focusedFilterIndex,
    toggleSeverityFilter,
    moveFocusedFilter,
  };
}
