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

  const resetAndReturnToFirstFilter = () => {
    resetSeverityFilter();
    focusFilterIndex(0);
  };

  const handleEnterOrSpace = () => {
    if (atReset) {
      resetAndReturnToFirstFilter();
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

  // preventDefault: activating Reset moves DOM focus to a severity chip, and
  // the browser's native button activation (Space fires click on keyup) would
  // otherwise land on that freshly focused chip and toggle it into the filter.
  useKey("Enter", handleEnterOrSpace, { scope, enabled, preventDefault: true });
  useKey(" ", handleEnterOrSpace, { scope, enabled, preventDefault: true });

  useKey("r", resetAndReturnToFirstFilter, { scope, enabled: enabled && isFilterActive });
}
