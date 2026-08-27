import { usePageFooter } from "@diffgazer/core/footer";
import { getDateLabel } from "@diffgazer/core/format";
import { getRetainedModelNotice } from "@diffgazer/core/providers";
import { useModelFilter, useModelSource } from "@diffgazer/core/providers/hooks";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import type { ClientConfigurationSummary, ExactModelId } from "@diffgazer/core/schemas/config";
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
import { getListWindow } from "../../../lib/list-window";
import { wrappedRowCount } from "../../../lib/terminal-width";
import { useTheme } from "../../../theme/provider";
import { ModelListItem } from "./model-list-item";
import { ModelSearchInput } from "./model-search-input";
import { TierFilterTabs } from "./tier-filter-tabs";

type FocusZone = "search" | "filters" | "retry" | "list";
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
const MODEL_SELECT_RIGHT_SHORTCUTS: Shortcut[] = [{ ...BACK_SHORTCUT, label: "Close" }];
const MIN_MODEL_VIEWPORT_SIZE = 4;
const MODEL_DIALOG_BASE_CHROME_ROWS = 12;

function getModelViewportSize({
  contentRows,
  total,
  conditionalRows,
}: {
  contentRows: number;
  total: number;
  conditionalRows: number;
}): number {
  const availableRows = Math.max(
    MIN_MODEL_VIEWPORT_SIZE,
    contentRows - MODEL_DIALOG_BASE_CHROME_ROWS - conditionalRows,
  );
  return Math.min(total, availableRows);
}

interface ModelListBodyProps {
  loading: boolean;
  sourceError: string | undefined;
  reason: string | null;
  models: ReturnType<typeof useModelSource>["models"];
  filteredModels: ReturnType<typeof useModelFilter>["filteredModels"];
  focusZone: FocusZone;
  safeHighlightIndex: number;
  selectedId: string | undefined;
  contentWidth: number;
  viewportSize: number;
}

function ModelListBody({
  loading,
  sourceError,
  reason,
  models,
  filteredModels,
  focusZone,
  safeHighlightIndex,
  selectedId,
  contentWidth,
  viewportSize,
}: ModelListBodyProps): ReactElement {
  const { tokens } = useTheme();

  if (loading) {
    return <Spinner label="Loading models…" />;
  }
  if (sourceError) {
    return <Text color={tokens.error}>{sanitizeTerminalText(sourceError)}</Text>;
  }
  if (reason) {
    return <Text color={tokens.warning}>{sanitizeTerminalText(reason)}</Text>;
  }
  if (filteredModels.length === 0) {
    return (
      <Text color={tokens.muted}>
        {models.length === 0 ? "No models available" : "No models match your search"}
      </Text>
    );
  }
  const window = getListWindow({
    total: filteredModels.length,
    selectedIndex: safeHighlightIndex,
    viewportRows: viewportSize,
  });
  const visibleModels = filteredModels.slice(window.start, window.end);

  return (
    <Box flexDirection="column" height={viewportSize} flexShrink={0}>
      {window.canScrollUp ? <Text color={tokens.muted}>{"\u25B2"}</Text> : null}
      {visibleModels.map((model, idx) => {
        const absoluteIndex = window.start + idx;
        return (
          <ModelListItem
            key={model.id}
            model={model}
            isHighlighted={focusZone === "list" && absoluteIndex === safeHighlightIndex}
            isSelected={model.id === selectedId}
            maxWidth={contentWidth}
          />
        );
      })}
      {window.canScrollDown ? <Text color={tokens.muted}>{"\u25BC"}</Text> : null}
    </Box>
  );
}

interface ModelSelectOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configuration: ClientConfigurationSummary;
  selectedId?: string;
  onSelect?: (id: ExactModelId) => unknown;
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

  const {
    searchQuery,
    setSearchQuery,
    tierFilter,
    setTierFilter,
    filteredModels,
    cycleTierFilter,
    resetFilters,
  } = useModelFilter(source.models);
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [highlightedModelId, setHighlightedModelId] = useState<string>();
  const [selection, setSelection] = useState<SelectionState>(IDLE_SELECTION);
  const selectionError = selection.status === "error" ? selection.message : null;
  const saving = isSaving || selection.status === "selecting";

  const loading = source.status === "loading" || source.status === "idle";
  const sourceError = source.status === "error" ? source.error : undefined;
  const skippedReason = source.status === "skipped" ? source.reason : null;
  const retryVisible = Boolean(sourceError) || Boolean(skippedReason);
  const zoneChain: FocusZone[] = retryVisible
    ? ["search", "filters", "retry", "list"]
    : ["search", "filters", "list"];
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

  // The overlay stays open and pending until the selection mutation settles;
  // closing first would hide the only place its failure can be reported.
  async function handleSelect(modelId: string) {
    if (saving) return;
    setSelection({ status: "selecting" });
    try {
      await onSelect?.(modelId);
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

  usePageFooter({
    shortcuts: retryVisible
      ? [...MODEL_SELECT_SHORTCUTS, MODEL_SELECT_RETRY_SHORTCUT]
      : MODEL_SELECT_SHORTCUTS,
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
        if (model) void handleSelect(model.id);
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
  const conditionalRows = [
    freshnessLabel ? 1 : 0,
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
            {`${configuration.productId} · ${modelCountLabel}${
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

            <TierFilterTabs
              value={tierFilter}
              onChange={setTierFilter}
              isActive={activeZone === "filters" && !saving}
            />

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

            <ModelListBody
              loading={loading}
              sourceError={sourceError}
              reason={skippedReason}
              models={source.models}
              filteredModels={filteredModels}
              focusZone={activeZone}
              safeHighlightIndex={safeHighlightIndex}
              selectedId={selectedId}
              contentWidth={contentWidth}
              viewportSize={modelViewportSize}
            />
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
