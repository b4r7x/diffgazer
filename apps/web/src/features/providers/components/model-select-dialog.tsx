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
  Badge,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { useKey } from "@/hooks/keyboard";
import {
  GEMINI_MODEL_INFO,
  OPENAI_MODEL_INFO,
  ANTHROPIC_MODEL_INFO,
  GLM_MODEL_INFO,
  type AIProvider,
  type ModelInfo,
} from "@repo/schemas";

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

export function ModelSelectDialog({
  open,
  onOpenChange,
  provider,
  currentModel,
  onSelect,
}: ModelSelectDialogProps) {
  const models = getModelsForProvider(provider);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | "free" | "paid">("all");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  type FocusZone = 'search' | 'filters' | 'list' | 'footer';
  const [focusZone, setFocusZone] = useState<FocusZone>('list');
  const [filterIndex, setFilterIndex] = useState(0);
  const [footerButtonIndex, setFooterButtonIndex] = useState(1);

  const FILTERS = ['all', 'free', 'paid'] as const;

  // Scroll visibility helpers
  const isItemVisible = (itemIndex: number): boolean => {
    const container = listContainerRef.current;
    if (!container) return true;

    const items = container.querySelectorAll('[role="option"]');
    const item = items[itemIndex] as HTMLElement | undefined;
    if (!item) return true;

    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    return itemRect.top >= containerRect.top && itemRect.bottom <= containerRect.bottom;
  };

  const scrollItemIntoView = (itemIndex: number) => {
    const container = listContainerRef.current;
    if (!container) return;

    const items = container.querySelectorAll('[role="option"]');
    const item = items[itemIndex] as HTMLElement | undefined;
    if (!item) return;

    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const padding = 8;

    if (itemRect.top < containerRect.top + padding) {
      container.scrollTop -= (containerRect.top + padding - itemRect.top);
    } else if (itemRect.bottom > containerRect.bottom - padding) {
      container.scrollTop += (itemRect.bottom - containerRect.bottom + padding);
    }
  };

  // Derive filtered models inline - React 19 Compiler optimizes this
  let filteredModels = models;

  if (tierFilter === "free") {
    filteredModels = filteredModels.filter((m) => m.tier === "free");
  } else if (tierFilter === "paid") {
    filteredModels = filteredModels.filter((m) => m.tier === "paid");
  }

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredModels = filteredModels.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query)
    );
  }

  // Reset filters and selection when dialog opens
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setTierFilter("all");
      setFocusZone("list");
      setFilterIndex(0);
      setFooterButtonIndex(1);
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
    if (focusZone === 'list' && filteredModels.length > 0) {
      scrollItemIntoView(selectedIndex);
    }
  }, [selectedIndex, focusZone]);

  const handleConfirm = () => {
    const model = filteredModels[selectedIndex];
    if (model) {
      onSelect(model.id);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const navigateUpOrBoundary = () => {
    if (selectedIndex > 0) {
      setSelectedIndex(prev => prev - 1);
    } else {
      // At first item - check if visible before transitioning
      if (isItemVisible(0)) {
        setFocusZone("filters");
        setFilterIndex(0);
      } else {
        scrollItemIntoView(0);
      }
    }
  };

  const navigateDownOrBoundary = () => {
    const lastIndex = filteredModels.length - 1;

    if (selectedIndex < lastIndex) {
      setSelectedIndex(prev => prev + 1);
    } else {
      // At last item - check if visible before transitioning
      if (isItemVisible(lastIndex)) {
        setFocusZone("footer");
        setFooterButtonIndex(1);
      } else {
        scrollItemIntoView(lastIndex);
      }
    }
  };

  // List zone navigation
  useKey("ArrowUp", navigateUpOrBoundary, { enabled: open && focusZone === "list" });
  useKey("ArrowDown", navigateDownOrBoundary, { enabled: open && focusZone === "list" });
  useKey("j", navigateUpOrBoundary, { enabled: open && focusZone === "list" });
  useKey("k", navigateDownOrBoundary, { enabled: open && focusZone === "list" });
  useKey("Enter", handleConfirm, { enabled: open && focusZone === "list" && filteredModels.length > 0 });

  // Search zone navigation
  useKey("ArrowDown", () => {
    searchInputRef.current?.blur();
    setFocusZone("filters");
  }, { enabled: open && focusZone === "search" });

  // Filters zone navigation
  useKey("ArrowLeft", () => {
    setFilterIndex((prev) => (prev > 0 ? prev - 1 : FILTERS.length - 1));
  }, { enabled: open && focusZone === "filters" });
  useKey("ArrowRight", () => {
    setFilterIndex((prev) => (prev < FILTERS.length - 1 ? prev + 1 : 0));
  }, { enabled: open && focusZone === "filters" });
  useKey("ArrowDown", () => {
    setFocusZone("list");
  }, { enabled: open && focusZone === "filters" });
  useKey("ArrowUp", () => {
    setFocusZone("search");
    searchInputRef.current?.focus();
  }, { enabled: open && focusZone === "filters" });
  useKey("Enter", () => {
    setTierFilter(FILTERS[filterIndex]);
  }, { enabled: open && focusZone === "filters" });
  useKey(" ", () => {
    setTierFilter(FILTERS[filterIndex]);
  }, { enabled: open && focusZone === "filters" });

  // Footer zone navigation
  useKey("ArrowLeft", () => {
    setFooterButtonIndex(0);
  }, { enabled: open && focusZone === "footer" });
  useKey("ArrowRight", () => {
    setFooterButtonIndex(1);
  }, { enabled: open && focusZone === "footer" });
  useKey("ArrowUp", () => {
    setFocusZone("list");
  }, { enabled: open && focusZone === "footer" });
  useKey("Enter", () => {
    if (footerButtonIndex === 0) handleCancel();
    else handleConfirm();
  }, { enabled: open && focusZone === "footer" });
  useKey(" ", () => {
    if (footerButtonIndex === 0) handleCancel();
    else handleConfirm();
  }, { enabled: open && focusZone === "footer" });

  // Global shortcuts
  useKey("/", () => {
    if (focusZone !== "search") {
      setFocusZone("search");
      searchInputRef.current?.focus();
    }
  }, { enabled: open });
  useKey("f", () => {
    setTierFilter((prev) =>
      prev === "all" ? "free" : prev === "free" ? "paid" : "all"
    );
  }, { enabled: open && focusZone !== "search" });
  useKey("Escape", handleCancel, { enabled: open && focusZone !== "search" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border border-tui-border shadow-2xl">
        <DialogHeader className="bg-tui-selection/50">
          <DialogTitle className="text-tui-blue tracking-wide">Select Model</DialogTitle>
          <DialogClose className="text-gray-500 hover:text-tui-fg font-bold" />
        </DialogHeader>

        <DialogBody className="p-0 flex flex-col">
          {/* Search Input */}
          <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-tui-muted text-xs">
              /
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setFocusZone("search")}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (searchQuery) {
                    setSearchQuery("");
                  } else {
                    searchInputRef.current?.blur();
                    setFocusZone("list");
                  }
                  e.stopPropagation();
                }
                if (e.key === "ArrowDown") {
                  searchInputRef.current?.blur();
                  setFocusZone("filters");
                  e.preventDefault();
                }
              }}
              placeholder="Search models..."
              className="w-full bg-tui-input-bg border border-tui-border px-3 py-1.5 pl-6 text-xs focus:border-tui-blue focus:outline-none placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 pb-2 flex gap-1.5">
          {FILTERS.map((filter, idx) => (
            <button
              key={filter}
              type="button"
              onClick={() => {
                setFocusZone("filters");
                setTierFilter(filter);
                setFilterIndex(idx);
              }}
              className={cn(
                "px-2 py-0.5 text-[10px] cursor-pointer transition-colors uppercase",
                tierFilter === filter
                  ? "bg-tui-blue text-black font-bold"
                  : "border border-tui-border hover:border-tui-fg",
                focusZone === "filters" && filterIndex === idx && "ring-2 ring-tui-blue ring-offset-1 ring-offset-tui-bg"
              )}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Model List */}
        <div
          ref={listContainerRef}
          role="listbox"
          aria-label="Available models"
          className="px-4 py-2 space-y-1 max-h-60 overflow-y-auto scrollbar-thin"
        >
          {filteredModels.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">
              No models match your search
            </div>
          ) : (
            filteredModels.map((model, index) => {
            const isSelected = index === selectedIndex;
            return (
              <button
                key={model.id}
                role="option"
                aria-selected={isSelected}
                type="button"
                onClick={() => {
                  setFocusZone("list");
                  setSelectedIndex(index);
                }}
                onDoubleClick={handleConfirm}
                className={cn(
                  "flex items-start gap-3 w-full text-left px-3 py-2 rounded transition-colors",
                  isSelected
                    ? "bg-tui-selection/60 text-tui-fg"
                    : "text-gray-400 hover:bg-tui-selection/30 hover:text-tui-fg",
                  focusZone === "list" && isSelected && "ring-2 ring-tui-blue ring-offset-1 ring-offset-tui-bg"
                )}
              >
                <span
                  className={cn(
                    "font-bold shrink-0 mt-0.5",
                    isSelected ? "text-tui-blue" : "text-gray-600"
                  )}
                >
                  {isSelected ? "[ \u25cf ]" : "[   ]"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{model.name}</span>
                    <Badge
                      variant={model.tier === "free" ? "success" : "neutral"}
                      size="xs"
                      className="uppercase border border-tui-border px-1.5 py-0.5"
                    >
                      {model.tier}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {model.description}
                  </div>
                </div>
              </button>
            );
            })
          )}
          </div>
        </DialogBody>

        <DialogFooter className="justify-between">
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span>↑↓/jk navigate</span>
            <span>/ search</span>
            <span>f filter</span>
          </div>
          <div className="flex gap-3 items-center">
            <button
              type="button"
              onClick={() => {
                setFocusZone("footer");
                setFooterButtonIndex(0);
                handleCancel();
              }}
              className={cn(
                "text-xs text-gray-500 hover:text-tui-fg transition-colors",
                focusZone === "footer" && footerButtonIndex === 0 && "ring-2 ring-tui-blue rounded px-1"
              )}
            >
              [Esc] Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setFocusZone("footer");
                setFooterButtonIndex(1);
                handleConfirm();
              }}
              disabled={filteredModels.length === 0}
              className={cn(
                "bg-tui-blue text-black px-4 py-1.5 text-xs font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all",
                focusZone === "footer" && footerButtonIndex === 1 && "ring-2 ring-tui-blue ring-offset-2 ring-offset-tui-bg"
              )}
            >
              [Enter] Confirm
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
