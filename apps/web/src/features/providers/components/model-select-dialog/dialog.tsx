import { getDateLabel } from "@diffgazer/core/format";
import {
  filterModelsByPool,
  getEndpointPoolContext,
  getPoolBillingChangeNote,
  getPoolHiddenSelectionNotice,
  getProviderShortDisplay,
  getRetainedModelNotice,
  nextArmedPoolId,
  resolveSelectEndpoint,
} from "@diffgazer/core/providers";
import { useModelFilter, useModelSource } from "@diffgazer/core/providers/hooks";
import type {
  ClientConfigurationSummary,
  ExactModelId,
  HostedApiEndpoint,
} from "@diffgazer/core/schemas/config";
import { pluralize } from "@diffgazer/core/strings";
import { useKey } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
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
import { useRef, useState } from "react";
import { ModelFilterTabs } from "./filter-tabs";
import { ModelList } from "./list";
import { ModelPoolFilterTabs } from "./pool-filter-tabs";
import { ModelSearchInput } from "./search-input";
import { useModelDialogKeyboard } from "./use-dialog-keyboard";

interface ModelSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configuration: ClientConfigurationSummary;
  currentModel: string | undefined;
  /** `endpoint` carries the row's billing pool; omitted when it is the bound one. */
  onSelect: (modelId: ExactModelId, endpoint?: HostedApiEndpoint) => void;
  isSaving?: boolean;
}

// The legend teaches the list keys only, so it shares one footer row with the
// actions; Enter/Esc are already taught by the visible [Confirm]/[Cancel]
// buttons, and r by the visible [Retry] button in the discovery strip (which
// carries aria-keyshortcuts). OverlayHints owns the coarse-pointer collapse,
// so nothing here hides the bar on touch.
const FOOTER_HINTS: KeyboardHint[] = [
  { key: "↑/↓", label: "Navigate" },
  { key: "/", label: "Search" },
  { key: "f", label: "Filter" },
  { key: "Space", label: "Select" },
];
// Taught only where it does something: the pool group renders on dual-pool
// products alone.
const POOL_FOOTER_HINT: KeyboardHint = { key: "p", label: "Pool" };

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

  // The endpoint profiles of a product whose endpoints are billing pools; null
  // everywhere else, which is what hides the pool group.
  const poolContext = getEndpointPoolContext(configuration.productId, configuration.endpoint);
  const poolProfiles = poolContext ? [poolContext.bound, poolContext.sibling] : [];
  // The active tab is the wallet: it lists the rows its pool serves, and every
  // row it lists bills that pool when the confirm posts.
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const activePoolTabId = selectedPoolId ?? poolContext?.bound.id;

  const {
    searchQuery,
    setSearchQuery,
    tierFilter,
    setTierFilter,
    filteredModels,
    cycleTierFilter,
    resetFilters,
  } = useModelFilter(filterModelsByPool(source.models, poolContext, activePoolTabId));

  const discoveryStatus = isSaving ? "passed" : source.status;
  const discoveryMessage = source.status === "skipped" ? source.reason : source.error;
  const loading = source.status === "loading" || source.status === "idle";
  const canSelect = !isSaving && source.status === "passed" && filteredModels.length > 0;
  // Generic copy only: the discovery message has exactly one home, the strip below.
  const emptyLabel =
    source.models.length === 0 ? "No models available" : "No models match the current filters.";

  const showRetry = Boolean(discoveryMessage) && !isSaving;

  const cyclePool = () => {
    if (!poolContext) return;
    setSelectedPoolId(nextArmedPoolId(poolContext, activePoolTabId));
  };

  const handleSelectModel = (modelId: string) => {
    const model = source.models.find((candidate) => candidate.id === modelId);
    const endpoint = model
      ? resolveSelectEndpoint({
          context: poolContext,
          model,
          armedProfileId: activePoolTabId,
          boundEndpoint: configuration.endpoint,
        })
      : undefined;
    onSelect(modelId, endpoint);
  };

  const {
    focusZone,
    focusedModelId,
    checkedModelId,
    headerIndex,
    handleConfirm,
    handleHeaderKeyDown,
    handleSearchFocus,
    handleSearchArrowDown,
    handleListHighlightChange,
    handleListBoundaryReached,
    handleListSelect,
    footerButtonIndex,
    getCloseButtonProps,
    getFooterButtonProps,
    getFilterButtonProps,
    getPoolButtonProps,
    getRetryButtonProps,
  } = useModelDialogKeyboard({
    open,
    isSaving,
    currentModel,
    models: source.models,
    filteredModels,
    discoveryStatus,
    retryVisible: showRetry,
    pool: {
      count: poolProfiles.length,
      cycle: cyclePool,
      reset: () => setSelectedPoolId(null),
    },
    cycleTierFilter,
    resetFilters,
    searchInputRef,
    listContainerRef,
    onSelect: handleSelectModel,
    onOpenChange: handleOpenChange,
  });

  // The TUI answers r with a fresh discovery run; the search box keeps the
  // letter for typing, so the binding stands down there like f does.
  useKey("r", source.retry, { enabled: open && showRetry && focusZone !== "search" });

  // The bundled snapshot's data age is unknowable at runtime, so its tier
  // names the data instead of claiming a checked date.
  const checkedAtLabel = source.checkedAt ? getDateLabel(source.checkedAt) : null;
  const freshnessLabel =
    source.source === "snapshot"
      ? "bundled catalog"
      : checkedAtLabel && `checked ${checkedAtLabel}`;
  const retainedModelNotice = isSaving ? null : getRetainedModelNotice(currentModel, source.models);
  // Every row the active tab lists bills that tab, so the tab alone decides
  // whether a confirm moves the wallet — no save can move it without this note.
  const poolBillingChangeNote = getPoolBillingChangeNote(poolContext, activePoolTabId);
  // The checked row is looked up unfiltered: the check survives a tab switch
  // that hides it, and this names the tab that lists it again.
  const poolHiddenSelectionNotice = getPoolHiddenSelectionNotice(
    poolContext,
    source.models.find((model) => model.id === checkedModelId),
    activePoolTabId,
  );
  const footerHints = poolContext ? FOOTER_HINTS.toSpliced(2, 0, POOL_FOOTER_HINT) : FOOTER_HINTS;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        height="stable"
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
            {/* No endpoint argument: the pool tabs below name the wallet, so
                the subtitle would only say it twice. */}
            {getProviderShortDisplay(configuration.productId)}
            {source.models.length > 0 ? ` · ${pluralize(source.models.length, "model")}` : ""}
            {freshnessLabel ? ` · ${freshnessLabel}` : ""}
          </p>
        </DialogHeader>

        <DialogBody className="min-h-0 p-0 flex flex-col overflow-hidden">
          <ModelSearchInput
            ref={searchInputRef}
            value={searchQuery}
            onChange={setSearchQuery}
            onFocus={handleSearchFocus}
            onArrowDown={handleSearchArrowDown}
            disabled={isSaving || loading}
          />

          {/* One row, two controls: the divider and the wider gap keep the pool
              tabs from reading as more segments of the tier filter. */}
          <div
            role="toolbar"
            aria-label="Model filters"
            className="flex items-center gap-3 px-5 pb-2"
          >
            {poolContext && activePoolTabId ? (
              <>
                <ModelPoolFilterTabs
                  profiles={poolProfiles}
                  value={activePoolTabId}
                  onChange={setSelectedPoolId}
                  focusedIndex={headerIndex}
                  isFocused={focusZone === "filters"}
                  onKeyDown={handleHeaderKeyDown}
                  getTabProps={getPoolButtonProps}
                  disabled={isSaving || source.status !== "passed"}
                />
                <div aria-hidden className="h-4 w-px bg-border" />
              </>
            ) : null}

            <ModelFilterTabs
              value={tierFilter}
              onChange={setTierFilter}
              focusedIndex={headerIndex - poolProfiles.length}
              isFocused={focusZone === "filters"}
              onKeyDown={handleHeaderKeyDown}
              getTabProps={getFilterButtonProps}
              disabled={isSaving || source.status !== "passed"}
            />
          </div>

          {discoveryMessage && !isSaving ? (
            // The single discovery surface: the list's empty state carries generic
            // copy only, so this row is the one place the reason is shown and the
            // one region that announces it (Callout `live`). py-2 and text-2xs hold
            // the strip to this dialog's dense band instead of the Callout's
            // page-band defaults; the root font-size is its one sizing knob.
            <Callout tone="warning" live className="mx-5 mb-2 py-2 text-2xs">
              <Callout.Content className="flex items-center justify-between gap-3">
                <span>{discoveryMessage}</span>
                <Button
                  {...getRetryButtonProps()}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={source.retry}
                  aria-keyshortcuts="r"
                  className="shrink-0"
                >
                  Retry
                </Button>
              </Callout.Content>
            </Callout>
          ) : null}

          {retainedModelNotice ? (
            // The saved selection is not in the review-capable list. It keeps
            // working, so this states the gap rather than dropping the row.
            <Callout tone="info" className="mx-5 mb-2 py-2 text-2xs">
              <Callout.Content>{retainedModelNotice}</Callout.Content>
            </Callout>
          ) : null}

          {poolHiddenSelectionNotice ? (
            // The checked row is not on this tab. It keeps its check for the
            // tab that serves it, so this names that tab rather than dropping it.
            <Callout tone="info" className="mx-5 mb-2 py-2 text-2xs">
              <Callout.Content>{poolHiddenSelectionNotice}</Callout.Content>
            </Callout>
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

          {poolBillingChangeNote ? (
            // The sibling tab bills the other wallet, so the consequence is
            // stated where the eye already is before Confirm.
            <p className="mx-5 mb-2 text-2xs text-muted-foreground">{poolBillingChangeNote}</p>
          ) : null}
        </DialogBody>

        <DialogFooter hints={footerHints}>
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
