import { useKey } from "@diffgazer/keys";

interface UseReviewSeverityFilterKeyboardOptions {
  scope: string;
  enabled: boolean;
  isFilterActive: boolean;
  focusedFilterIndex: number;
  lastFilterIndex: number;
  resetIndex: number;
  setFocusedFilterIndex: (index: number) => void;
  toggleSeverityFilter: () => void;
  resetSeverityFilter: () => void;
  enterList: () => void;
  enterDetails: () => void;
}

/**
 * Filter-zone key bindings for the review results screen: toggling severities,
 * resetting the filter, and moving focus out of the filter row.
 */
export function useReviewSeverityFilterKeyboard({
  scope,
  enabled,
  isFilterActive,
  focusedFilterIndex,
  lastFilterIndex,
  resetIndex,
  setFocusedFilterIndex,
  toggleSeverityFilter,
  resetSeverityFilter,
  enterList,
  enterDetails,
}: UseReviewSeverityFilterKeyboardOptions) {
  const atReset = focusedFilterIndex === resetIndex;

  const resetAndReturnToLastFilter = () => {
    resetSeverityFilter();
    setFocusedFilterIndex(lastFilterIndex);
  };

  const handleEnterOrSpace = () => {
    if (atReset) {
      resetAndReturnToLastFilter();
      return;
    }
    toggleSeverityFilter();
  };

  useKey("ArrowLeft", () => setFocusedFilterIndex(lastFilterIndex), {
    scope,
    enabled: enabled && atReset,
  });
  useKey("ArrowRight", () => enterDetails(), {
    scope,
    enabled: enabled && atReset,
  });

  useKey("j", () => enterList(), { scope, enabled });

  useKey("Enter", handleEnterOrSpace, { scope, enabled });
  useKey(" ", handleEnterOrSpace, { scope, enabled });

  useKey("r", resetAndReturnToLastFilter, { scope, enabled: enabled && isFilterActive });
}
