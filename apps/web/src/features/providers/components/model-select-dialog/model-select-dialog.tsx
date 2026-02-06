import { useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  GEMINI_MODEL_INFO,
  GLM_MODEL_INFO,
  type AIProvider,
} from "@stargazer/schemas/config";
import { OPENROUTER_PROVIDER_ID } from "@/config/constants";
import { useModelFilter } from "../../hooks/use-model-filter";
import { useOpenRouterModels } from "../../hooks/use-openrouter-models";
import { useModelDialogKeyboard } from "../../hooks/use-model-dialog-keyboard";
import { ModelSearchInput } from "./model-search-input";
import { ModelFilterTabs } from "./model-filter-tabs";
import { ModelList } from "./model-list";
import { DialogFooterActions } from "./dialog-footer-actions";

interface ModelSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: AIProvider;
  currentModel: string | undefined;
  onSelect: (modelId: string) => void;
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
  const openRouter = useOpenRouterModels(open, provider);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const models = useMemo(() => {
    switch (provider) {
      case "gemini":
        return Object.values(GEMINI_MODEL_INFO);
      case "zai":
      case "zai-coding":
        return Object.values(GLM_MODEL_INFO);
      case OPENROUTER_PROVIDER_ID:
        return openRouter.models;
      default:
        return [];
    }
  }, [provider, openRouter.models]);

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
    selectedIndex,
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
  } = useModelDialogKeyboard({
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
  });

  const emptyLabel =
    provider === OPENROUTER_PROVIDER_ID
      ? openRouter.error ?? "No models match your search"
      : "No models match your search";
  const showCompatibilityNote =
    provider === OPENROUTER_PROVIDER_ID &&
    openRouter.total > 0 &&
    openRouter.compatible < openRouter.total;
  const compatibilityLabel = showCompatibilityNote
    ? `Showing ${openRouter.compatible}/${openRouter.total} models that support structured outputs.`
    : openRouter.total > 0
      ? openRouter.hasParams
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
            isLoading={provider === OPENROUTER_PROVIDER_ID && openRouter.loading}
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
