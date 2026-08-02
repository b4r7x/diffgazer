import { getDateLabel } from "@diffgazer/core/format";
import { useModelFilter, useModelSource } from "@diffgazer/core/providers";
import type { ClientConfigurationSummary, ExactModelId } from "@diffgazer/core/schemas/config";
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

type SupportedConfigurationSummary = Extract<ClientConfigurationSummary, { status: "supported" }>;

interface ModelSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configuration: SupportedConfigurationSummary;
  currentModel: string | undefined;
  onSelect: (modelId: ExactModelId) => void;
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
  configuration,
  currentModel,
  onSelect,
  isSaving = false,
}: ModelSelectDialogProps) {
  const source = useModelSource(open, configuration);
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
  } = useModelFilter(source.models);

  const discoveryStatus = isSaving ? "passed" : source.status;
  const discoveryReason = source.status === "skipped" ? source.reason : null;
  const discoveryError = source.status === "error" ? source.error : null;
  const loading = source.status === "loading" || source.status === "idle";
  const canSelect = !isSaving && source.status === "passed" && filteredModels.length > 0;
  const emptyLabel =
    discoveryError ??
    discoveryReason ??
    (source.models.length === 0 ? "No models available" : "No models match your search");

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
    models: source.models,
    filteredModels,
    discoveryStatus,
    searchQuery,
    setSearchQuery,
    cycleTierFilter,
    resetFilters,
    searchInputRef,
    listContainerRef,
    onSelect,
    onOpenChange: handleOpenChange,
  });

  const checkedAtLabel = source.checkedAt ? getDateLabel(source.checkedAt) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="overflow-hidden"
        closeOnBackdropClick={!isSaving}
        onEscapeKeyDown={(event) => {
          if (isSaving) event.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle>Select Model</DialogTitle>
              <p className="mt-1 text-2xs text-muted-foreground">
                {configuration.productId}
                {source.models.length > 0
                  ? ` · ${source.models.length} ${source.models.length === 1 ? "model" : "models"}`
                  : ""}
                {checkedAtLabel ? ` · checked ${checkedAtLabel}` : ""}
              </p>
            </div>
            <DialogClose
              {...getCloseButtonProps()}
              size="sm"
              disabled={isSaving}
              className="h-auto shrink-0 px-2 py-1 text-muted-foreground hover:text-foreground"
            />
          </div>
        </DialogHeader>

        <DialogBody className="min-h-0 p-0 flex flex-col overflow-hidden">
          <ModelSearchInput
            ref={searchInputRef}
            value={searchQuery}
            onChange={setSearchQuery}
            onFocus={() => setFocusZone("search")}
            onEscape={handleSearchEscape}
            onArrowDown={handleSearchArrowDown}
            disabled={isSaving || loading}
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
            disabled={isSaving || loading || source.status !== "passed"}
          />

          {(discoveryReason || discoveryError) && !isSaving ? (
            // Not a live region: the empty-state message below announces the same
            // discovery text, and two polite regions read it twice.
            <div className="mx-5 mb-2 flex items-center justify-between gap-3 text-2xs text-warning-text">
              <span>{discoveryReason ?? discoveryError}</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={source.retry}
                disabled={isSaving}
                className="shrink-0"
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
            isFocused={focusZone === "list" && !isSaving && source.status === "passed"}
            onSelect={handleListSelect}
            onConfirm={handleConfirm}
            onHighlightChange={handleListHighlightChange}
            onBoundaryReached={handleListBoundaryReached}
            discoveryStatus={discoveryStatus}
            discoveryReason={discoveryReason}
            discoveryError={discoveryError}
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
            disabled={!canSelect}
            highlighted={
              focusZone === "footer" && footerButtonIndex === 1 && !isSaving && canSelect
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
