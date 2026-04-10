import { useState, useRef, useEffect } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { Dialog } from "../../../components/ui/dialog.js";
import { Button } from "../../../components/ui/button.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { useOpenRouterModels, useActivateProvider } from "@diffgazer/api/hooks";
import { buildModels, filterModels, TIER_FILTERS, type TierFilter } from "./model-select-helpers.js";
import { SearchInput } from "./model-search-input.js";
import { TierFilterTabs } from "./tier-filter-tabs.js";
import { ModelListItem } from "./model-list-item.js";

type FocusZone = "search" | "filters" | "list";

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
  const isOpenRouter = providerId === "openrouter";
  const openRouterQuery = useOpenRouterModels({ enabled: open && isOpenRouter });
  const activateProvider = useActivateProvider();

  const loading = isOpenRouter && openRouterQuery.isLoading;
  const saving = activateProvider.isPending;
  const error = activateProvider.error?.message ?? openRouterQuery.error?.message ?? undefined;

  const models = buildModels(
    providerId,
    isOpenRouter ? (openRouterQuery.data?.models ?? []) : [],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const filteredModels = filterModels(models, tierFilter, searchQuery);

  // Reset highlight when filter results change
  const prevCountRef = useRef(filteredModels.length);
  if (prevCountRef.current !== filteredModels.length) {
    prevCountRef.current = filteredModels.length;
    if (highlightIndex >= filteredModels.length) {
      setHighlightIndex(0);
    }
  }

  // Reset state when overlay opens
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

  // Intercept Dialog's escape: return to list first, close on second press
  const focusZoneRef = useRef(focusZone);
  focusZoneRef.current = focusZone;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && focusZoneRef.current !== "list") {
      setFocusZone("list");
      return;
    }
    onOpenChange(nextOpen);
  }

  // Tab cycles focus zones, shortcuts for search/filter
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

      // "/" focuses search from any zone
      if (input === "/" && focusZone !== "search") {
        setFocusZone("search");
        return;
      }

      // "f" cycles tier filter when not in search
      if (input === "f" && focusZone !== "search") {
        setTierFilter((prev) => {
          const idx = TIER_FILTERS.indexOf(prev);
          return TIER_FILTERS[(idx + 1) % TIER_FILTERS.length] ?? "all";
        });
        return;
      }
    },
    { isActive: open && !saving },
  );

  // List navigation (only when list is focused)
  useInput(
    (_input, key) => {
      if (filteredModels.length === 0) return;

      if (key.upArrow) {
        setHighlightIndex((prev) =>
          (prev - 1 + filteredModels.length) % filteredModels.length,
        );
        return;
      }
      if (key.downArrow) {
        setHighlightIndex((prev) =>
          (prev + 1) % filteredModels.length,
        );
        return;
      }
      if (key.return) {
        const model = filteredModels[highlightIndex];
        if (model) handleSelect(model.id);
        return;
      }
    },
    { isActive: open && focusZone === "list" && !saving },
  );

  // Max width for description truncation
  const contentWidth = Math.min(columns - 8, 70);

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

            {loading ? (
              <Spinner label="Loading models\u2026" />
            ) : error ? (
              <Text color={tokens.error}>{error}</Text>
            ) : filteredModels.length === 0 ? (
              <Text dimColor>
                {models.length === 0 ? "No models available" : "No models match your search"}
              </Text>
            ) : (
              <Box flexDirection="column">
                {filteredModels.map((model, idx) => (
                  <ModelListItem
                    key={model.id}
                    model={model}
                    isHighlighted={focusZone === "list" && idx === highlightIndex}
                    isSelected={model.id === selectedId}
                    maxWidth={contentWidth}
                  />
                ))}
              </Box>
            )}
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
