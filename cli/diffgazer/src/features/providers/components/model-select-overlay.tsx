import { usePageFooter } from "@diffgazer/core/footer";
import { getDateLabel } from "@diffgazer/core/format";
import { useModelFilter, useModelSource } from "@diffgazer/core/providers";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import type { ClientConfigurationSummary, ExactModelId } from "@diffgazer/core/schemas/config";
import { BACK_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { pluralize } from "@diffgazer/core/strings";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useEffect, useEffectEvent, useState } from "react";
import { useContentZone } from "../../../components/layout/global";
import { Dialog, getDialogWidth } from "../../../components/ui/dialog";
import { Spinner } from "../../../components/ui/spinner";
import { useListNavigation } from "../../../hooks/use-list-navigation";
import { getListWindow } from "../../../lib/list-window";
import { wrappedRowCount } from "../../../lib/terminal-width";
import { useTheme } from "../../../theme/provider";
import { ModelListItem } from "./model-list-item";
import { ModelSearchInput } from "./model-search-input";
import { TierFilterTabs } from "./tier-filter-tabs";

type FocusZone = "search" | "filters" | "list";
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
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const saving = isSaving || isSelecting;

  const loading = source.status === "loading" || source.status === "idle";
  const sourceError = source.status === "error" ? source.error : undefined;
  const skippedReason = source.status === "skipped" ? source.reason : null;

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
    wrap: true,
  });

  const resetOnOpen = useEffectEvent(() => {
    resetFilters();
    setFocusZone("list");
    setHighlightedModelId(undefined);
    setSelectionError(null);
  });

  const resetOnClose = useEffectEvent(() => {
    setHighlightedModelId(undefined);
    setSelectionError(null);
    setIsSelecting(false);
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
    setSelectionError(null);
    setIsSelecting(true);
    try {
      await onSelect?.(modelId as ExactModelId);
      onOpenChange(false);
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : "Failed to select model");
    } finally {
      setIsSelecting(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  }

  function handleEscapeKeyDown(): boolean {
    if (focusZone !== "search" || searchQuery.length === 0) return false;
    setSearchQuery("");
    return true;
  }

  useInput(
    (input, key) => {
      if (key.tab) {
        setFocusZone((prev) => {
          const zones: FocusZone[] = ["search", "filters", "list"];
          const idx = zones.indexOf(prev);
          return zones[(idx + 1) % zones.length] ?? "list";
        });
        return;
      }

      if (input === "/" && focusZone !== "search") {
        setFocusZone("search");
        return;
      }

      if (input === "f" && focusZone !== "search") {
        cycleTierFilter();
      }
    },
    { isActive: open && !saving },
  );

  useInput(
    (input) => {
      if (input.toLowerCase() === "r") source.retry();
    },
    {
      isActive:
        open &&
        !saving &&
        focusZone !== "search" &&
        (Boolean(sourceError) || Boolean(skippedReason)),
    },
  );

  usePageFooter({
    shortcuts:
      sourceError || skippedReason
        ? [...MODEL_SELECT_SHORTCUTS, MODEL_SELECT_RETRY_SHORTCUT]
        : MODEL_SELECT_SHORTCUTS,
    rightShortcuts: MODEL_SELECT_RIGHT_SHORTCUTS,
  });

  // Only the list zone binds j/k, so typing them into the search query is unaffected.
  useInput(
    (input, key) => {
      if (filteredModels.length === 0) return;

      if (key.upArrow || input === "k") {
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
    { isActive: open && focusZone === "list" && !saving },
  );

  const contentWidth = Math.max(getDialogWidth(columns) - 6, 1);
  const checkedAtLabel = source.checkedAt != null ? getDateLabel(source.checkedAt) : null;
  const conditionalRows = [
    checkedAtLabel ? 1 : 0,
    skippedReason ? wrappedRowCount(`${skippedReason} Press r to retry.`, contentWidth) : 0,
    sourceError ? 1 : 0,
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
    <Dialog open={open} onOpenChange={handleOpenChange} onEscapeKeyDown={handleEscapeKeyDown}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Select Model</Dialog.Title>
          <Dialog.Subtitle>
            {`${configuration.productId} · ${modelCountLabel}${
              checkedAtLabel ? ` · checked ${checkedAtLabel}` : ""
            }`}
          </Dialog.Subtitle>
        </Dialog.Header>
        <Dialog.Body>
          <Box flexDirection="column" gap={1}>
            <ModelSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              isActive={focusZone === "search" && !saving}
            />

            <TierFilterTabs
              value={tierFilter}
              onChange={setTierFilter}
              isActive={focusZone === "filters" && !saving}
            />

            {skippedReason ? (
              <Text color={tokens.warning}>{skippedReason} Press r to retry.</Text>
            ) : null}
            {sourceError ? <Text color={tokens.muted}>Press r to retry.</Text> : null}

            <ModelListBody
              loading={loading}
              sourceError={sourceError}
              reason={skippedReason}
              models={source.models}
              filteredModels={filteredModels}
              focusZone={focusZone}
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
