import { getCompatibilityLabel, useModelFilter, useModelSource } from "@diffgazer/core/providers";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { Button } from "@diffgazer/ui/components/button";
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
  isSaving?: boolean;
}

const FOOTER_HINTS: KeyboardHint[] = [
  NAVIGATE_SHORTCUT,
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
  isSaving = false,
}: ModelSelectDialogProps) {
  const { models, loading, error, isOpenRouter, openRouter, source, fetchedAt, retry } =
    useModelSource(open, provider);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isSaving) return;
    onOpenChange(nextOpen);
  };

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
    isSaving,
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
    onOpenChange: handleOpenChange,
  });

  const emptyLabel = error ?? "No models match your search";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl overflow-hidden border border-border shadow-2xl"
        closeOnBackdropClick={!isSaving}
        onEscapeKeyDown={(event) => {
          if (isSaving) event.preventDefault();
        }}
      >
        <DialogHeader
          marker="none"
          className="flex-row items-center justify-between gap-3 bg-secondary/50 px-4 py-3"
        >
          <DialogTitle className="min-w-0 flex-1 w-auto text-info-text tracking-wide">
            Select Model
          </DialogTitle>
          <DialogClose
            {...getCloseButtonProps()}
            size="sm"
            disabled={isSaving}
            className="h-auto shrink-0 px-2 py-1 text-muted-foreground hover:text-foreground font-bold"
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
            disabled={isSaving}
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
          {isOpenRouter && !loading && !error && (
            <div className="px-4 pb-2 text-2xs text-muted-foreground">
              {getCompatibilityLabel(openRouter)}
            </div>
          )}
          {(source === "cache" || source === "snapshot") && (
            <output className="mx-4 mb-2 flex items-center justify-between gap-3 text-2xs text-warning-text">
              <span>
                {source === "cache"
                  ? `Using cached catalog data from ${fetchedAt ?? "an unknown time"}.`
                  : "Using the bundled model catalog because live catalog data is unavailable."}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={retry}
                disabled={isSaving}
              >
                Retry
              </Button>
            </output>
          )}
          {error ? (
            <div className="mx-4 mb-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={retry}
                disabled={isSaving}
              >
                Retry
              </Button>
            </div>
          ) : null}

          <ModelList
            ref={listContainerRef}
            models={filteredModels}
            focusedModelId={focusedModelId}
            currentModelId={checkedModelId}
            isFocused={focusZone === "list" && !isSaving}
            onSelect={handleListSelect}
            onConfirm={handleConfirm}
            onHighlightChange={handleListHighlightChange}
            onBoundaryReached={handleListBoundaryReached}
            isLoading={loading}
            isSaving={isSaving}
            emptyLabel={emptyLabel}
          />
        </DialogBody>

        <DialogFooter hints={FOOTER_HINTS} className="pointer-coarse:[&>div:first-child]:hidden">
          <DialogClose
            {...getFooterButtonProps(0)}
            variant="ghost"
            size="sm"
            bracket
            disabled={isSaving}
            highlighted={focusZone === "footer" && footerButtonIndex === 0 && !isSaving}
          >
            Cancel
          </DialogClose>
          <DialogAction
            {...getFooterButtonProps(1)}
            variant="primary"
            size="sm"
            bracket
            disabled={isSaving || filteredModels.length === 0}
            highlighted={
              focusZone === "footer" &&
              footerButtonIndex === 1 &&
              !isSaving &&
              filteredModels.length > 0
            }
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
          >
            {isSaving ? "Saving..." : "Confirm"}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
