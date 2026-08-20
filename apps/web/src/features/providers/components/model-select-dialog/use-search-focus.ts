import { useKey } from "@diffgazer/keys";

interface UseModelSearchFocusOptions {
  open: boolean;
  inSearch: boolean;
  blurSearchInput: () => void;
  focusSearchInput: () => void;
  focusCloseButton: () => void;
  /** Moves to the first zone below the search box that can hold focus. */
  focusZoneBelowSearch: () => void;
}

interface UseModelSearchFocusResult {
  handleSearchArrowDown: () => void;
}

/**
 * Search-input zone for the model dialog: entering search and leaving it
 * toward the close button or filter row.
 */
export function useModelSearchFocus({
  open,
  inSearch,
  blurSearchInput,
  focusSearchInput,
  focusCloseButton,
  focusZoneBelowSearch,
}: UseModelSearchFocusOptions): UseModelSearchFocusResult {
  // Leaving the search box downward, shared by the document-level useKey
  // fallback and the input's onArrowDown so the two dispatch paths cannot drift.
  const moveDown = () => {
    blurSearchInput();
    focusZoneBelowSearch();
  };

  useKey("ArrowDown", moveDown, {
    enabled: open && inSearch,
    allowInInput: true,
    preventDefault: true,
  });
  useKey("ArrowUp", focusCloseButton, {
    enabled: open && inSearch,
    allowInInput: true,
    preventDefault: true,
  });

  useKey(
    "/",
    () => {
      if (!inSearch) focusSearchInput();
    },
    { enabled: open, preventDefault: true },
  );

  return { handleSearchArrowDown: moveDown };
}
