import { useState, useEffect, type RefObject } from "react";
import type { ModelInfo } from "@stargazer/schemas/config";
import { useKey, useFocusZone } from "@stargazer/keyboard";
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
  const [filterIndex, setFilterIndex] = useState(0);
  const [footerButtonIndex, setFooterButtonIndex] = useState(1);

  const { zone: focusZone, setZone: setFocusZone, inZone } = useFocusZone({
    initial: "list" as FocusZone,
    zones: ["search", "filters", "list", "footer"] as const,
    transitions: ({ zone, key }) => {
      if (zone === "search" && key === "ArrowDown") return "filters";
      if (zone === "filters" && key === "ArrowUp") return "search";
      if (zone === "filters" && key === "ArrowDown") return "list";
      if (zone === "list" && key === "ArrowUp" && selectedIndex === 0) return "filters";
      if (zone === "list" && key === "ArrowDown" && selectedIndex >= filteredModels.length - 1) return "footer";
      if (zone === "footer" && key === "ArrowUp") return "list";
      return null;
    },
    enabled: open,
  });

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
    if (selectedIndex > 0) {
      setSelectedIndex((prev) => prev - 1);
    } else {
      setFocusZone("filters");
      setFilterIndex(0);
    }
  };

  const navigateDown = () => {
    if (selectedIndex < filteredModels.length - 1) {
      setSelectedIndex((prev) => prev + 1);
    } else {
      setFocusZone("footer");
      setFooterButtonIndex(1);
    }
  };

  // List zone — ArrowUp/ArrowDown side-effects (zone change handled by transitions)
  useKey("ArrowUp", () => {
    if (selectedIndex > 0) setSelectedIndex((prev) => prev - 1);
    else setFilterIndex(0);
  }, { enabled: open && inZone("list") });
  useKey("ArrowDown", () => {
    if (selectedIndex < filteredModels.length - 1) setSelectedIndex((prev) => prev + 1);
    else setFooterButtonIndex(1);
  }, { enabled: open && inZone("list") });
  // j/k — manual zone transitions + index changes (not handled by useFocusZone)
  useKey("k", navigateUp, { enabled: open && inZone("list") });
  useKey("j", navigateDown, { enabled: open && inZone("list") });
  useKey(" ", handleCheck, { enabled: open && inZone("list") && filteredModels.length > 0 });
  useKey("Enter", handleConfirm, { enabled: open && inZone("list") && filteredModels.length > 0 });

  // Search zone — side-effect for transition
  useKey("ArrowDown", () => searchInputRef.current?.blur(),
    { enabled: open && inZone("search") });

  // Filters zone — side-effects for transitions + horizontal nav + actions
  useKey("ArrowUp", () => searchInputRef.current?.focus(),
    { enabled: open && inZone("filters") });
  useKey("ArrowDown", () => setSelectedIndex(0),
    { enabled: open && inZone("filters") });
  useKey("ArrowLeft", () => setFilterIndex((prev) => (prev > 0 ? prev - 1 : 2)), { enabled: open && inZone("filters") });
  useKey("ArrowRight", () => setFilterIndex((prev) => (prev < 2 ? prev + 1 : 0)), { enabled: open && inZone("filters") });
  useKey("Enter", () => setTierFilter(TIER_FILTERS[filterIndex]), { enabled: open && inZone("filters") });
  useKey(" ", () => setTierFilter(TIER_FILTERS[filterIndex]), { enabled: open && inZone("filters") });

  // Footer zone — side-effect for transition + horizontal nav + actions
  useKey("ArrowLeft", () => setFooterButtonIndex(0), { enabled: open && inZone("footer") });
  useKey("ArrowRight", () => setFooterButtonIndex(1), { enabled: open && inZone("footer") });
  useKey("ArrowUp", () => setSelectedIndex(filteredModels.length - 1),
    { enabled: open && inZone("footer") });
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
