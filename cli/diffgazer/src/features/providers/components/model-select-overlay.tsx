import { useActivateProvider } from "@diffgazer/core/api/hooks";
import { getCompatibilityLabel, useModelFilter, useModelSource } from "@diffgazer/core/providers";
import type { AIProvider, ModelInfo } from "@diffgazer/core/schemas/config";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { useEffect, useEffectEvent, useState } from "react";
import { Dialog } from "../../../components/ui/dialog";
import { Spinner } from "../../../components/ui/spinner";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import type { CliColorTokens } from "../../../theme/palettes";
import { useTheme } from "../../../theme/provider";
import { ModelListItem } from "./model-list-item";
import { SearchInput } from "./model-search-input";
import { TierFilterTabs } from "./tier-filter-tabs";

type FocusZone = "search" | "filters" | "list";
const MIN_MODEL_VIEWPORT_SIZE = 4;
const MODEL_DIALOG_RESERVED_ROWS = 14;

function getModelViewportSize(rows: number, total: number): number {
  const availableRows = Math.max(MIN_MODEL_VIEWPORT_SIZE, rows - MODEL_DIALOG_RESERVED_ROWS);
  return Math.min(total, availableRows);
}

function getCenteredModelWindow({
  total,
  highlightedIndex,
  visibleCount,
}: {
  total: number;
  highlightedIndex: number;
  visibleCount: number;
}): { start: number; end: number } {
  if (total <= visibleCount) return { start: 0, end: total };

  const halfViewport = Math.floor(visibleCount / 2);
  const maxStart = total - visibleCount;
  const start = Math.min(Math.max(highlightedIndex - halfViewport, 0), maxStart);
  return { start, end: start + visibleCount };
}

function getVisibleModelWindow({
  total,
  highlightedIndex,
  viewportSize,
}: {
  total: number;
  highlightedIndex: number;
  viewportSize: number;
}): { start: number; end: number; canScrollUp: boolean; canScrollDown: boolean } {
  let visibleCount = Math.min(total, viewportSize);
  let window = getCenteredModelWindow({ total, highlightedIndex, visibleCount });
  let canScrollUp = window.start > 0;
  let canScrollDown = window.end < total;

  for (let i = 0; i < 2; i += 1) {
    const indicatorRows = Number(canScrollUp) + Number(canScrollDown);
    const nextVisibleCount = Math.max(1, Math.min(total, viewportSize - indicatorRows));
    if (nextVisibleCount === visibleCount) break;

    visibleCount = nextVisibleCount;
    window = getCenteredModelWindow({ total, highlightedIndex, visibleCount });
    canScrollUp = window.start > 0;
    canScrollDown = window.end < total;
  }

  return { ...window, canScrollUp, canScrollDown };
}

function renderModelListBody({
  loading,
  sourceError,
  models,
  filteredModels,
  focusZone,
  safeHighlightIndex,
  selectedId,
  contentWidth,
  viewportSize,
  tokens,
}: {
  loading: boolean;
  sourceError: string | undefined;
  models: ModelInfo[];
  filteredModels: ModelInfo[];
  focusZone: FocusZone;
  safeHighlightIndex: number;
  selectedId: string | undefined;
  contentWidth: number;
  viewportSize: number;
  tokens: CliColorTokens;
}): ReactElement {
  if (loading) {
    return <Spinner label="Loading models…" />;
  }
  if (sourceError) {
    return <Text color={tokens.error}>{sourceError}</Text>;
  }
  if (filteredModels.length === 0) {
    return (
      <Text dimColor>
        {models.length === 0 ? "No models available" : "No models match your search"}
      </Text>
    );
  }
  const window = getVisibleModelWindow({
    total: filteredModels.length,
    highlightedIndex: safeHighlightIndex,
    viewportSize,
  });
  const visibleModels = filteredModels.slice(window.start, window.end);

  return (
    <Box flexDirection="column">
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
  providerId: AIProvider;
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function ModelSelectOverlay({
  open,
  onOpenChange,
  providerId,
  selectedId,
  onSelect,
}: ModelSelectOverlayProps): ReactElement {
  const { tokens } = useTheme();
  const { columns, rows } = useTerminalDimensions();
  const {
    models,
    loading,
    error: sourceError,
    isOpenRouter,
    openRouter,
    source,
    fetchedAt,
    retry,
  } = useModelSource(open, providerId);
  const activateProvider = useActivateProvider();

  const saving = activateProvider.isPending;
  const activationError = activateProvider.error?.message;

  const {
    searchQuery,
    setSearchQuery,
    tierFilter,
    setTierFilter,
    filteredModels,
    cycleTierFilter,
    resetFilters,
  } = useModelFilter(models);
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [highlightedModelId, setHighlightedModelId] = useState<string>();

  const initialHighlightId =
    (selectedId && models.some((model) => model.id === selectedId) ? selectedId : undefined) ??
    models[0]?.id;
  const activeHighlightId =
    highlightedModelId && models.some((model) => model.id === highlightedModelId)
      ? highlightedModelId
      : initialHighlightId;
  const highlightedIndex = filteredModels.findIndex((model) => model.id === activeHighlightId);

  const safeHighlightIndex =
    filteredModels.length === 0 || highlightedIndex < 0 ? 0 : highlightedIndex;

  const resetOnOpen = useEffectEvent(() => {
    resetFilters();
    setFocusZone("list");
    setHighlightedModelId(undefined);
    activateProvider.reset();
  });

  const resetOnClose = useEffectEvent(() => {
    setHighlightedModelId(undefined);
    activateProvider.reset();
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: providerId is a reset trigger; useEffectEvent keeps reset callbacks current without depending on unstable filter helpers.
  useEffect(() => {
    if (open) {
      resetOnOpen();
      return;
    }
    resetOnClose();
  }, [open, providerId]);

  function handleSelect(modelId: string) {
    activateProvider.reset();
    activateProvider.mutate(
      { providerId, model: modelId },
      {
        onSuccess: () => {
          onSelect(modelId);
          onOpenChange(false);
        },
      },
    );
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
        return;
      }
    },
    { isActive: open && !saving },
  );

  let fallbackNotice: string | null = null;
  if (source === "cache") {
    fallbackNotice = `Using cached catalog data from ${fetchedAt ?? "an unknown time"}.`;
  } else if (source === "snapshot") {
    fallbackNotice = "Using the bundled model catalog because live catalog data is unavailable.";
  }

  useInput(
    (input) => {
      if (input.toLowerCase() === "r") retry();
    },
    {
      isActive:
        open &&
        !saving &&
        focusZone !== "search" &&
        (Boolean(sourceError) || fallbackNotice !== null),
    },
  );

  useInput(
    (_input, key) => {
      if (filteredModels.length === 0) return;

      if (key.upArrow) {
        const nextIndex = (safeHighlightIndex - 1 + filteredModels.length) % filteredModels.length;
        setHighlightedModelId(filteredModels[nextIndex]?.id);
        return;
      }
      if (key.downArrow) {
        const nextIndex = (safeHighlightIndex + 1) % filteredModels.length;
        setHighlightedModelId(filteredModels[nextIndex]?.id);
        return;
      }
      if (key.return) {
        const model = filteredModels[safeHighlightIndex];
        if (model) handleSelect(model.id);
        return;
      }
    },
    { isActive: open && focusZone === "list" && !saving },
  );

  const contentWidth = Math.min(columns - 8, 70);
  const modelViewportSize = getModelViewportSize(rows, filteredModels.length);

  const compatibilityLabel = isOpenRouter ? getCompatibilityLabel(openRouter) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Select Model</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Box flexDirection="column" gap={1}>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              isActive={focusZone === "search" && !saving}
            />

            <TierFilterTabs
              value={tierFilter}
              onValueChange={setTierFilter}
              isActive={focusZone === "filters" && !saving}
            />

            {compatibilityLabel && !loading && !sourceError && (
              <Text color={tokens.muted}>{compatibilityLabel}</Text>
            )}
            {fallbackNotice ? (
              <Text color={tokens.warning}>{fallbackNotice} Press r to retry.</Text>
            ) : null}
            {sourceError ? <Text color={tokens.muted}>Press r to retry.</Text> : null}

            {renderModelListBody({
              loading,
              sourceError: sourceError ?? undefined,
              models,
              filteredModels,
              focusZone,
              safeHighlightIndex,
              selectedId,
              contentWidth,
              viewportSize: modelViewportSize,
              tokens,
            })}
            {activationError ? <Text color={tokens.error}>{activationError}</Text> : null}
            {saving && <Spinner label="Saving…" />}
          </Box>
        </Dialog.Body>
        <Dialog.Footer>
          <Box gap={2} justifyContent="flex-end" width="100%">
            <Text dimColor>Tab: zone</Text>
            <Text dimColor>/: search</Text>
            <Text dimColor>f: filter</Text>
            {(sourceError || fallbackNotice) && <Text dimColor>r: retry</Text>}
          </Box>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
