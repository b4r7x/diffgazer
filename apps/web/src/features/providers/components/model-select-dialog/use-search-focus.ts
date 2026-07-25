import { useKey } from "@diffgazer/keys";

interface UseModelSearchFocusOptions {
  open: boolean;
  inSearch: boolean;
  searchQuery: string;
  filterIndex: number;
  setSearchQuery: (query: string) => void;
  blurSearchInput: () => void;
  focusSearchInput: () => void;
  focusCloseButton: () => void;
  focusFilterButton: (index: number) => void;
  enterListFromBoundary: (target: "first" | "last") => void;
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
  filterIndex,
  setSearchQuery,
  blurSearchInput,
  focusSearchInput,
  focusCloseButton,
  focusFilterButton,
  enterListFromBoundary,
}: UseModelSearchFocusOptions): UseModelSearchFocusResult {
  // Leaving the search box for the filter row, shared by the document-level
  // useKey fallback and the input's onArrowDown so the two dispatch paths cannot
  // drift.
  const moveToFilterRow = () => {
    blurSearchInput();
    focusFilterButton(filterIndex);
  };

  useKey("ArrowDown", moveToFilterRow, {
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
    } else {
      blurSearchInput();
      enterListFromBoundary("first");
    }
  };

  return { handleSearchEscape, handleSearchArrowDown: moveToFilterRow };
}
