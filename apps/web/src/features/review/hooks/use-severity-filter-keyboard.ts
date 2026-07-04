import { useKey } from "@diffgazer/keys";

interface UseReviewSeverityFilterKeyboardOptions {
  scope: string;
  enabled: boolean;
  isFilterActive: boolean;
  focusedFilterIndex: number;
  lastFilterIndex: number;
  resetIndex: number;
  setFocusedFilterIndex: (index: number) => void;
  focusChip: (index: number) => HTMLElement | null;
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
  focusChip,
  toggleSeverityFilter,
  resetSeverityFilter,
  enterList,
  enterDetails,
}: UseReviewSeverityFilterKeyboardOptions) {
  const atReset = focusedFilterIndex === resetIndex;

  const focusFilterIndex = (index: number) => {
    setFocusedFilterIndex(index);
    focusChip(index)?.focus();
  };

  const resetAndReturnToLastFilter = () => {
    resetSeverityFilter();
    focusFilterIndex(lastFilterIndex);
  };

  const handleEnterOrSpace = () => {
    if (atReset) {
      resetAndReturnToLastFilter();
      return;
    }
    toggleSeverityFilter();
  };

  useKey("ArrowLeft", () => focusFilterIndex(lastFilterIndex), {
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
