import { useState, useEffect, type RefObject } from "react";
import type { ModelInfo } from "@stargazer/schemas/config";
import { useKey, useFocusZone, useNavigation } from "@stargazer/keyboard";
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
  setFocusZone: (zone: FocusZone) => void;
  handleConfirm: () => void;
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

  const { zone: focusZone, setZone: setFocusZone, inZone } = useFocusZone({
    initial: "list" as FocusZone,
    zones: ["search", "filters", "list", "footer"] as const,
    enabled: open,
  });

  // Use useNavigation for the model list — DOM-based navigation with role="radio"
  const { focusedValue: focusedModelId, focus: focusModel } = useNavigation({
    containerRef: listContainerRef,
    role: "radio",
    enabled: open && inZone("list") && filteredModels.length > 0,
    wrap: false,
    upKeys: ["ArrowUp", "k"],
    downKeys: ["ArrowDown", "j"],
    onSelect: (modelId) => {
      // Space: check the radio
      setCheckedModelId(modelId);
    },
    onEnter: (modelId) => {
      // Enter: check + confirm + close
      onSelect(modelId);
      onOpenChange(false);
    },
    onBoundaryReached: (direction) => {
      if (direction === "up") {
        setFocusZone("filters");
        setFilterIndex(0);
      } else if (direction === "down") {
        setFocusZone("footer");
        setFooterButtonIndex(1);
      }
    },
  });

  // Reset all state when dialog opens — intentionally omit deps other than `open`
  // to run exactly once per open transition, not on every model/filter change
  useEffect(() => {
    if (!open) return;
    resetFilters();
    setFocusZone("list");
    setFilterIndex(0);
    setFooterButtonIndex(1);
    setCheckedModelId(currentModel);
    // Focus the current model (or first) in the list after reset
    const targetId = currentModel ?? models[0]?.id;
    if (targetId) focusModel(targetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset once per dialog open, not on data changes
  }, [open]);

  const handleConfirm = () => {
    // Confirm the checked model (the one with the radio dot)
    const modelId = checkedModelId ?? focusedModelId;
    if (modelId) {
      onSelect(modelId);
      onOpenChange(false);
    }
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
    if (targetId) focusModel(targetId);
  };

  // Search zone
  useKey("ArrowDown", () => {
    setFocusZone("filters");
    searchInputRef.current?.blur();
  },
    { enabled: open && inZone("search") });

  // Filters zone — manually set zone because these handlers override useFocusZone transitions
  useKey("ArrowUp", () => {
    setFocusZone("search");
    searchInputRef.current?.focus();
  },
    { enabled: open && inZone("filters") });
  useKey("ArrowDown", () => {
    setFocusZone("list");
    focusBoundaryModel("first");
  }, { enabled: open && inZone("filters") });
  useKey("ArrowLeft", () => setFilterIndex((prev) => (prev > 0 ? prev - 1 : 2)), { enabled: open && inZone("filters") });
  useKey("ArrowRight", () => setFilterIndex((prev) => (prev < 2 ? prev + 1 : 0)), { enabled: open && inZone("filters") });
  useKey("Enter", () => setTierFilter(TIER_FILTERS[filterIndex]), { enabled: open && inZone("filters") });
  useKey(" ", () => setTierFilter(TIER_FILTERS[filterIndex]), { enabled: open && inZone("filters") });

  // Footer zone — manually set zone because this handler overrides useFocusZone transition
  useKey("ArrowLeft", () => setFooterButtonIndex(0), { enabled: open && inZone("footer") });
  useKey("ArrowRight", () => setFooterButtonIndex(1), { enabled: open && inZone("footer") });
  useKey("ArrowUp", () => {
    setFocusZone("list");
    focusBoundaryModel("last");
  }, { enabled: open && inZone("footer") });
  useKey("Enter", () => footerButtonIndex === 0 ? handleCancel() : handleConfirm(), { enabled: open && inZone("footer") });
  useKey(" ", () => footerButtonIndex === 0 ? handleCancel() : handleConfirm(), { enabled: open && inZone("footer") });

  // Global shortcuts
  useKey("/", () => {
    if (focusZone !== "search") {
      setFocusZone("search");
      searchInputRef.current?.focus();
    }
  }, { enabled: open });
  useKey("f", cycleTierFilter, { enabled: open && !inZone("search") });
  useKey("Escape", handleCancel, { enabled: open && !inZone("search") });

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
    focusModel(modelId);
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
    setFocusZone,
    handleConfirm,
    handleCancel,
    handleUseCustom,
    handleSearchEscape,
    handleSearchArrowDown,
    handleListSelect,
  };
}
