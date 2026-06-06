import { PROVIDER_FILTERS, type ProviderFilter } from "@diffgazer/core/providers";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { useKey } from "@diffgazer/keys";
import { type KeyboardEvent as ReactKeyboardEvent, type RefCallback, type RefObject, useRef, useState } from "react";

type FocusZone = "input" | "filters" | "list" | "buttons";

interface UseProvidersListNavigationOptions {
  selectedProvider: { id: AIProvider } | null;
  filteredProviders: Array<{ id: string }>;
  filter: ProviderFilter;
  dialogOpen: boolean;
  inInput: boolean;
  inFilters: boolean;
  inList: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  setZone: (zone: FocusZone) => void;
  setSelectedId: (id: string | null) => void;
  focusProviderList: () => void;
  enterButtons: (index?: number) => void;
}

interface UseProvidersListNavigationResult {
  filterIndex: number;
  setFilterIndex: (index: number | ((prev: number) => number)) => void;
  getFilterButtonProps: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
  handleFilterKeyDown: (event: ReactKeyboardEvent) => void;
  handleListKeyDown: (event: ReactKeyboardEvent) => void;
  handleSearchFocus: () => void;
  handleFilterFocus: (index: number) => void;
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
  selectedProvider,
  filteredProviders,
  filter,
  dialogOpen,
  inInput,
  inFilters,
  inList,
  inputRef,
  setZone,
  setSelectedId,
  focusProviderList,
  enterButtons,
}: UseProvidersListNavigationOptions): UseProvidersListNavigationResult {
  const [filterIndex, setFilterIndex] = useState(0);
  const filterButtonRefs = useRef(new Map<number, HTMLButtonElement>());

  const focusFirstProvider = () => {
    const firstProviderId = filteredProviders[0]?.id;
    if (firstProviderId) setSelectedId(firstProviderId);
  };

  // Filter button ref management and focus logic is structurally similar to
  // model-select-dialog/use-dialog-keyboard but differs in index clamping (clamp here vs
  // modulo wrap there) and downstream zone transitions, so it stays local.
  const focusFilterButton = (index: number) => {
    const nextIndex = Math.max(0, Math.min(PROVIDER_FILTERS.length - 1, index));
    setZone("filters");
    setFilterIndex(nextIndex);
    filterButtonRefs.current.get(nextIndex)?.focus();
  };

  const getFilterButtonProps = (index: number) => ({
    ref: (node: HTMLButtonElement | null) => {
      if (node) filterButtonRefs.current.set(index, node);
      else filterButtonRefs.current.delete(index);
    },
    onFocus: () => {
      setZone("filters");
      setFilterIndex(index);
    },
  });

  const handleSearchFocus = () => {
    setZone("input");
  };

  const handleFilterFocus = (index: number) => {
    setZone("filters");
    setFilterIndex(index);
  };

  const handleListFocus = () => {
    setZone("list");
  };

  const handleSearchEscape = () => {
    focusFilterButton(PROVIDER_FILTERS.indexOf(filter));
    inputRef.current?.blur();
  };

  useKey("ArrowDown", () => {
    focusFilterButton(PROVIDER_FILTERS.indexOf(filter));
    inputRef.current?.blur();
  }, { enabled: !dialogOpen && inInput, allowInInput: true, preventDefault: true });
  useKey("Escape", handleSearchEscape, { enabled: !dialogOpen && inInput, allowInInput: true });

  useKey("ArrowUp", () => {
    setZone("input");
    inputRef.current?.focus();
  }, { enabled: !dialogOpen && inFilters, preventDefault: true });
  useKey("ArrowDown", () => {
    if (filteredProviders.length > 0) {
      setZone("list");
      focusFirstProvider();
      focusProviderList();
    }
  }, { enabled: !dialogOpen && inFilters, preventDefault: true });

  useKey("ArrowRight", () => {
    enterButtons(0);
  }, { enabled: !dialogOpen && inList && selectedProvider !== null });

  useKey("/", () => {
    setZone("input");
    inputRef.current?.focus();
  }, { enabled: !dialogOpen && !inInput, preventDefault: true });

  const handleListBoundary = (direction: "up" | "down") => {
    if (direction === "up") {
      focusFilterButton(PROVIDER_FILTERS.indexOf(filter));
    }
  };

  const handleFilterKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setZone("input");
      inputRef.current?.focus();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (filteredProviders.length === 0) return;
      setZone("list");
      focusFirstProvider();
      focusProviderList();
    }
  };

  const handleListKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== " ") return;
    event.preventDefault();
    enterButtons(0);
  };

  return {
    filterIndex,
    setFilterIndex,
    getFilterButtonProps,
    handleFilterKeyDown,
    handleListKeyDown,
    handleSearchFocus,
    handleFilterFocus,
    handleListFocus,
    handleSearchEscape,
    handleListBoundary,
  };
}
