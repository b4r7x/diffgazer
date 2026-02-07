import { useState, useEffect, type RefObject } from "react";
import type { ModelInfo } from "@stargazer/schemas/config";
import { useKey } from "@stargazer/keyboard";
import { useScrollIntoView } from "@/hooks/use-scroll-into-view";
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
  selectedIndex: number;
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [checkedModelId, setCheckedModelId] = useState<string | undefined>(currentModel);
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [filterIndex, setFilterIndex] = useState(0);
  const [footerButtonIndex, setFooterButtonIndex] = useState(1);

  const { scrollItemIntoView } = useScrollIntoView(listContainerRef);

  // Reset all state when dialog opens — intentionally omit deps other than `open`
  // to run exactly once per open transition, not on every model/filter change
  useEffect(() => {
    if (!open) return;
    resetFilters();
    setFocusZone("list");
    setFilterIndex(0);
    setFooterButtonIndex(1);
    setCheckedModelId(currentModel);
    const currentIndex = models.findIndex((m) => m.id === currentModel);
    setSelectedIndex(currentIndex >= 0 ? currentIndex : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset once per dialog open, not on data changes
  }, [open]);

  // Clamp selection when filtered list shrinks
  const clampedSelectedIndex =
    filteredModels.length > 0 && selectedIndex >= filteredModels.length
      ? 0
      : selectedIndex;

  // Auto-scroll selected item into view
  useEffect(() => {
    if (focusZone === "list" && filteredModels.length > 0) {
      scrollItemIntoView(clampedSelectedIndex);
    }
  }, [clampedSelectedIndex, focusZone, filteredModels.length, scrollItemIntoView]);

  const handleConfirm = () => {
    const model = filteredModels[clampedSelectedIndex];
    if (model) {
      onSelect(model.id);
      onOpenChange(false);
    }
  };

  const handleUseCustom = () => {
    const customId = searchQuery.trim();
    if (!customId) return;
    onSelect(customId);
    onOpenChange(false);
  };

  const handleCheck = () => {
    const model = filteredModels[clampedSelectedIndex];
    if (model) {
      setCheckedModelId(model.id);
    }
  };

  const handleCancel = () => onOpenChange(false);

  const navigateUp = () => {
    setSelectedIndex((prev) => {
      if (prev > 0) return prev - 1;
      setFocusZone("filters");
      setFilterIndex(0);
      return prev;
    });
  };

  const navigateDown = () => {
    setSelectedIndex((prev) => {
      if (prev < filteredModels.length - 1) return prev + 1;
      setFocusZone("footer");
      setFooterButtonIndex(1);
      return prev;
    });
  };

  // List zone
  useKey("ArrowUp", navigateUp, { enabled: open && focusZone === "list" });
  useKey("ArrowDown", navigateDown, { enabled: open && focusZone === "list" });
  useKey("k", navigateUp, { enabled: open && focusZone === "list" });
  useKey("j", navigateDown, { enabled: open && focusZone === "list" });
  useKey(" ", handleCheck, { enabled: open && focusZone === "list" && filteredModels.length > 0 });
  useKey("Enter", handleConfirm, { enabled: open && focusZone === "list" && filteredModels.length > 0 });

  // Search zone
  useKey("ArrowDown", () => {
    searchInputRef.current?.blur();
    setFocusZone("filters");
  }, { enabled: open && focusZone === "search" });

  // Filters zone
  useKey("ArrowLeft", () => setFilterIndex((prev) => (prev > 0 ? prev - 1 : 2)), { enabled: open && focusZone === "filters" });
  useKey("ArrowRight", () => setFilterIndex((prev) => (prev < 2 ? prev + 1 : 0)), { enabled: open && focusZone === "filters" });
  useKey("ArrowDown", () => {
    setFocusZone("list");
    setSelectedIndex(0);
  }, { enabled: open && focusZone === "filters" });
  useKey("ArrowUp", () => {
    setFocusZone("search");
    searchInputRef.current?.focus();
  }, { enabled: open && focusZone === "filters" });
  useKey("Enter", () => setTierFilter(TIER_FILTERS[filterIndex]), { enabled: open && focusZone === "filters" });
  useKey(" ", () => setTierFilter(TIER_FILTERS[filterIndex]), { enabled: open && focusZone === "filters" });

  // Footer zone
  useKey("ArrowLeft", () => setFooterButtonIndex(0), { enabled: open && focusZone === "footer" });
  useKey("ArrowRight", () => setFooterButtonIndex(1), { enabled: open && focusZone === "footer" });
  useKey("ArrowUp", () => {
    setFocusZone("list");
    setSelectedIndex(filteredModels.length - 1);
  }, { enabled: open && focusZone === "footer" });
  useKey("Enter", () => footerButtonIndex === 0 ? handleCancel() : handleConfirm(), { enabled: open && focusZone === "footer" });
  useKey(" ", () => footerButtonIndex === 0 ? handleCancel() : handleConfirm(), { enabled: open && focusZone === "footer" });

  // Global shortcuts
  useKey("/", () => {
    if (focusZone !== "search") {
      setFocusZone("search");
      searchInputRef.current?.focus();
    }
  }, { enabled: open });
  useKey("f", cycleTierFilter, { enabled: open && focusZone !== "search" });
  useKey("Escape", handleCancel, { enabled: open && focusZone !== "search" });

  const handleSearchEscape = () => {
    if (searchQuery) {
      setSearchQuery("");
    } else {
      searchInputRef.current?.blur();
      setFocusZone("list");
      setSelectedIndex(0);
    }
  };

  const handleSearchArrowDown = () => {
    searchInputRef.current?.blur();
    setFocusZone("filters");
  };

  return {
    focusZone,
    selectedIndex: clampedSelectedIndex,
    setSelectedIndex,
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
  };
}
