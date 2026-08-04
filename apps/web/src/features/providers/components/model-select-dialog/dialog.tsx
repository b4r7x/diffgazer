import { getDateLabel } from "@diffgazer/core/format";
import { useModelFilter, useModelSource } from "@diffgazer/core/providers";
import type { ClientConfigurationSummary, ExactModelId } from "@diffgazer/core/schemas/config";
import { pluralize } from "@diffgazer/core/strings";
import { Button } from "@diffgazer/ui/components/button";
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogClose,
  DialogCloseIcon,
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
  configuration: ClientConfigurationSummary;
  currentModel: string | undefined;
  onSelect: (modelId: ExactModelId) => void;
  isSaving?: boolean;
}

// The legend teaches the list keys only, so it shares one footer row with the
// actions; Enter/Esc are already taught by the visible [Confirm]/[Cancel]
// buttons. OverlayHints owns the coarse-pointer collapse, so nothing here
// hides the bar on touch.
const FOOTER_HINTS: KeyboardHint[] = [
  { key: "↑/↓ j/k", label: "Navigate" },
  { key: "/", label: "Search" },
  { key: "f", label: "Filter" },
  { key: "Space", label: "Select" },
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
  const discoveryMessage = source.status === "skipped" ? source.reason : source.error;
  const loading = source.status === "loading" || source.status === "idle";
  const canSelect = !isSaving && source.status === "passed" && filteredModels.length > 0;
  // Generic copy only: the discovery message has exactly one home, the strip below.
  const emptyLabel =
    source.models.length === 0 ? "No models available" : "No models match your search";

  const {
    focusZone,
    focusedModelId,
    checkedModelId,
    filterIndex,
    handleConfirm,
    handleFilterKeyDown,
    handleSearchFocus,
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
        // The dialog's zone navigation owns the [x], so it is composed below
        // instead of being rendered by DialogContent's default.
        closeIcon={false}
        closeOnBackdropClick={!isSaving}
        onEscapeKeyDown={(event) => {
          if (isSaving) event.preventDefault();
        }}
      >
        {/* pr-10 keeps the subtitle clear of the [x], which absolute-positions
            itself over the strip's inline end. */}
        <DialogHeader className="pr-10">
          <DialogTitle className="shrink-0">Select Model</DialogTitle>
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            {configuration.productId}
            {source.models.length > 0 ? ` · ${pluralize(source.models.length, "model")}` : ""}
            {checkedAtLabel ? ` · checked ${checkedAtLabel}` : ""}
          </p>
        </DialogHeader>

        <DialogBody className="min-h-0 p-0 flex flex-col overflow-hidden">
          <ModelSearchInput
            ref={searchInputRef}
            value={searchQuery}
            onChange={setSearchQuery}
            onFocus={handleSearchFocus}
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
            disabled={isSaving || loading || source.status !== "passed"}
          />

          {discoveryMessage && !isSaving ? (
            // The single discovery surface: the list's empty state carries generic
            // copy only, so this row is the one place the reason is shown and the
            // one region that announces it.
            // biome-ignore lint/a11y/useSemanticElements: role="status" is the alert row's live region; <output> carries form-association semantics that do not fit a message paired with a Retry control.
            <div
              role="status"
              className="mx-5 mb-2 flex items-center justify-between gap-3 border border-warning-border px-3 py-2 text-2xs text-warning-text"
            >
              <span>{discoveryMessage}</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={source.retry}
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
            loading={loading}
            isSaving={isSaving}
            emptyLabel={emptyLabel}
          />
        </DialogBody>

        <DialogFooter hints={FOOTER_HINTS}>
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

        {/* Last in DOM so the [x] is the final tab stop, per DialogCloseIcon. */}
        <DialogCloseIcon {...getCloseButtonProps()} disabled={isSaving} />
      </DialogContent>
    </Dialog>
  );
}
