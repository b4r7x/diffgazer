import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
  DialogAction,
  type KeyboardHint,
} from "@diffgazer/ui/components/dialog";
import { type AIProvider } from "@diffgazer/core/schemas/config";
import { OPENROUTER_PROVIDER_ID } from "@diffgazer/core/schemas/config";
import { getStaticModelsForProvider } from "@diffgazer/core/providers";
import { useModelFilter } from "../../hooks/use-model-filter";
import { useOpenRouterModelsMapped } from "@diffgazer/core/providers";
import { useModelDialogKeyboard } from "../../hooks/use-model-dialog-keyboard";
import { ModelSearchInput } from "./model-search-input";
import { ModelFilterTabs } from "./model-filter-tabs";
import { ModelList } from "./model-list";

interface ModelSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: AIProvider;
  currentModel: string | undefined;
  onSelect: (modelId: string) => void;
}

const FOOTER_HINTS: KeyboardHint[] = [
  { key: "↑/↓", label: "Navigate" },
  { key: "j/k", label: "Navigate" },
  { key: "/", label: "Search" },
  { key: "f", label: "Filter" },
];

function getCompatibilityLabel({
  total,
  compatible,
  hasParams,
}: {
  total: number;
  compatible: number;
  hasParams: boolean;
}) {
  if (total === 0) return "No models available.";
  if (compatible < total) {
    return `Showing ${compatible}/${total} models that support structured outputs.`;
  }
  if (hasParams) return "Showing models that support structured outputs.";
  return "Compatibility unknown; showing all models.";
}

export function ModelSelectDialog({
  open,
  onOpenChange,
  provider,
  currentModel,
  onSelect,
}: ModelSelectDialogProps) {
  const openRouter = useOpenRouterModelsMapped(open, provider);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const models =
    provider === OPENROUTER_PROVIDER_ID
      ? openRouter.models
      : getStaticModelsForProvider(provider);

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
    focusedModelId,
    checkedModelId,
    filterIndex,
    setFilterIndex,
    setFocusZone,
    handleConfirm,
    handleUseCustom,
    handleFilterKeyDown,
    handleSearchEscape,
    handleSearchArrowDown,
    handleListHighlightChange,
    handleListBoundaryReached,
    handleListSelect,
    footerButtonIndex,
    getCloseButtonProps,
    getFooterButtonProps,
    getFilterButtonProps,
  } = useModelDialogKeyboard({
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
  });

  const emptyLabel =
    provider === OPENROUTER_PROVIDER_ID
      ? openRouter.error ?? "No models match your search"
      : "No models match your search";
  const compatibilityLabel = getCompatibilityLabel(openRouter);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden border border-tui-border shadow-2xl">
        <DialogHeader marker="none" className="flex-row items-center justify-between gap-3 bg-tui-selection/50 px-4 py-3">
          <DialogTitle className="min-w-0 flex-1 w-auto text-tui-blue tracking-wide">Select Model</DialogTitle>
          <DialogClose
            {...getCloseButtonProps()}
            size="sm"
            className="h-auto shrink-0 px-2 py-1 text-tui-muted hover:text-tui-fg font-bold"
          />
        </DialogHeader>

        <DialogBody className="min-h-0 p-0 flex flex-col overflow-hidden">
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
            onChange={setTierFilter}
            focusedIndex={filterIndex}
            isFocused={focusZone === "filters"}
            onKeyDown={handleFilterKeyDown}
            getTabProps={getFilterButtonProps}
            onTabClick={(idx) => {
              setFocusZone("filters");
              setFilterIndex(idx);
            }}
          />
          {provider === OPENROUTER_PROVIDER_ID && (
            <div className="px-4 pb-2 text-2xs text-tui-muted">
              {compatibilityLabel}
              {" "}
              You can enter a custom model ID at your own risk.
            </div>
          )}

          <ModelList
            ref={listContainerRef}
            models={filteredModels}
            focusedModelId={focusedModelId}
            currentModelId={checkedModelId}
            isFocused={focusZone === "list"}
            onSelect={handleListSelect}
            onConfirm={handleConfirm}
            onHighlightChange={handleListHighlightChange}
            onBoundaryReached={handleListBoundaryReached}
            isLoading={provider === OPENROUTER_PROVIDER_ID && openRouter.loading}
            emptyLabel={emptyLabel}
          />
        </DialogBody>

        <DialogFooter hints={FOOTER_HINTS}>
          <DialogClose
            {...getFooterButtonProps(0)}
            variant="ghost"
            size="sm"
            bracket
            highlighted={focusZone === "footer" && footerButtonIndex === 0}
          >
            Cancel
          </DialogClose>
          <DialogAction
            {...getFooterButtonProps(1)}
            variant="primary"
            size="sm"
            bracket
            disabled={filteredModels.length === 0}
            highlighted={focusZone === "footer" && footerButtonIndex === 1 && filteredModels.length > 0}
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
          >
            Confirm
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
