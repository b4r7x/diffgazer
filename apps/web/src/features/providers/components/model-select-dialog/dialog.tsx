import {
  getCompatibilityLabel,
  useModelFilter,
  useOpenRouterModelsMapped,
  useProviderModelsMapped,
} from "@diffgazer/core/providers";
import { type AIProvider, OPENROUTER_PROVIDER_ID } from "@diffgazer/core/schemas/config";
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type KeyboardHint,
} from "@diffgazer/ui/components/dialog";
import { useRef } from "react";
import { ModelFilterTabs } from "./filter-tabs";
import { ModelList } from "./list";
import { ModelSearchInput } from "./search-input";
import { useModelDialogKeyboard } from "./use-dialog-keyboard";

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

export function ModelSelectDialog({
  open,
  onOpenChange,
  provider,
  currentModel,
  onSelect,
}: ModelSelectDialogProps) {
  const openRouter = useOpenRouterModelsMapped(open, provider);
  const catalog = useProviderModelsMapped(open, provider);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const isOpenRouter = provider === OPENROUTER_PROVIDER_ID;
  const models = isOpenRouter ? openRouter.models : catalog.models;

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

  const catalogError = isOpenRouter ? openRouter.error : catalog.error;
  const emptyLabel = catalogError ?? "No models match your search";
  const isLoading = isOpenRouter ? openRouter.loading : catalog.loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden border border-tui-border shadow-2xl">
        <DialogHeader
          marker="none"
          className="flex-row items-center justify-between gap-3 bg-tui-selection/50 px-4 py-3"
        >
          <DialogTitle className="min-w-0 flex-1 w-auto text-tui-blue tracking-wide">
            Select Model
          </DialogTitle>
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
            showCustomAction={isOpenRouter}
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
          {isOpenRouter && (
            <div className="px-4 pb-2 text-2xs text-tui-muted">
              {getCompatibilityLabel(openRouter)} You can enter a custom model ID at your own risk.
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
            isLoading={isLoading}
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
            highlighted={
              focusZone === "footer" && footerButtonIndex === 1 && filteredModels.length > 0
            }
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
