"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui";
import { useKey } from "@/hooks/keyboard";
import { useScrollIntoView } from "@/hooks/use-scroll-into-view";
import {
  GEMINI_MODEL_INFO,
  OPENAI_MODEL_INFO,
  ANTHROPIC_MODEL_INFO,
  GLM_MODEL_INFO,
  type AIProvider,
  type ModelInfo,
} from "@repo/schemas";
import { useModelFilter } from "./use-model-filter";
import { useDialogZoneNavigation } from "./use-dialog-zone-navigation";
import { ModelSearchInput } from "./model-search-input";
import { ModelFilterTabs, FILTERS } from "./model-filter-tabs";
import { ModelList } from "./model-list";
import { DialogFooterActions } from "./dialog-footer-actions";

interface ModelSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: AIProvider;
  currentModel: string | undefined;
  onSelect: (modelId: string) => void;
}

function getModelsForProvider(provider: AIProvider): ModelInfo[] {
  switch (provider) {
    case "gemini":
      return Object.values(GEMINI_MODEL_INFO);
    case "openai":
      return Object.values(OPENAI_MODEL_INFO);
    case "anthropic":
      return Object.values(ANTHROPIC_MODEL_INFO);
    case "glm":
      return Object.values(GLM_MODEL_INFO);
    default:
      return [];
  }
}

const FOOTER_HINTS = [
  { key: "↑↓/jk", label: "navigate" },
  { key: "/", label: "search" },
  { key: "f", label: "filter" },
];

export function ModelSelectDialog({
  open,
  onOpenChange,
  provider,
  currentModel,
  onSelect,
}: ModelSelectDialogProps) {
  const models = getModelsForProvider(provider);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const {
    searchQuery,
    setSearchQuery,
    tierFilter,
    setTierFilter,
    filteredModels,
    cycleTierFilter,
    resetFilters,
  } = useModelFilter(models);

  const {
    focusZone,
    setFocusZone,
    filterIndex,
    setFilterIndex,
    footerButtonIndex,
    setFooterButtonIndex,
    resetZones,
    moveFilterLeft,
    moveFilterRight,
  } = useDialogZoneNavigation();

  const { isItemVisible, scrollItemIntoView } =
    useScrollIntoView(listContainerRef);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      resetFilters();
      resetZones();
      const currentIndex = models.findIndex((m) => m.id === currentModel);
      setSelectedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  }, [open, currentModel, provider]);

  // Clamp selection when filtered list changes
  useEffect(() => {
    if (selectedIndex >= filteredModels.length && filteredModels.length > 0) {
      setSelectedIndex(0);
    }
  }, [filteredModels.length, selectedIndex]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (focusZone === "list" && filteredModels.length > 0) {
      scrollItemIntoView(selectedIndex);
    }
  }, [selectedIndex, focusZone, filteredModels.length]);

  const handleConfirm = () => {
    const model = filteredModels[selectedIndex];
    if (model) {
      onSelect(model.id);
      onOpenChange(false);
    }
  };

  const handleCancel = () => onOpenChange(false);

  const navigateUp = () => {
    if (selectedIndex > 0) {
      setSelectedIndex((prev) => prev - 1);
    } else if (isItemVisible(0)) {
      setFocusZone("filters");
      setFilterIndex(0);
    } else {
      scrollItemIntoView(0);
    }
  };

  const navigateDown = () => {
    const lastIndex = filteredModels.length - 1;
    if (selectedIndex < lastIndex) {
      setSelectedIndex((prev) => prev + 1);
    } else if (isItemVisible(lastIndex)) {
      setFocusZone("footer");
      setFooterButtonIndex(1);
    } else {
      scrollItemIntoView(lastIndex);
    }
  };

  // List zone
  useKey("ArrowUp", navigateUp, { enabled: open && focusZone === "list" });
  useKey("ArrowDown", navigateDown, { enabled: open && focusZone === "list" });
  useKey("j", navigateUp, { enabled: open && focusZone === "list" });
  useKey("k", navigateDown, { enabled: open && focusZone === "list" });
  useKey("Enter", handleConfirm, { enabled: open && focusZone === "list" && filteredModels.length > 0 });

  // Search zone
  useKey("ArrowDown", () => {
    searchInputRef.current?.blur();
    setFocusZone("filters");
  }, { enabled: open && focusZone === "search" });

  // Filters zone
  useKey("ArrowLeft", moveFilterLeft, { enabled: open && focusZone === "filters" });
  useKey("ArrowRight", moveFilterRight, { enabled: open && focusZone === "filters" });
  useKey("ArrowDown", () => setFocusZone("list"), { enabled: open && focusZone === "filters" });
  useKey("ArrowUp", () => {
    setFocusZone("search");
    searchInputRef.current?.focus();
  }, { enabled: open && focusZone === "filters" });
  useKey("Enter", () => setTierFilter(FILTERS[filterIndex]), { enabled: open && focusZone === "filters" });
  useKey(" ", () => setTierFilter(FILTERS[filterIndex]), { enabled: open && focusZone === "filters" });

  // Footer zone
  useKey("ArrowLeft", () => setFooterButtonIndex(0), { enabled: open && focusZone === "footer" });
  useKey("ArrowRight", () => setFooterButtonIndex(1), { enabled: open && focusZone === "footer" });
  useKey("ArrowUp", () => setFocusZone("list"), { enabled: open && focusZone === "footer" });
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
    }
  };

  const handleSearchArrowDown = () => {
    searchInputRef.current?.blur();
    setFocusZone("filters");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border border-tui-border shadow-2xl">
        <DialogHeader className="bg-tui-selection/50">
          <DialogTitle className="text-tui-blue tracking-wide">Select Model</DialogTitle>
          <DialogClose className="text-gray-500 hover:text-tui-fg font-bold" />
        </DialogHeader>

        <DialogBody className="p-0 flex flex-col">
          <ModelSearchInput
            ref={searchInputRef}
            value={searchQuery}
            onChange={setSearchQuery}
            onFocus={() => setFocusZone("search")}
            onEscape={handleSearchEscape}
            onArrowDown={handleSearchArrowDown}
          />

          <ModelFilterTabs
            value={tierFilter}
            onValueChange={setTierFilter}
            focusedIndex={filterIndex}
            isFocused={focusZone === "filters"}
            onTabClick={(idx) => {
              setFocusZone("filters");
              setFilterIndex(idx);
            }}
          />

          <ModelList
            ref={listContainerRef}
            models={filteredModels}
            selectedIndex={selectedIndex}
            isFocused={focusZone === "list"}
            onSelect={(idx) => {
              setFocusZone("list");
              setSelectedIndex(idx);
            }}
            onConfirm={handleConfirm}
          />
        </DialogBody>

        <DialogFooter className="justify-between">
          <DialogFooterActions
            onCancel={() => {
              setFocusZone("footer");
              setFooterButtonIndex(0);
              handleCancel();
            }}
            onConfirm={() => {
              setFocusZone("footer");
              setFooterButtonIndex(1);
              handleConfirm();
            }}
            canConfirm={filteredModels.length > 0}
            focusedButtonIndex={footerButtonIndex}
            isFocused={focusZone === "footer"}
            hints={FOOTER_HINTS}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
