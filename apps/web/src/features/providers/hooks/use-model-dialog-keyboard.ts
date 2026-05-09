import { useEffect, useEffectEvent, useRef, useState, type RefCallback, type RefObject } from "react";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { useKey, useFocusZone, useScopedNavigation } from "@diffgazer/keys";
import { TIER_FILTERS, type TierFilter } from "@/features/providers/constants";

type FocusZone = "search" | "filters" | "list" | "footer";

interface ModelDialogKeyboardOptions {
  open: boolean;
  currentModel: string | undefined;
  models: ModelInfo[];
  filteredModels: ModelInfo[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setTierFilter: (filter: TierFilter) => void;
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
  setFocusZone: (zone: FocusZone) => void;
  handleConfirm: (modelId?: string) => void;
  handleCancel: () => void;
  handleUseCustom: () => void;
  handleSearchEscape: () => void;
  handleSearchArrowDown: () => void;
  handleListSelect: (modelId: string) => void;
}

export function useModelDialogKeyboard({
  open,
  currentModel,
  models,
  filteredModels,
  searchQuery,
  setSearchQuery,
  setTierFilter,
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
  const footerButtonRefs = useRef(new Map<number, HTMLButtonElement>());
  const lastTierFilterIndex = TIER_FILTERS.length - 1;

  const focusFooterButton = (index: number) => {
    setFooterButtonIndex(index);
    footerButtonRefs.current.get(index)?.focus();
  };

  const isFooterButtonFocused = () => {
    const button = footerButtonRefs.current.get(footerButtonIndex);
    const activeElement = button?.ownerDocument.activeElement;
    const View = button?.ownerDocument.defaultView;
    return Boolean(button && View && activeElement instanceof View.HTMLElement && button.contains(activeElement));
  };

  const getFooterButtonProps = (index: number) => ({
    ref: (node: HTMLButtonElement | null) => {
      if (node) footerButtonRefs.current.set(index, node);
      else footerButtonRefs.current.delete(index);
    },
    onFocus: () => {
      setFocusZone("footer");
      setFooterButtonIndex(index);
    },
  });

  const { zone: focusZone, setZone: setFocusZone, isZone } = useFocusZone({
    initial: "list" as FocusZone,
    zones: ["search", "filters", "list", "footer"] as const,
    enabled: open,
  });

  const { highlighted: focusedModelId, highlight: focusModel } = useScopedNavigation({
    containerRef: listContainerRef,
    role: "radio",
    enabled: open && isZone("list") && filteredModels.length > 0,
    wrap: false,
    moveFocus: true,
    upKeys: ["ArrowUp", "k"],
    downKeys: ["ArrowDown", "j"],
    onNavigationBoundaryReached: (direction) => {
      if (direction === "previous") {
        setFocusZone("filters");
        setFilterIndex(0);
      } else if (direction === "next") {
        setFocusZone("footer");
        focusFooterButton(1);
      }
    },
  });

  const getModelElement = (modelId: string) => {
    return Array.from(listContainerRef.current?.querySelectorAll<HTMLElement>('[role="radio"][data-value]') ?? [])
      .find((item) => item.dataset.value === modelId) ?? null;
  };

  const getFocusedModelId = () => {
    const container = listContainerRef.current;
    const activeElement = container?.ownerDocument.activeElement;
    const View = container?.ownerDocument.defaultView;
    if (!container || !View || !(activeElement instanceof View.HTMLElement) || !container.contains(activeElement)) {
      return focusedModelId;
    }

    const modelId = activeElement.closest<HTMLElement>('[role="radio"][data-value]')?.dataset.value;
    return modelId ?? focusedModelId;
  };

  const focusModelElement = (modelId: string) => {
    focusModel(modelId);
    getModelElement(modelId)?.focus();
  };

  const resetDialogState = useEffectEvent(() => {
    resetFilters();
    setFocusZone("list");
    setFilterIndex(0);
    setFooterButtonIndex(1);
    setCheckedModelId(currentModel);
    const targetId = currentModel ?? models[0]?.id;
    if (targetId) focusModelElement(targetId);
  });

  const repairListFocus = useEffectEvent(() => {
    const hasFocusedModel = filteredModels.some((model) => model.id === focusedModelId);
    if (hasFocusedModel) return;

    const hasCurrentModel = filteredModels.some((model) => model.id === currentModel);
    const targetId = hasCurrentModel ? currentModel : filteredModels[0]?.id;
    if (targetId) focusModelElement(targetId);
  });

  useEffect(() => {
    if (!open) return;
    resetDialogState();
  }, [open]);

  useEffect(() => {
    if (!open || focusZone !== "list" || filteredModels.length === 0) return;
    repairListFocus();
  }, [open, focusZone, filteredModels, focusedModelId, currentModel]);

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

  const focusPreviousFilter = () => {
    setFilterIndex((prev) => (prev > 0 ? prev - 1 : lastTierFilterIndex));
  };

  const focusNextFilter = () => {
    setFilterIndex((prev) => (prev < lastTierFilterIndex ? prev + 1 : 0));
  };

  const applyFocusedFilter = () => {
    const filter = TIER_FILTERS[filterIndex];
    if (filter) setTierFilter(filter);
  };

  useKey("ArrowDown", () => {
    setFocusZone("filters");
    searchInputRef.current?.blur();
  },
    { enabled: open && isZone("search") });

  useKey("ArrowUp", () => {
    setFocusZone("search");
    searchInputRef.current?.focus();
  },
    { enabled: open && isZone("filters") });
  useKey("ArrowDown", () => {
    setFocusZone("list");
    focusBoundaryModel("first");
  }, { enabled: open && isZone("filters") });
  useKey("ArrowLeft", focusPreviousFilter, { enabled: open && isZone("filters") });
  useKey("ArrowRight", focusNextFilter, { enabled: open && isZone("filters") });
  useKey("Enter", applyFocusedFilter, { enabled: open && isZone("filters") });
  useKey(" ", applyFocusedFilter, { enabled: open && isZone("filters") });

  useKey("ArrowLeft", () => focusFooterButton(0), { enabled: open && isZone("footer") });
  useKey("ArrowRight", () => focusFooterButton(1), { enabled: open && isZone("footer") });
  useKey("ArrowUp", () => {
    setFocusZone("list");
    focusBoundaryModel("last");
  }, { enabled: open && isZone("footer") });
  useKey("Enter", () => {
    if (isFooterButtonFocused()) return;
    footerButtonIndex === 0 ? handleCancel() : handleConfirm();
  }, { enabled: open && isZone("footer") });
  useKey(" ", () => {
    if (isFooterButtonFocused()) return;
    footerButtonIndex === 0 ? handleCancel() : handleConfirm();
  }, { enabled: open && isZone("footer") });

  useKey("/", () => {
    if (focusZone !== "search") {
      setFocusZone("search");
      searchInputRef.current?.focus();
    }
  }, { enabled: open });
  useKey("f", cycleTierFilter, { enabled: open && !isZone("search") });
  useKey("Escape", handleCancel, { enabled: open && !isZone("search") });
  useKey(" ", () => {
    const modelId = getFocusedModelId();
    if (modelId) setCheckedModelId(modelId);
  }, { enabled: open && isZone("list") });
  useKey("Enter", () => {
    const modelId = getFocusedModelId();
    if (modelId) handleConfirm(modelId);
  }, { enabled: open && isZone("list") });

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
    setFocusZone("filters");
  };

  const handleListSelect = (modelId: string) => {
    setFocusZone("list");
    focusModelElement(modelId);
    setCheckedModelId(modelId);
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
    getFooterButtonProps,
    setFocusZone,
    handleConfirm,
    handleCancel,
    handleUseCustom,
    handleSearchEscape,
    handleSearchArrowDown,
    handleListSelect,
  };
}
