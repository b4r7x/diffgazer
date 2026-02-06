"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  GLM_MODEL_INFO,
  type AIProvider,
  type ModelInfo,
} from "@stargazer/schemas/config";
import { api } from "@/lib/api";
import { OPENROUTER_PROVIDER_ID } from "../../constants";
import { useModelFilter } from "../../hooks/use-model-filter";
import { ModelSearchInput } from "./model-search-input";
import { ModelFilterTabs, FILTERS } from "./model-filter-tabs";
import { ModelList } from "./model-list";
import { DialogFooterActions } from "./dialog-footer-actions";

type FocusZone = "search" | "filters" | "list" | "footer";

interface ModelSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: AIProvider;
  currentModel: string | undefined;
  onSelect: (modelId: string) => void;
}

function isOpenRouterCompatible(model: {
  supportedParameters?: string[];
}): boolean {
  const params = model.supportedParameters ?? [];
  return params.includes("response_format") || params.includes("structured_outputs");
}

function mapOpenRouterModels(
  models: Array<{
    id: string;
    name: string;
    description?: string;
    isFree: boolean;
  }>
): ModelInfo[] {
  return models.map((model) => ({
    id: model.id,
    name: model.name || model.id,
    description: model.description ?? model.id,
    tier: model.isFree ? "free" : "paid",
  }));
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
  const [openRouterModels, setOpenRouterModels] = useState<ModelInfo[]>([]);
  const [openRouterLoading, setOpenRouterLoading] = useState(false);
  const [openRouterError, setOpenRouterError] = useState<string | null>(null);
  const [openRouterTotal, setOpenRouterTotal] = useState(0);
  const [openRouterCompatible, setOpenRouterCompatible] = useState(0);
  const [openRouterFetched, setOpenRouterFetched] = useState(false);
  const [openRouterHasParams, setOpenRouterHasParams] = useState(false);

  const models = useMemo(() => {
    switch (provider) {
      case "gemini":
        return Object.values(GEMINI_MODEL_INFO);
      case "zai":
      case "zai-coding":
        return Object.values(GLM_MODEL_INFO);
      case OPENROUTER_PROVIDER_ID:
        return openRouterModels;
      default:
        return [];
    }
  }, [provider, openRouterModels]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [checkedModelId, setCheckedModelId] = useState<string | undefined>(currentModel);
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

  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [filterIndex, setFilterIndex] = useState(0);
  const [footerButtonIndex, setFooterButtonIndex] = useState(1);

  const { scrollItemIntoView } = useScrollIntoView(listContainerRef);

  useEffect(() => {
    if (!open || provider !== OPENROUTER_PROVIDER_ID) return;
    if (openRouterFetched || openRouterLoading) return;

    setOpenRouterLoading(true);
    setOpenRouterError(null);
    api
      .getOpenRouterModels()
      .then((response) => {
        const withParams = response.models.filter(
          (model) => (model.supportedParameters?.length ?? 0) > 0
        );
        const hasParams = withParams.length > 0;
        const compatibleModels = hasParams
          ? response.models.filter(isOpenRouterCompatible)
          : response.models;

        setOpenRouterTotal(response.models.length);
        setOpenRouterHasParams(hasParams);
        setOpenRouterCompatible(compatibleModels.length);
        const mapped = mapOpenRouterModels(compatibleModels);
        setOpenRouterModels(mapped);
      })
      .catch((error) => {
        setOpenRouterError(error instanceof Error ? error.message : "Failed to load models");
      })
      .finally(() => {
        setOpenRouterLoading(false);
        setOpenRouterFetched(true);
      });
  }, [open, provider, openRouterFetched, openRouterLoading]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      resetFilters();
      setFocusZone("list");
      setFilterIndex(0);
      setFooterButtonIndex(1);
      setCheckedModelId(currentModel);
      const currentIndex = models.findIndex((m) => m.id === currentModel);
      setSelectedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- resetFilters and models are derived from provider, resetting on provider change is sufficient
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

  const handleUseCustom = () => {
    const customId = searchQuery.trim();
    if (!customId) return;
    onSelect(customId);
    onOpenChange(false);
  };

  const handleCheck = () => {
    const model = filteredModels[selectedIndex];
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
  useKey("Enter", () => setTierFilter(FILTERS[filterIndex]), { enabled: open && focusZone === "filters" });
  useKey(" ", () => setTierFilter(FILTERS[filterIndex]), { enabled: open && focusZone === "filters" });

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

  const emptyLabel =
    provider === OPENROUTER_PROVIDER_ID
      ? openRouterError ?? "No models match your search"
      : "No models match your search";
  const showCompatibilityNote =
    provider === OPENROUTER_PROVIDER_ID &&
    openRouterTotal > 0 &&
    openRouterCompatible < openRouterTotal;
  const compatibilityLabel = showCompatibilityNote
    ? `Showing ${openRouterCompatible}/${openRouterTotal} models that support structured outputs.`
    : openRouterTotal > 0
      ? openRouterHasParams
        ? "Showing models that support structured outputs."
        : "Compatibility unknown; showing all models."
      : "No models available.";

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
            showCustomAction={provider === OPENROUTER_PROVIDER_ID}
            onUseCustom={handleUseCustom}
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
          {provider === OPENROUTER_PROVIDER_ID && (
            <div className="px-4 pb-2 text-[10px] text-gray-500">
              {compatibilityLabel}
              {" "}
              You can enter a custom model ID at your own risk.
            </div>
          )}

          <ModelList
            ref={listContainerRef}
            models={filteredModels}
            selectedIndex={selectedIndex}
            currentModelId={checkedModelId}
            isFocused={focusZone === "list"}
            onSelect={(idx) => {
              setFocusZone("list");
              setSelectedIndex(idx);
              const model = filteredModels[idx];
              if (model) setCheckedModelId(model.id);
            }}
            onConfirm={handleConfirm}
            isLoading={provider === OPENROUTER_PROVIDER_ID && openRouterLoading}
            emptyLabel={emptyLabel}
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
            cancelFocused={focusZone === "footer" && footerButtonIndex === 0}
            confirmFocused={focusZone === "footer" && footerButtonIndex === 1}
            hints={FOOTER_HINTS}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
