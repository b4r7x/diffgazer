import { useState, useRef, useEffect } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import {
  AVAILABLE_PROVIDERS,
  GEMINI_MODEL_INFO,
  GLM_MODEL_INFO,
  type ModelInfo,
} from "@diffgazer/schemas/config";
import { useTheme } from "../../../theme/theme-context.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { Dialog } from "../../../components/ui/dialog.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { useOpenRouterModels, useActivateProvider } from "@diffgazer/api/hooks";

// --- Types ---

interface DisplayModel {
  id: string;
  name: string;
  description?: string;
  tier: "free" | "paid";
}

type TierFilter = "all" | "free" | "paid";
const TIER_FILTERS: TierFilter[] = ["all", "free", "paid"];

type FocusZone = "search" | "filters" | "list";

interface ModelSelectOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  selectedId?: string;
  onSelect: (id: string) => void;
}

// --- Helpers ---

function getModelInfo(providerId: string): Record<string, ModelInfo> | undefined {
  switch (providerId) {
    case "gemini":
      return GEMINI_MODEL_INFO;
    case "zai":
    case "zai-coding":
      return GLM_MODEL_INFO;
    default:
      return undefined;
  }
}

function buildModels(providerId: string, openRouterModels: Array<{ id: string; name: string; description?: string; isFree: boolean }>): DisplayModel[] {
  if (providerId === "openrouter") {
    return openRouterModels.map((m) => ({
      id: m.id,
      name: m.name || m.id,
      description: m.description,
      tier: m.isFree ? "free" : "paid",
    }));
  }

  const provider = AVAILABLE_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return [];

  const infoMap = getModelInfo(providerId);
  if (!infoMap) {
    return provider.models.map((id) => ({ id, name: id, tier: "paid" as const }));
  }

  return provider.models.map((id) => {
    const info = infoMap[id];
    if (info) {
      return { id: info.id, name: info.name, description: info.description, tier: info.tier };
    }
    return { id, name: id, tier: "paid" as const };
  });
}

function filterModels(models: DisplayModel[], tierFilter: TierFilter, searchQuery: string): DisplayModel[] {
  let filtered = models;

  if (tierFilter === "free") {
    filtered = filtered.filter((m) => m.tier === "free");
  } else if (tierFilter === "paid") {
    filtered = filtered.filter((m) => m.tier === "paid");
  }

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        (m.description?.toLowerCase().includes(query) ?? false),
    );
  }

  return filtered;
}

// --- Sub-components ---

function SearchInput({
  value,
  onChange,
  isActive,
}: {
  value: string;
  onChange: (value: string) => void;
  isActive: boolean;
}) {
  const { tokens } = useTheme();

  useInput(
    (input, key) => {
      if (key.backspace || key.delete) {
        onChange(value.slice(0, -1));
        return;
      }
      if (key.return || key.escape || key.upArrow || key.downArrow || key.tab) {
        return;
      }
      if (input.length === 1 && !key.ctrl && !key.meta) {
        onChange(value + input);
      }
    },
    { isActive },
  );

  return (
    <Box>
      <Text color={tokens.muted}>/ </Text>
      <Box
        borderStyle="single"
        borderColor={isActive ? tokens.accent : tokens.border}
        flexGrow={1}
      >
        {value ? (
          <Text>{value}<Text color={isActive ? tokens.fg : tokens.muted}>{isActive ? "\u2588" : ""}</Text></Text>
        ) : (
          <Text color={tokens.muted}>Search models...{isActive ? "\u2588" : ""}</Text>
        )}
      </Box>
    </Box>
  );
}

function TierFilterTabs({
  value,
  onValueChange,
  isActive,
}: {
  value: TierFilter;
  onValueChange: (value: TierFilter) => void;
  isActive: boolean;
}) {
  const { tokens } = useTheme();

  useInput(
    (_input, key) => {
      if (!key.leftArrow && !key.rightArrow) return;
      const currentIdx = TIER_FILTERS.indexOf(value);
      const direction = key.rightArrow ? 1 : -1;
      const nextIdx = (currentIdx + direction + TIER_FILTERS.length) % TIER_FILTERS.length;
      const next = TIER_FILTERS[nextIdx];
      if (next) onValueChange(next);
    },
    { isActive },
  );

  return (
    <Box gap={1}>
      {TIER_FILTERS.map((filter) => {
        const isSelected = value === filter;
        return (
          <Text
            key={filter}
            color={isSelected ? tokens.fg : tokens.muted}
            backgroundColor={isSelected ? tokens.accent : undefined}
            bold={isSelected}
          >
            {` ${filter.toUpperCase()} `}
          </Text>
        );
      })}
      {isActive && <Text color={tokens.muted}> {"<-/->"}</Text>}
    </Box>
  );
}

function ModelListItem({
  model,
  isHighlighted,
  isSelected,
  maxWidth,
}: {
  model: DisplayModel;
  isHighlighted: boolean;
  isSelected: boolean;
  maxWidth: number;
}) {
  const { tokens } = useTheme();

  const prefix = isSelected ? "| " : isHighlighted ? "> " : "  ";
  const check = isSelected ? "[*]" : "[ ]";

  // Reserve space for prefix(2) + check(3) + gaps(3) + badge(~6) = ~14 chars
  const descMaxLen = Math.max(0, maxWidth - model.name.length - 18);
  const desc = model.description
    ? model.description.length > descMaxLen
      ? model.description.slice(0, Math.max(0, descMaxLen - 1)) + "\u2026"
      : model.description
    : undefined;

  return (
    <Box>
      <Text
        color={isHighlighted ? tokens.fg : undefined}
        backgroundColor={isHighlighted ? tokens.accent : undefined}
        bold={isHighlighted || isSelected}
      >
        {prefix}
      </Text>
      <Text color={isSelected ? tokens.info : undefined} bold>{check} </Text>
      <Box gap={1} flexShrink={1}>
        <Text bold>{model.name}</Text>
        <Badge variant={model.tier === "free" ? "info" : "neutral"}>
          {model.tier}
        </Badge>
        {desc && <Text dimColor>{desc}</Text>}
      </Box>
    </Box>
  );
}

// --- Main component ---

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
