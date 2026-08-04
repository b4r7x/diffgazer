import { getProviderRowId, type ProviderListRow } from "@diffgazer/core/providers";
import { useKey } from "@diffgazer/keys";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefCallback,
  type RefObject,
  useRef,
  useState,
} from "react";
import { PROVIDER_FILTERS, type ProviderFilter } from "../lib/filter";

type FocusZone = "input" | "filters" | "list" | "buttons";

interface UseProvidersListNavigationOptions {
  selectedRow: ProviderListRow | null;
  filteredProviders: ProviderListRow[];
  filter: ProviderFilter;
  dialogOpen: boolean;
  zone: FocusZone;
  inputRef: RefObject<HTMLInputElement | null>;
  setZone: (zone: FocusZone) => void;
  setSelectedId: (id: string | null) => void;
  focusProviderList: () => void;
  enterButtons: (index?: number) => void;
}

interface UseProvidersListNavigationResult {
  filterIndex: number;
  getFilterButtonProps: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
  };
  handleFilterIndexChange: (index: number) => void;
  handleFilterKeyDown: (event: ReactKeyboardEvent) => void;
  handleListKeyDown: (event: ReactKeyboardEvent) => void;
  handleSearchFocus: () => void;
  handleListFocus: () => void;
  handleSearchEscape: () => void;
  handleListBoundary: (direction: "up" | "down") => void;
}

/**
 * Search and list-zone navigation for the provider screen: entering search,
 * moving between the search box, filter row, and provider list, and handing
 * off to the action buttons.
 */
export function useProvidersListNavigation({
  selectedRow,
  filteredProviders,
  filter,
  dialogOpen,
  zone,
  inputRef,
  setZone,
  setSelectedId,
  focusProviderList,
  enterButtons,
}: UseProvidersListNavigationOptions): UseProvidersListNavigationResult {
  const [filterIndex, setFilterIndex] = useState(0);
  const filterButtonRefs = useRef(new Map<number, HTMLButtonElement>());

  const focusFirstProvider = () => {
    const firstProviderId = filteredProviders[0]
      ? getProviderRowId(filteredProviders[0])
      : undefined;
    if (firstProviderId) setSelectedId(firstProviderId);
  };

  // The single channel for "the filter row now owns index N": the list mirrors
  // browser focus into it, and every internal transition below routes through
  // it, so the zone and the recorded index cannot drift apart.
  const handleFilterIndexChange = (index: number) => {
    setZone("filters");
    setFilterIndex(index);
  };

  // Filter button ref management and focus logic is structurally similar to
  // model-select-dialog/use-dialog-keyboard but differs in index clamping (clamp here vs
  // modulo wrap there) and downstream zone transitions, so it stays local.
  const focusFilterButton = (index: number) => {
    const nextIndex = Math.max(0, Math.min(PROVIDER_FILTERS.length - 1, index));
    handleFilterIndexChange(nextIndex);
    filterButtonRefs.current.get(nextIndex)?.focus();
  };

  const getFilterButtonProps = (index: number) => ({
    ref: (node: HTMLButtonElement | null) => {
      if (node) filterButtonRefs.current.set(index, node);
      else filterButtonRefs.current.delete(index);
    },
  });

  const handleSearchFocus = () => {
    setZone("input");
  };

  const handleListFocus = () => {
    setZone("list");
  };

  // The filter-row up/down transitions, shared by the document-level useKey
  // registrations and the ToggleGroup's handleFilterKeyDown so the two paths
  // cannot drift.
  const moveToSearch = () => {
    setZone("input");
    inputRef.current?.focus();
  };

  const moveToList = () => {
    if (filteredProviders.length === 0) return;
    setZone("list");
    focusFirstProvider();
    focusProviderList();
  };

  const handleSearchEscape = () => {
    focusFilterButton(PROVIDER_FILTERS.indexOf(filter));
    inputRef.current?.blur();
  };

  useKey(
    "ArrowDown",
    () => {
      focusFilterButton(PROVIDER_FILTERS.indexOf(filter));
      inputRef.current?.blur();
    },
    { enabled: !dialogOpen && zone === "input", allowInInput: true, preventDefault: true },
  );
  useKey("Escape", handleSearchEscape, {
    enabled: !dialogOpen && zone === "input",
    allowInInput: true,
  });

  useKey("ArrowUp", moveToSearch, {
    enabled: !dialogOpen && zone === "filters",
    preventDefault: true,
  });
  useKey("ArrowDown", moveToList, {
    enabled: !dialogOpen && zone === "filters",
    preventDefault: true,
  });

  useKey(
    "ArrowRight",
    () => {
      enterButtons(0);
    },
    { enabled: !dialogOpen && zone === "list" && selectedRow !== null },
  );

  useKey(
    "/",
    () => {
      setZone("input");
      inputRef.current?.focus();
    },
    { enabled: !dialogOpen && zone !== "input", preventDefault: true },
  );

  const handleListBoundary = (direction: "up" | "down") => {
    if (direction === "up") {
      focusFilterButton(PROVIDER_FILTERS.indexOf(filter));
    }
  };

  const handleFilterKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveToSearch();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveToList();
    }
  };

  const handleListKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== " ") return;
    event.preventDefault();
    enterButtons(0);
  };

  return {
    filterIndex,
    getFilterButtonProps,
    handleFilterIndexChange,
    handleFilterKeyDown,
    handleListKeyDown,
    handleSearchFocus,
    handleListFocus,
    handleSearchEscape,
    handleListBoundary,
  };
}
