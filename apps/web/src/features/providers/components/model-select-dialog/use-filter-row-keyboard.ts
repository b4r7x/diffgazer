import { useKey } from "@diffgazer/keys";
import type { KeyboardEvent as ReactKeyboardEvent, RefCallback } from "react";

interface UseModelFiltersOptions {
  open: boolean;
  inFilters: boolean;
  inSearch: boolean;
  hasFilteredModels: boolean;
  cycleTierFilter: () => void;
  registerFilterButton: (index: number, node: HTMLButtonElement | null) => void;
  focusFilterAtIndex: (index: number) => void;
  focusSearchInput: () => void;
  enterListFromBoundary: (target: "first" | "last") => void;
  enterFooter: (index: number) => void;
}

interface UseModelFiltersResult {
  getFilterButtonProps: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
  handleFilterKeyDown: (event: ReactKeyboardEvent) => void;
}

/**
 * Tier-filter row for the model dialog: cycling the active filter and moving
 * between the search box, filter buttons, and model list.
 */
export function useModelFilters({
  open,
  inFilters,
  inSearch,
  hasFilteredModels,
  cycleTierFilter,
  registerFilterButton,
  focusFilterAtIndex,
  focusSearchInput,
  enterListFromBoundary,
  enterFooter,
}: UseModelFiltersOptions): UseModelFiltersResult {
  useKey("ArrowUp", focusSearchInput, { enabled: open && inFilters, preventDefault: true });
  useKey(
    "ArrowDown",
    () => {
      if (!hasFilteredModels) {
        enterFooter(0);
        return;
      }
      enterListFromBoundary("first");
    },
    { enabled: open && inFilters, preventDefault: true },
  );

  useKey("f", cycleTierFilter, { enabled: open && !inSearch });

  const getFilterButtonProps = (index: number) => ({
    ref: (node: HTMLButtonElement | null) => registerFilterButton(index, node),
    onFocus: () => focusFilterAtIndex(index),
  });

  const handleFilterKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusSearchInput();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!hasFilteredModels) {
        enterFooter(0);
        return;
      }
      enterListFromBoundary("first");
    }
  };

  return { getFilterButtonProps, handleFilterKeyDown };
}
