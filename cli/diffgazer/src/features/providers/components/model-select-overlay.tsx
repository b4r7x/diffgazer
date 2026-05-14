import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import type { AIProvider, ModelInfo } from "@diffgazer/core/schemas/config";
import { OPENROUTER_PROVIDER_ID } from "@diffgazer/core/schemas/config";
import { useTheme } from "../../../theme/theme-context.js";
import type { CliColorTokens } from "../../../theme/palettes.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { Dialog } from "../../../components/ui/dialog.js";
import { Button } from "../../../components/ui/button.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { useActivateProvider } from "@diffgazer/core/api/hooks";
import {
  cycleTierFilter,
  filterModels,
  getStaticModelsForProvider,
  useOpenRouterModelsMapped,
  type TierFilter,
} from "@diffgazer/core/providers";
import { SearchInput } from "./model-search-input.js";
import { TierFilterTabs } from "./tier-filter-tabs.js";
import { ModelListItem } from "./model-list-item.js";
import { getCompatibilityLabel } from "./model-select-helpers.js";

type FocusZone = "search" | "filters" | "list";

function renderModelListBody({
  loading,
  error,
  models,
  filteredModels,
  focusZone,
  safeHighlightIndex,
  selectedId,
  contentWidth,
  tokens,
}: {
  loading: boolean;
  error: string | undefined;
  models: ModelInfo[];
  filteredModels: ModelInfo[];
  focusZone: FocusZone;
  safeHighlightIndex: number;
  selectedId: string | undefined;
  contentWidth: number;
  tokens: CliColorTokens;
}): ReactElement {
  if (loading) {
    return <Spinner label="Loading models…" />;
  }
  if (error) {
    return <Text color={tokens.error}>{error}</Text>;
  }
  if (filteredModels.length === 0) {
    return (
      <Text dimColor>
        {models.length === 0 ? "No models available" : "No models match your search"}
      </Text>
    );
  }
  return (
    <Box flexDirection="column">
      {filteredModels.map((model, idx) => (
        <ModelListItem
          key={model.id}
          model={model}
          isHighlighted={focusZone === "list" && idx === safeHighlightIndex}
          isSelected={model.id === selectedId}
          maxWidth={contentWidth}
        />
      ))}
    </Box>
  );
}

interface ModelSelectOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function ModelSelectOverlay({
  open,
  onOpenChange,
  providerId,
  selectedId,
  onSelect,
}: ModelSelectOverlayProps): ReactElement | null {
  const { tokens } = useTheme();
  const { columns } = useTerminalDimensions();
  const isOpenRouter = providerId === OPENROUTER_PROVIDER_ID;
  const openRouter = useOpenRouterModelsMapped(open, providerId as AIProvider);
  const activateProvider = useActivateProvider();

  const loading = openRouter.loading;
  const saving = activateProvider.isPending;
  const error = activateProvider.error?.message ?? openRouter.error ?? undefined;

  const models = isOpenRouter
    ? openRouter.models
    : getStaticModelsForProvider(providerId as AIProvider);

  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const filteredModels = filterModels(models, tierFilter, searchQuery);

  // Derive the clamped index during render. Arrow handlers wrap with modulo
  // against the current filteredModels.length, so the stored highlightIndex
  // can never persist out of range across user actions.
  const safeHighlightIndex =
    filteredModels.length === 0
      ? 0
      : Math.min(highlightIndex, filteredModels.length - 1);

  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setTierFilter("all");
      setFocusZone("list");
      setHighlightIndex(0);
    }
  }, [open]);

  function handleSelect(modelId: string) {
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

  // Dialog escape returns to the list first, then closes. Called from an event
  // handler, so `focusZone` from closure is the latest committed value.
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && focusZone !== "list") {
      setFocusZone("list");
      return;
    }
    onOpenChange(nextOpen);
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
        setTierFilter(cycleTierFilter);
        return;
      }
    },
    { isActive: open && !saving },
  );

  useInput(
    (_input, key) => {
      if (filteredModels.length === 0) return;

      if (key.upArrow) {
        setHighlightIndex(
          (safeHighlightIndex - 1 + filteredModels.length) % filteredModels.length,
        );
        return;
      }
      if (key.downArrow) {
        setHighlightIndex(
          (safeHighlightIndex + 1) % filteredModels.length,
        );
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

  const compatibilityLabel = isOpenRouter
    ? getCompatibilityLabel(openRouter)
    : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

            {compatibilityLabel && !loading && !error && (
              <Text color={tokens.muted}>{compatibilityLabel}</Text>
            )}

            {renderModelListBody({
              loading,
              error,
              models,
              filteredModels,
              focusZone,
              safeHighlightIndex,
              selectedId,
              contentWidth,
              tokens,
            })}
            {saving && <Spinner label="Saving\u2026" />}
          </Box>
        </Dialog.Body>
        <Dialog.Footer>
          <Box justifyContent="space-between" width="100%">
            <Button variant="ghost" onPress={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Box gap={2}>
              <Text dimColor>Tab: zone</Text>
              <Text dimColor>/: search</Text>
              <Text dimColor>f: filter</Text>
            </Box>
          </Box>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
