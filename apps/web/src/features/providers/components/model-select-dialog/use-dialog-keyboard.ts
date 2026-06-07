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
import { useModelDialogFocusTrap } from "./use-dialog-focus-trap";
import { useModelFilters } from "./use-filter-row-keyboard";
import { useModelSearchFocus } from "./use-search-focus";

type FocusZone = "close" | "search" | "filters" | "list" | "footer";

interface ModelDialogKeyboardOptions {
  open: boolean;
  currentModel: string | undefined;
  models: ModelInfo[];
  filteredModels: ModelInfo[];
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
  setCheckedModelId: (id: string | undefined) => void;
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
  handleCancel: () => void;
  handleUseCustom: () => void;
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
  currentModel,
  models,
  filteredModels,
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
  const [tabFocusedFooterIndex, setTabFocusedFooterIndex] = useState<number | null>(null);
  const hasHandledInitialFocusRef = useRef(false);
  const filterButtonRefs = useRef(new Map<number, HTMLButtonElement>());
  const canConfirm = filteredModels.length > 0;

  const {
    focusZone,
    setFocusZone,
    isZone,
    focusCloseButton,
    focusSearchInput,
    getCloseButtonProps,
  } = useModelDialogFocusTrap({ open, searchInputRef, hasHandledInitialFocusRef });

  const blurSearchInput = () => searchInputRef.current?.blur();

  const handleCancel = () => onOpenChange(false);

  const handleConfirm = (explicitModelId?: string) => {
    const nextModelId =
      [explicitModelId, checkedModelId, focusedModelId].find(
        (id) => id != null && filteredModels.some((model) => model.id === id),
      ) ?? filteredModels[0]?.id;
    if (!nextModelId) return;
    onSelect(nextModelId);
    onOpenChange(false);
  };

  const footerActionRow = useActionRowNavigation({
    enabled: open && isZone("footer"),
    actionCount: 2,
    disabledActions: [false, !canConfirm],
    onAction: (index) => {
      if (index === 0) handleCancel();
      else if (index === 1 && canConfirm) handleConfirm();
    },
    onNavigationBoundaryReached: (direction) => {
      if (direction !== "previous") return;
      if (filteredModels.length === 0) {
        focusFilterButton(filterIndex);
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
        setTabFocusedFooterIndex(index);
      },
    };
  };

  const footerButtonIndex =
    isZone("footer") && !footerActionRow.inActions && tabFocusedFooterIndex !== null
      ? tabFocusedFooterIndex
      : footerActionRow.focusedIndex;

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
    enabled: open && isZone("list") && filteredModels.length > 0,
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
    hasFilteredModels: filteredModels.length > 0,
    cycleTierFilter,
    registerFilterButton,
    focusFilterAtIndex,
    focusSearchInput,
    enterListFromBoundary,
    enterFooter,
  });

  const search = useModelSearchFocus({
    open,
    inSearch: isZone("search"),
    searchQuery,
    filterIndex,
    setSearchQuery,
    blurSearchInput,
    focusSearchInput,
    focusCloseButton,
    focusFilterButton,
    enterListFromBoundary,
  });

  const resetDialogState = useEffectEvent(() => {
    hasHandledInitialFocusRef.current = false;
    resetFilters();
    setFocusZone("list");
    setFilterIndex(0);
    setCheckedModelId(currentModel);
    const targetId = currentModel ?? models[0]?.id;
    if (targetId && focusModelElement(targetId)) {
      hasHandledInitialFocusRef.current = true;
      return;
    }
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

  useEffect(() => {
    if (!open) {
      hasHandledInitialFocusRef.current = false;
      return;
    }
    resetDialogState();
  }, [open]);

  useEffect(() => {
    if (!open || focusZone !== "list" || filteredModels.length === 0) return;
    repairListFocus();
  }, [open, focusZone, filteredModels]);

  useEffect(() => {
    if (focusZone !== "footer") setTabFocusedFooterIndex(null);
  }, [focusZone]);

  const handleUseCustom = () => {
    const customId = searchQuery.trim();
    if (!customId) return;
    onSelect(customId);
    onOpenChange(false);
  };

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
    setCheckedModelId,
    filterIndex,
    setFilterIndex,
    footerButtonIndex,
    getCloseButtonProps,
    getFooterButtonProps,
    getFilterButtonProps: filters.getFilterButtonProps,
    setFocusZone,
    handleFilterKeyDown: filters.handleFilterKeyDown,
    handleConfirm,
    handleCancel,
    handleUseCustom,
    handleSearchEscape: search.handleSearchEscape,
    handleSearchArrowDown: search.handleSearchArrowDown,
    handleListHighlightChange,
    handleListBoundaryReached,
    handleListSelect,
  };
}
