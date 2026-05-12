import { useCallback, useEffect, useEffectEvent, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefCallback, type RefObject } from "react";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import {
  containsActiveElement,
  findNavigationItemByValue,
  useKey,
  useFocusZone,
  useScopedNavigation,
} from "@diffgazer/keys";
import { TIER_FILTERS } from "@/features/providers/constants";

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
  setFooterButtonIndex: (index: number) => void;
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

function getEnabledFooterButtonIndex(index: number, canConfirm: boolean) {
  if (index === 1 && canConfirm) return 1;
  return 0;
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
  const [footerButtonIndex, setFooterButtonIndex] = useState(1);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasHandledInitialFocusRef = useRef(false);
  const footerButtonRefs = useRef(new Map<number, HTMLButtonElement>());
  const filterButtonRefs = useRef(new Map<number, HTMLButtonElement>());
  const canConfirm = filteredModels.length > 0;
  const { zone: focusZone, setZone: setFocusZone, isZone } = useFocusZone({
    initial: "list" as FocusZone,
    zones: ["close", "search", "filters", "list", "footer"] as const,
    enabled: open,
    scope: "model-dialog",
  });

  const focusSearchInput = () => {
    setFocusZone("search");
    searchInputRef.current?.focus();
  };

  const focusCloseButton = () => {
    setFocusZone("close");
    closeButtonRef.current?.focus();
  };

  const getCloseButtonProps = () => ({
    ref: (node: HTMLButtonElement | null) => {
      closeButtonRef.current = node;
    },
    onFocus: () => {
      if (!hasHandledInitialFocusRef.current) return;
      setFocusZone("close");
    },
  });

  const focusFooterButton = useCallback((index: number) => {
    const targetIndex = getEnabledFooterButtonIndex(index, canConfirm);
    setFooterButtonIndex(targetIndex);
    footerButtonRefs.current.get(targetIndex)?.focus();
  }, [canConfirm]);

  const isFooterButtonFocused = () => {
    const button = footerButtonRefs.current.get(footerButtonIndex);
    return button ? containsActiveElement(button) : false;
  };

  const getFooterButtonProps = (index: number) => ({
    ref: (node: HTMLButtonElement | null) => {
      if (node) footerButtonRefs.current.set(index, node);
      else footerButtonRefs.current.delete(index);
    },
    onFocus: () => {
      setFocusZone("footer");
      setFooterButtonIndex(getEnabledFooterButtonIndex(index, canConfirm));
    },
  });

  const focusFilterButton = (index: number) => {
    const nextIndex = ((index % TIER_FILTERS.length) + TIER_FILTERS.length) % TIER_FILTERS.length;
    setFocusZone("filters");
    setFilterIndex(nextIndex);
    filterButtonRefs.current.get(nextIndex)?.focus();
  };

  const getFilterButtonProps = (index: number) => ({
    ref: (node: HTMLButtonElement | null) => {
      if (node) filterButtonRefs.current.set(index, node);
      else filterButtonRefs.current.delete(index);
    },
    onFocus: () => {
      setFocusZone("filters");
      setFilterIndex(index);
    },
  });

  const handleListBoundaryReached = (direction: "previous" | "next") => {
    if (direction === "previous") {
      focusFilterButton(0);
      return;
    }

    setFocusZone("footer");
    focusFooterButton(1);
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

  const resetDialogState = useEffectEvent(() => {
    hasHandledInitialFocusRef.current = false;
    resetFilters();
    setFocusZone("list");
    setFilterIndex(0);
    setFooterButtonIndex(canConfirm ? 1 : 0);
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
  }, [open, focusZone, filteredModels, focusedModelId, currentModel]);

  useEffect(() => {
    if (!open || focusZone !== "footer" || canConfirm || footerButtonIndex !== 1) return;
    focusFooterButton(0);
  }, [canConfirm, focusFooterButton, footerButtonIndex, focusZone, open]);

  const handleConfirm = (explicitModelId?: string) => {
    const nextModelId = [explicitModelId, checkedModelId, focusedModelId]
      .find((id) => id != null && filteredModels.some((model) => model.id === id))
      ?? filteredModels[0]?.id;
    if (!nextModelId) return;
    onSelect(nextModelId);
    onOpenChange(false);
  };

  const handleUseCustom = () => {
    const customId = searchQuery.trim();
    if (!customId) return;
    onSelect(customId);
    onOpenChange(false);
  };

  const handleCancel = () => onOpenChange(false);

  const focusBoundaryModel = (target: "first" | "last") => {
    const targetId =
      target === "last"
        ? filteredModels[filteredModels.length - 1]?.id
        : filteredModels[0]?.id;
    if (targetId) focusModelElement(targetId);
  };

  useKey("ArrowDown", () => {
    focusFilterButton(filterIndex);
    searchInputRef.current?.blur();
  },
    { enabled: open && isZone("search"), allowInInput: true, preventDefault: true });
  useKey("ArrowUp", focusCloseButton,
    { enabled: open && isZone("search"), allowInInput: true, preventDefault: true });

  useKey("ArrowDown", focusSearchInput,
    { enabled: open && isZone("close"), preventDefault: true });

  useKey("ArrowUp", () => {
    focusSearchInput();
  },
    { enabled: open && isZone("filters"), preventDefault: true });
  useKey("ArrowDown", () => {
    if (filteredModels.length === 0) {
      setFocusZone("footer");
      focusFooterButton(0);
      return;
    }
    setFocusZone("list");
    focusBoundaryModel("first");
  }, { enabled: open && isZone("filters"), preventDefault: true });

  useKey("ArrowLeft", () => focusFooterButton(0), { enabled: open && isZone("footer") });
  useKey("ArrowRight", () => focusFooterButton(1), { enabled: open && isZone("footer") });
  useKey("ArrowUp", () => {
    if (filteredModels.length === 0) {
      focusFilterButton(filterIndex);
      return;
    }
    setFocusZone("list");
    focusBoundaryModel("last");
  }, { enabled: open && isZone("footer") });
  useKey("Enter", () => {
    if (isFooterButtonFocused()) return;
    if (footerButtonIndex === 0) handleCancel();
    else if (canConfirm) handleConfirm();
  }, { enabled: open && isZone("footer") });
  useKey(" ", () => {
    if (isFooterButtonFocused()) return;
    if (footerButtonIndex === 0) handleCancel();
    else if (canConfirm) handleConfirm();
  }, { enabled: open && isZone("footer") });

  useKey("/", () => {
    if (focusZone !== "search") {
      focusSearchInput();
    }
  }, { enabled: open, preventDefault: true });
  useKey("f", cycleTierFilter, { enabled: open && !isZone("search") });
  useKey("Escape", handleCancel, { enabled: open && !isZone("search") });

  const handleSearchEscape = () => {
    if (searchQuery) {
      setSearchQuery("");
    } else {
      searchInputRef.current?.blur();
      setFocusZone("list");
      focusBoundaryModel("first");
    }
  };

  const handleSearchArrowDown = () => {
    searchInputRef.current?.blur();
    focusFilterButton(filterIndex);
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

  const handleFilterKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusZone("search");
      searchInputRef.current?.focus();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (filteredModels.length === 0) {
        setFocusZone("footer");
        focusFooterButton(0);
        return;
      }
      setFocusZone("list");
      focusBoundaryModel("first");
    }
  };

  return {
    focusZone,
    focusedModelId,
    checkedModelId,
    setCheckedModelId,
    filterIndex,
    setFilterIndex,
    footerButtonIndex,
    setFooterButtonIndex,
    getCloseButtonProps,
    getFooterButtonProps,
    getFilterButtonProps,
    setFocusZone,
    handleFilterKeyDown,
    handleConfirm,
    handleCancel,
    handleUseCustom,
    handleSearchEscape,
    handleSearchArrowDown,
    handleListHighlightChange,
    handleListBoundaryReached,
    handleListSelect,
  };
}
