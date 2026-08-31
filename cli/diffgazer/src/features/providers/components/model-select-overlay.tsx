import { usePageFooter } from "@diffgazer/core/footer";
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
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import type {
  ClientConfigurationSummary,
  ExactModelId,
  HostedApiEndpoint,
  ModelInfo,
} from "@diffgazer/core/schemas/config";
import { BACK_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { pluralize } from "@diffgazer/core/strings";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useEffect, useEffectEvent, useState } from "react";
import { useContentZone } from "../../../components/layout/global";
import { Button } from "../../../components/ui/button";
import { Dialog, getDialogWidth } from "../../../components/ui/dialog";
import { Spinner } from "../../../components/ui/spinner";
import { useListNavigation } from "../../../hooks/use-list-navigation";
import { wrappedRowCount } from "../../../lib/terminal-width";
import { useTheme } from "../../../theme/provider";
import { getModelViewportSize } from "../lib/model-viewport";
import { ModelListBody } from "./model-list-body";
import { ModelSearchInput } from "./model-search-input";
import { PoolFilterTabs } from "./pool-filter-tabs";
import { TierFilterTabs } from "./tier-filter-tabs";

type FocusZone = "search" | "pool" | "filters" | "retry" | "list";
type SelectionState =
  | { status: "idle" }
  | { status: "selecting" }
  | { status: "error"; message: string };
const IDLE_SELECTION: SelectionState = { status: "idle" };
const MODEL_SELECT_SHORTCUTS: Shortcut[] = [
  { key: "Tab", label: "Switch Zone" },
  { key: "/", label: "Search" },
  { key: "f", label: "Filter Tier" },
  { key: "Enter", label: "Select" },
];
const MODEL_SELECT_RETRY_SHORTCUT: Shortcut = { key: "r", label: "Retry" };
const MODEL_SELECT_POOL_SHORTCUT: Shortcut = { key: "p", label: "Pool" };
const MODEL_SELECT_RIGHT_SHORTCUTS: Shortcut[] = [{ ...BACK_SHORTCUT, label: "Close" }];
interface ModelSelectOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configuration: ClientConfigurationSummary;
  selectedId?: string;
  /** `endpoint` carries the row's billing pool; omitted when it is the bound one. */
  onSelect?: (id: ExactModelId, endpoint?: HostedApiEndpoint) => unknown;
  isSaving?: boolean;
}

export function ModelSelectOverlay({
  open,
  onOpenChange,
  configuration,
  selectedId,
  onSelect,
  isSaving = false,
}: ModelSelectOverlayProps): ReactElement {
  const { tokens } = useTheme();
  const { columns, contentRows } = useContentZone();
  const source = useModelSource(open, configuration);
  const poolContext = getEndpointPoolContext(configuration.productId, configuration.endpoint);
  const poolProfiles = poolContext ? [poolContext.bound, poolContext.sibling] : [];
  // The active tab is the wallet: it lists the rows its pool serves, and every
  // row it lists bills that pool once confirmed.
  const [selectedPoolId, setSelectedPoolId] = useState<string>();
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
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [highlightedModelId, setHighlightedModelId] = useState<string>();
  const [selection, setSelection] = useState<SelectionState>(IDLE_SELECTION);
  const selectionError = selection.status === "error" ? selection.message : null;
  const saving = isSaving || selection.status === "selecting";

  const loading = source.status === "loading" || source.status === "idle";
  const sourceError = source.status === "error" ? source.error : undefined;
  const skippedReason = source.status === "skipped" ? source.reason : null;
  const retryVisible = Boolean(sourceError) || Boolean(skippedReason);
  const zoneChain: FocusZone[] = [
    "search",
    ...(poolContext ? (["pool"] as const) : []),
    "filters",
    ...(retryVisible ? (["retry"] as const) : []),
    "list",
  ];
  const activeZone = zoneChain.includes(focusZone) ? focusZone : "list";

  const initialHighlightId =
    (selectedId && source.models.some((model) => model.id === selectedId)
      ? selectedId
      : undefined) ?? source.models[0]?.id;
  const activeHighlightId =
    highlightedModelId && source.models.some((model) => model.id === highlightedModelId)
      ? highlightedModelId
      : initialHighlightId;
  const highlightedIndex = filteredModels.findIndex((model) => model.id === activeHighlightId);
  const safeHighlightIndex =
    filteredModels.length === 0 || highlightedIndex < 0 ? 0 : highlightedIndex;

  const modelNavigation = useListNavigation({
    items: filteredModels.map((model) => ({ id: model.id, disabled: false })),
    highlightedId: filteredModels[safeHighlightIndex]?.id ?? null,
    onHighlightChange: setHighlightedModelId,
    wrap: false,
  });

  const resetOnOpen = useEffectEvent(() => {
    resetFilters();
    setSelectedPoolId(undefined);
    setFocusZone("list");
    setHighlightedModelId(undefined);
    setSelection(IDLE_SELECTION);
  });

  const resetOnClose = useEffectEvent(() => {
    setHighlightedModelId(undefined);
    setSelection(IDLE_SELECTION);
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: configuration identity is a reset trigger.
  useEffect(() => {
    if (open) {
      resetOnOpen();
      return;
    }
    resetOnClose();
  }, [open, configuration.configurationId, configuration.revision]);

  function cyclePool() {
    if (!poolContext) return;
    setSelectedPoolId(nextArmedPoolId(poolContext, activePoolTabId));
  }

  // The overlay stays open and pending until the selection mutation settles;
  // closing first would hide the only place its failure can be reported.
  // Membership is the authority: a model only one pool serves bills that pool
  // whatever tab lists it, so the endpoint comes from the confirmed row.
  async function handleSelect(model: ModelInfo) {
    if (saving) return;
    setSelection({ status: "selecting" });
    const endpoint = resolveSelectEndpoint({
      context: poolContext,
      model,
      armedProfileId: activePoolTabId,
      boundEndpoint: configuration.endpoint,
    });
    try {
      await onSelect?.(model.id, endpoint);
      setSelection(IDLE_SELECTION);
      onOpenChange(false);
    } catch (error) {
      setSelection({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to select model",
      });
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  }

  useInput(
    (input, key) => {
      if (key.tab) {
        const idx = zoneChain.indexOf(activeZone);
        setFocusZone(zoneChain[(idx + 1) % zoneChain.length] ?? "list");
        return;
      }

      if (input === "/" && activeZone !== "search") {
        setFocusZone("search");
        return;
      }

      if (input === "f" && activeZone !== "search") {
        cycleTierFilter();
        return;
      }

      if (input === "p" && activeZone !== "search") {
        cyclePool();
      }
    },
    { isActive: open && !saving },
  );

  useInput(
    (_input, key) => {
      const idx = zoneChain.indexOf(activeZone);
      if (key.upArrow) {
        const previous = zoneChain[idx - 1];
        if (previous) setFocusZone(previous);
        return;
      }
      if (key.downArrow) {
        const next = zoneChain[idx + 1];
        if (next && (next !== "list" || filteredModels.length > 0)) setFocusZone(next);
      }
    },
    {
      isActive: open && !saving && (activeZone !== "list" || filteredModels.length === 0),
    },
  );

  useInput(
    (input) => {
      if (input.toLowerCase() === "r") source.retry();
    },
    { isActive: open && !saving && activeZone !== "search" && retryVisible },
  );

  const poolShortcuts = poolContext
    ? MODEL_SELECT_SHORTCUTS.toSpliced(2, 0, MODEL_SELECT_POOL_SHORTCUT)
    : MODEL_SELECT_SHORTCUTS;
  usePageFooter({
    shortcuts: retryVisible ? [...poolShortcuts, MODEL_SELECT_RETRY_SHORTCUT] : poolShortcuts,
    rightShortcuts: MODEL_SELECT_RIGHT_SHORTCUTS,
  });

  // Only the list zone binds j/k, so typing them into the search query is unaffected.
  useInput(
    (input, key) => {
      if (filteredModels.length === 0) return;

      if (key.upArrow || input === "k") {
        if (safeHighlightIndex === 0) {
          const previous = zoneChain[zoneChain.indexOf("list") - 1];
          if (previous) setFocusZone(previous);
          return;
        }
        modelNavigation.moveBy(-1);
        return;
      }
      if (key.downArrow || input === "j") {
        modelNavigation.moveBy(1);
        return;
      }
      if (key.return) {
        const model = filteredModels[safeHighlightIndex];
        if (model) void handleSelect(model);
      }
    },
    { isActive: open && activeZone === "list" && !saving },
  );

  const contentWidth = Math.max(getDialogWidth(columns) - 6, 1);
  // The bundled snapshot's data age is unknowable at runtime, so its tier
  // names the data instead of claiming a checked date.
  const checkedAtLabel = source.checkedAt != null ? getDateLabel(source.checkedAt) : null;
  const freshnessLabel =
    source.source === "snapshot"
      ? "bundled catalog"
      : checkedAtLabel && `checked ${checkedAtLabel}`;
  const retainedModelNotice = saving ? null : getRetainedModelNotice(selectedId, source.models);
  // Every row the active tab lists bills that tab, so the note is tab-level:
  // it states the move once, for as long as the sibling tab is active.
  const poolBillingChangeNote = getPoolBillingChangeNote(poolContext, activePoolTabId);
  // The note comes and goes with the tab, so its rows are reserved for as long
  // as the pool row itself: sizing the viewport from the active tab would
  // re-window the list on an ordinary tab switch.
  const reservedPoolNote = getPoolBillingChangeNote(poolContext, poolContext?.sibling.id);
  const poolNoteRows = reservedPoolNote ? wrappedRowCount(reservedPoolNote, contentWidth) : 0;
  const savedModel = source.models.find((model) => model.id === selectedId);
  const poolHiddenSelectionNotice = getPoolHiddenSelectionNotice(
    poolContext,
    savedModel,
    activePoolTabId,
  );
  const conditionalRows = [
    freshnessLabel ? 1 : 0,
    poolNoteRows,
    poolHiddenSelectionNotice ? wrappedRowCount(poolHiddenSelectionNotice, contentWidth) : 0,
    skippedReason ? wrappedRowCount(skippedReason, contentWidth) : 0,
    retryVisible ? 1 : 0,
    retainedModelNotice ? wrappedRowCount(retainedModelNotice, contentWidth) : 0,
    selectionError ? wrappedRowCount(sanitizeTerminalText(selectionError), contentWidth) : 0,
    saving ? 1 : 0,
  ].reduce((total, rowCount) => total + rowCount, 0);
  const modelViewportSize = getModelViewportSize({
    contentRows,
    total: filteredModels.length,
    conditionalRows,
  });

  const modelCountLabel = pluralize(source.models.length, "model");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Select Model</Dialog.Title>
          <Dialog.Subtitle>
            {`${getProviderShortDisplay(configuration.productId)} · ${modelCountLabel}${
              freshnessLabel ? ` · ${freshnessLabel}` : ""
            }`}
          </Dialog.Subtitle>
        </Dialog.Header>
        <Dialog.Body>
          <Box flexDirection="column" gap={1}>
            <ModelSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              isActive={activeZone === "search" && !saving}
            />

            {/* One row: the terminal floor is 40 columns, so the row clips
                rather than wrapping into the list's rows. */}
            <Box flexDirection="row" flexWrap="nowrap" height={1} overflow="hidden">
              {poolContext && activePoolTabId ? (
                <>
                  <PoolFilterTabs
                    profiles={poolProfiles}
                    value={activePoolTabId}
                    onChange={setSelectedPoolId}
                    isActive={activeZone === "pool" && !saving}
                  />
                  <Text color={tokens.muted} wrap="truncate-end">
                    {" │ "}
                  </Text>
                </>
              ) : null}

              <TierFilterTabs
                value={tierFilter}
                onChange={setTierFilter}
                isActive={activeZone === "filters" && !saving}
              />
            </Box>

            {skippedReason ? <Text color={tokens.warning}>{skippedReason}</Text> : null}
            {retryVisible ? (
              <Button
                variant="secondary"
                isActive={activeZone === "retry" && !saving}
                onPress={source.retry}
              >
                Retry
              </Button>
            ) : null}
            {retainedModelNotice ? (
              // The saved selection is not in the review-capable list. It keeps
              // working, so this states the gap rather than dropping the row.
              <Text color={tokens.muted}>{sanitizeTerminalText(retainedModelNotice)}</Text>
            ) : null}
            {poolHiddenSelectionNotice ? (
              // The saved model is not on the active tab. It keeps working, so
              // this names the tab that lists it rather than hiding the gap.
              <Text color={tokens.muted}>{sanitizeTerminalText(poolHiddenSelectionNotice)}</Text>
            ) : null}

            <ModelListBody
              loading={loading}
              sourceError={sourceError}
              reason={skippedReason}
              models={source.models}
              filteredModels={filteredModels}
              isListFocused={activeZone === "list"}
              safeHighlightIndex={safeHighlightIndex}
              selectedId={selectedId}
              contentWidth={contentWidth}
              viewportSize={modelViewportSize}
            />
            {poolNoteRows > 0 ? (
              // Confirming on this tab changes which wallet drains, so the
              // consequence is stated where the eye already is before Enter.
              // The box keeps its reserved height while the note is absent, so
              // the list below never shifts as the tab switches.
              <Box height={poolNoteRows} flexShrink={0}>
                {poolBillingChangeNote ? (
                  <Text color={tokens.muted}>{poolBillingChangeNote}</Text>
                ) : null}
              </Box>
            ) : null}
            {selectionError ? (
              <Text color={tokens.error}>{sanitizeTerminalText(selectionError)}</Text>
            ) : null}
            {saving ? <Spinner label="Saving…" /> : null}
          </Box>
        </Dialog.Body>
      </Dialog.Content>
    </Dialog>
  );
}
