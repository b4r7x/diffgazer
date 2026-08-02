import { useKey } from "@diffgazer/keys";

interface UseModelSearchFocusOptions {
  open: boolean;
  inSearch: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  blurSearchInput: () => void;
  focusSearchInput: () => void;
  focusCloseButton: () => void;
  /** Moves to the first zone below the search box that can hold focus. */
  focusZoneBelowSearch: () => void;
  /** Escape jumps past the filter row straight into the model list when it is usable. */
  escapeSearchZone: () => void;
}

interface UseModelSearchFocusResult {
  handleSearchEscape: () => void;
  handleSearchArrowDown: () => void;
}

/**
 * Search-input zone for the model dialog: entering search, leaving it toward
 * the close button or filter row, and clearing/escaping the query.
 */
export function useModelSearchFocus({
  open,
  inSearch,
  searchQuery,
  setSearchQuery,
  blurSearchInput,
  focusSearchInput,
  focusCloseButton,
  focusZoneBelowSearch,
  escapeSearchZone,
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

  const handleSearchEscape = () => {
    if (searchQuery) {
      setSearchQuery("");
      return;
    }
    blurSearchInput();
    escapeSearchZone();
  };

  return { handleSearchEscape, handleSearchArrowDown: moveDown };
}
