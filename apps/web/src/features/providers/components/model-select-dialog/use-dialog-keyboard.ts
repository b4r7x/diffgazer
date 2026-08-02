import { TIER_FILTERS } from "@diffgazer/core/providers";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import {
  containsActiveElement,
  findNavigationItemByValue,
  useActionRowNavigation,
  useScopedNavigation,
} from "@diffgazer/keys";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefCallback,
  type RefObject,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { useModelDialogZones } from "./use-dialog-zones";
import { useModelFilters } from "./use-filter-row-keyboard";
import { useModelSearchFocus } from "./use-search-focus";

type FocusZone = "close" | "search" | "filters" | "list" | "footer";
type DiscoveryStatus = "idle" | "loading" | "passed" | "skipped" | "error";

interface ModelDialogKeyboardOptions {
  open: boolean;
  isSaving?: boolean;
  currentModel: string | undefined;
  models: ModelInfo[];
  filteredModels: ModelInfo[];
  discoveryStatus: DiscoveryStatus;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  cycleTierFilter: () => void;
  resetFilters: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  listContainerRef: RefObject<HTMLDivElement | null>;
  onSelect: (modelId: string) => void;
  onOpenChange: (open: boolean) => void;
}

interface ModelDialogKeyboardReturn {
  focusZone: FocusZone;
  focusedModelId: string | null;
  checkedModelId: string | undefined;
  filterIndex: number;
  setFilterIndex: (index: number | ((prev: number) => number)) => void;
  footerButtonIndex: number;
  getFooterButtonProps: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
  getFilterButtonProps: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
  getCloseButtonProps: () => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
  setFocusZone: (zone: FocusZone) => void;
  handleFilterKeyDown: (event: ReactKeyboardEvent) => void;
  handleConfirm: (modelId?: string) => void;
  handleSearchEscape: () => void;
  handleSearchArrowDown: () => void;
  handleListHighlightChange: (modelId: string | null) => void;
  handleListBoundaryReached: (direction: "previous" | "next") => void;
  handleListSelect: (modelId: string) => void;
}

function getModelFocusTargetId({
  filteredModels,
  focusedModelId,
  currentModel,
}: {
  filteredModels: ModelInfo[];
  focusedModelId: string | null;
  currentModel: string | undefined;
}): string | undefined {
  return [focusedModelId, currentModel, filteredModels[0]?.id].find(
    (id): id is string => id != null && filteredModels.some((model) => model.id === id),
  );
}

export function useModelDialogKeyboard({
  open,
  isSaving = false,
  currentModel,
  models,
  filteredModels,
  discoveryStatus,
  searchQuery,
  setSearchQuery,
  cycleTierFilter,
  resetFilters,
  searchInputRef,
  listContainerRef,
  onSelect,
  onOpenChange,
}: ModelDialogKeyboardOptions): ModelDialogKeyboardReturn {
  const [checkedModelId, setCheckedModelId] = useState<string | undefined>(currentModel);
  const [filterIndex, setFilterIndex] = useState(0);
  const hasHandledInitialFocusRef = useRef(false);
  const hadFilteredModelsRef = useRef(false);
  const filterButtonRefs = useRef(new Map<number, HTMLButtonElement>());
  const listInteractive = !isSaving && discoveryStatus === "passed" && filteredModels.length > 0;
  const canConfirm = listInteractive;
  // The filter row is disabled unless discovery passed and the search box is
  // disabled while discovery is still running; navigation must skip whichever
  // zone cannot take focus, or the browser drops focus to document.body.
  const filtersInteractive = !isSaving && discoveryStatus === "passed";
  const searchInteractive =
    !isSaving && discoveryStatus !== "idle" && discoveryStatus !== "loading";

  const {
    focusZone,
    setFocusZone,
    isZone,
    focusCloseButton,
    focusSearchInput,
    getCloseButtonProps,
  } = useModelDialogZones({ open, searchInteractive, searchInputRef, hasHandledInitialFocusRef });

  const blurSearchInput = () => searchInputRef.current?.blur();

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleConfirm = (explicitModelId?: string) => {
    if (isSaving) return;
    const nextModelId =
      [explicitModelId, checkedModelId, focusedModelId].find(
        (id) => id != null && filteredModels.some((model) => model.id === id),
      ) ?? filteredModels[0]?.id;
    if (!nextModelId) return;
    onSelect(nextModelId);
  };

  const footerActionRow = useActionRowNavigation({
    enabled: open && isZone("footer") && !isSaving,
    actionCount: 2,
    disabledActions: [isSaving, !canConfirm],
    onAction: (index) => {
      if (index === 0) handleCancel();
      else if (index === 1 && canConfirm) handleConfirm();
    },
    onNavigationBoundaryReached: (direction) => {
      if (direction !== "previous") return;
      if (filteredModels.length === 0) {
        focusZoneAboveList();
        return;
      }
      setFocusZone("list");
      focusBoundaryModel("last");
    },
    wrap: false,
    defaultZone: "actions",
    defaultIndex: 1,
  });

  const getFooterButtonProps = (index: number) => {
    const actionProps = footerActionRow.getActionProps(index);
    return {
      ref: actionProps.ref,
      onFocus: () => {
        setFocusZone("footer");
        actionProps.onFocus();
      },
    };
  };

  const enterFooter = (index: number) => {
    setFocusZone("footer");
    footerActionRow.enterActions(index);
  };

  // Filter button ref management and focus logic is structurally similar to
  // use-providers-keyboard but differs in index wrapping (modulo here vs clamp
  // there) and downstream zone transitions, so it stays local rather than
  // being extracted into a shared helper.
  const focusFilterButton = (index: number) => {
    const nextIndex = ((index % TIER_FILTERS.length) + TIER_FILTERS.length) % TIER_FILTERS.length;
    setFocusZone("filters");
    setFilterIndex(nextIndex);
    filterButtonRefs.current.get(nextIndex)?.focus();
  };

  // Moves the zone to filters and records the active filter index without
  // re-focusing the button -- used by getFilterButtonProps.onFocus to mirror
  // browser-driven focus into zone state.
  const focusFilterAtIndex = (index: number) => {
    setFocusZone("filters");
    setFilterIndex(index);
  };

  const registerFilterButton = (index: number, node: HTMLButtonElement | null) => {
    if (node) filterButtonRefs.current.set(index, node);
    else filterButtonRefs.current.delete(index);
  };

  // The first enabled zone above the model list, so leaving the list or the
  // footer upward always lands on an element that can hold focus.
  const focusZoneAboveList = () => {
    if (filtersInteractive) {
      focusFilterButton(filterIndex);
      return;
    }
    if (searchInteractive) {
      focusSearchInput();
      return;
    }
    focusCloseButton();
  };

  const handleListBoundaryReached = (direction: "previous" | "next") => {
    if (direction === "previous") {
      focusFilterButton(0);
      return;
    }
    enterFooter(1);
  };

  const { highlighted: focusedModelId, highlight: focusModel } = useScopedNavigation({
    containerRef: listContainerRef,
    role: "radio",
    enabled: open && listInteractive && isZone("list"),
    wrap: false,
    moveFocus: true,
    upKeys: ["k"],
    downKeys: ["j"],
    onNavigationBoundaryReached: handleListBoundaryReached,
  });

  const getModelElement = (modelId: string) => {
    return findNavigationItemByValue(listContainerRef.current, {
      type: "radio",
      value: modelId,
    });
  };

  const focusModelElement = (modelId: string) => {
    focusModel(modelId);
    const modelElement = getModelElement(modelId);
    if (!modelElement) return false;

    modelElement.focus();
    return containsActiveElement(modelElement);
  };

  const focusBoundaryModel = (target: "first" | "last") => {
    const targetId =
      target === "last" ? filteredModels[filteredModels.length - 1]?.id : filteredModels[0]?.id;
    if (targetId) focusModelElement(targetId);
  };

  const enterListFromBoundary = (target: "first" | "last") => {
    setFocusZone("list");
    focusBoundaryModel(target);
  };

  const filters = useModelFilters({
    open,
    inFilters: isZone("filters"),
    inSearch: isZone("search"),
    hasFilteredModels: listInteractive,
    discoveryStatus,
    cycleTierFilter,
    registerFilterButton,
    focusFilterAtIndex,
    focusSearchInput,
    enterListFromBoundary,
    enterFooter,
  });

  const focusZoneBelowSearch = () => {
    if (filtersInteractive) {
      focusFilterButton(filterIndex);
      return;
    }
    if (listInteractive) {
      enterListFromBoundary("first");
      return;
    }
    enterFooter(0);
  };

  const search = useModelSearchFocus({
    open,
    inSearch: isZone("search"),
    searchQuery,
    setSearchQuery,
    blurSearchInput,
    focusSearchInput,
    focusCloseButton,
    focusZoneBelowSearch,
    escapeSearchZone: () => {
      if (listInteractive) {
        enterListFromBoundary("first");
        return;
      }
      focusZoneBelowSearch();
    },
  });

  const resetDialogState = useEffectEvent(() => {
    hasHandledInitialFocusRef.current = false;
    hadFilteredModelsRef.current = false;
    resetFilters();
    setFocusZone("list");
    setFilterIndex(0);
    setCheckedModelId(currentModel);
    const targetId = currentModel ?? models[0]?.id;
    if (targetId) focusModelElement(targetId);
    hasHandledInitialFocusRef.current = true;
  });

  const repairListFocus = useEffectEvent(() => {
    const targetId = getModelFocusTargetId({
      filteredModels,
      focusedModelId,
      currentModel,
    });
    const listHasFocus = listContainerRef.current
      ? containsActiveElement(listContainerRef.current)
      : false;
    if (targetId === focusedModelId && listHasFocus) {
      hasHandledInitialFocusRef.current = true;
      return;
    }

    if (targetId !== undefined && focusModelElement(targetId)) {
      hasHandledInitialFocusRef.current = true;
    }
  });

  const moveEmptyListFocusToCancel = useEffectEvent(() => {
    if (isSaving) return;
    enterFooter(0);
  });

  useEffect(() => {
    if (!open) {
      hasHandledInitialFocusRef.current = false;
      return;
    }
    resetDialogState();
  }, [open]);

  const filteredIdsKey = filteredModels.map((m) => m.id).join("\0");

  // biome-ignore lint/correctness/useExhaustiveDependencies: filteredIdsKey is the serialized form of filteredModels (ids joined); depending on the array identity would re-run this effect on every commit while the dialog is open, so the filteredModels read inside repairListFocus is covered by filteredIdsKey. isSaving and discoveryStatus retry empty-list recovery when saving completes or discovery becomes ready.
  useEffect(() => {
    if (!open) return;
    if (!listInteractive) {
      if (focusZone === "list" && hadFilteredModelsRef.current) {
        moveEmptyListFocusToCancel();
      }
      return;
    }
    hadFilteredModelsRef.current = true;
    if (focusZone !== "list") return;
    repairListFocus();
  }, [open, focusZone, filteredIdsKey, isSaving, discoveryStatus]);

  const handleListSelect = (modelId: string) => {
    setFocusZone("list");
    focusModelElement(modelId);
    setCheckedModelId(modelId);
  };

  const handleListHighlightChange = (modelId: string | null) => {
    if (modelId === null) return;
    setFocusZone("list");
    focusModel(modelId);
  };

  return {
    focusZone,
    focusedModelId,
    checkedModelId,
    filterIndex,
    setFilterIndex,
    footerButtonIndex: footerActionRow.focusedIndex,
    getCloseButtonProps,
    getFooterButtonProps,
    getFilterButtonProps: filters.getFilterButtonProps,
    setFocusZone,
    handleFilterKeyDown: filters.handleFilterKeyDown,
    handleConfirm,
    handleSearchEscape: search.handleSearchEscape,
    handleSearchArrowDown: search.handleSearchArrowDown,
    handleListHighlightChange,
    handleListBoundaryReached,
    handleListSelect,
  };
}
