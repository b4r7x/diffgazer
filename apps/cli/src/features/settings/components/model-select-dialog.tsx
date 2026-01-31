import type { ReactElement } from "react";
import { useState, useEffect, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogActions,
} from "../../../components/ui/dialog.js";
import { useTheme } from "../../../hooks/use-theme.js";
import type { AIProvider, ModelInfo } from "@repo/schemas/config";
import {
  GEMINI_MODEL_INFO,
  OPENAI_MODEL_INFO,
  ANTHROPIC_MODEL_INFO,
  GLM_MODEL_INFO,
} from "@repo/schemas/config";

type FocusZone = "search" | "filters" | "list" | "footer";
type TierFilter = "all" | "free" | "paid";

const FILTERS: TierFilter[] = ["all", "free", "paid"];

function getModelsForProvider(provider: AIProvider): ModelInfo[] {
  switch (provider) {
    case "gemini":
      return Object.values(GEMINI_MODEL_INFO);
    case "openai":
      return Object.values(OPENAI_MODEL_INFO);
    case "anthropic":
      return Object.values(ANTHROPIC_MODEL_INFO);
    case "glm":
      return Object.values(GLM_MODEL_INFO);
    default:
      return [];
  }
}

export interface ModelSelectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  provider: AIProvider;
  currentModel: string | undefined;
  onSelect: (modelId: string) => void;
}

export function ModelSelectDialog({
  isOpen,
  onClose,
  provider,
  currentModel,
  onSelect,
}: ModelSelectDialogProps): ReactElement | null {
  const { colors } = useTheme();
  const models = getModelsForProvider(provider);

  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [checkedModelId, setCheckedModelId] = useState<string | undefined>(currentModel);
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [filterIndex, setFilterIndex] = useState(0);
  const [footerButtonIndex, setFooterButtonIndex] = useState(1);

  // Filter models
  const filteredModels = useMemo(() => {
    let result = models;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.id.toLowerCase().includes(query) ||
          m.name.toLowerCase().includes(query)
      );
    }

    // Tier filter
    if (tierFilter !== "all") {
      result = result.filter((m) => m.tier === tierFilter);
    }

    return result;
  }, [models, searchQuery, tierFilter]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setTierFilter("all");
      setFocusZone("list");
      setFilterIndex(0);
      setFooterButtonIndex(1);
      setCheckedModelId(currentModel);
      const currentIndex = models.findIndex((m) => m.id === currentModel);
      setSelectedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  }, [isOpen, currentModel, provider]);

  // Clamp selection when filtered list changes
  useEffect(() => {
    if (selectedIndex >= filteredModels.length && filteredModels.length > 0) {
      setSelectedIndex(0);
    }
  }, [filteredModels.length, selectedIndex]);

  function handleConfirm(): void {
    const model = filteredModels[selectedIndex];
    if (model) {
      onSelect(model.id);
      onClose();
    }
  }

  function handleCheck(): void {
    const model = filteredModels[selectedIndex];
    if (model) {
      setCheckedModelId(model.id);
    }
  }

  function cycleTierFilter(): void {
    const idx = FILTERS.indexOf(tierFilter);
    const next = FILTERS[(idx + 1) % FILTERS.length];
    if (next) setTierFilter(next);
  }

  // Visible models (max 8 in viewport)
  const maxVisible = 8;
  const startIndex = Math.max(0, Math.min(selectedIndex - 3, filteredModels.length - maxVisible));
  const visibleModels = filteredModels.slice(startIndex, startIndex + maxVisible);

  useInput(
    (input, key) => {
      if (!isOpen) return;

      // Global shortcuts
      if (input === "/" && focusZone !== "search") {
        setFocusZone("search");
        return;
      }
      if (input === "f" && focusZone !== "search") {
        cycleTierFilter();
        return;
      }

      // Zone-specific handling
      switch (focusZone) {
        case "search":
          if (key.downArrow) {
            setFocusZone("filters");
            return;
          }
          if (key.escape) {
            if (searchQuery) {
              setSearchQuery("");
            } else {
              setFocusZone("list");
            }
            return;
          }
          break;

        case "filters":
          if (key.leftArrow) {
            setFilterIndex((prev) => (prev > 0 ? prev - 1 : 2));
            return;
          }
          if (key.rightArrow) {
            setFilterIndex((prev) => (prev < 2 ? prev + 1 : 0));
            return;
          }
          if (key.downArrow) {
            setFocusZone("list");
            setSelectedIndex(0);
            return;
          }
          if (key.upArrow) {
            setFocusZone("search");
            return;
          }
          if (key.return || input === " ") {
            const filter = FILTERS[filterIndex];
            if (filter) setTierFilter(filter);
            return;
          }
          break;

        case "list":
          if (key.upArrow || input === "k") {
            if (selectedIndex > 0) {
              setSelectedIndex((prev) => prev - 1);
            } else {
              setFocusZone("filters");
              setFilterIndex(0);
            }
            return;
          }
          if (key.downArrow || input === "j") {
            if (selectedIndex < filteredModels.length - 1) {
              setSelectedIndex((prev) => prev + 1);
            } else {
              setFocusZone("footer");
              setFooterButtonIndex(1);
            }
            return;
          }
          if (input === " " && filteredModels.length > 0) {
            handleCheck();
            return;
          }
          if (key.return && filteredModels.length > 0) {
            handleConfirm();
            return;
          }
          break;

        case "footer":
          if (key.leftArrow) {
            setFooterButtonIndex(0);
            return;
          }
          if (key.rightArrow) {
            setFooterButtonIndex(1);
            return;
          }
          if (key.upArrow) {
            setFocusZone("list");
            setSelectedIndex(filteredModels.length - 1);
            return;
          }
          if (key.return || input === " ") {
            if (footerButtonIndex === 0) {
              onClose();
            } else {
              handleConfirm();
            }
            return;
          }
          break;
      }

      // Escape closes (except in search with query)
      if (key.escape && focusZone !== "search") {
        onClose();
      }
    },
    { isActive: isOpen }
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      fullscreen
      maxWidth={65}
      maxHeight={22}
    >
      {/* Header */}
      <DialogHeader>
        <Box justifyContent="space-between" width="100%">
          <DialogTitle>Select Model</DialogTitle>
          <Text dimColor>[x]</Text>
        </Box>
      </DialogHeader>

      {/* Body */}
      <DialogBody>
        <Box flexDirection="column" gap={1}>
          {/* Search */}
          <Box>
            <Text color={focusZone === "search" ? colors.ui.accent : colors.ui.textMuted}>/</Text>
            <Text> </Text>
            {focusZone === "search" ? (
              <TextInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search models..."
              />
            ) : (
              <Text color={searchQuery ? colors.ui.text : colors.ui.textMuted}>
                {searchQuery || "Search models..."}
              </Text>
            )}
          </Box>

          {/* Filters */}
          <Box gap={1}>
            {FILTERS.map((filter, idx) => {
              const isActive = tierFilter === filter;
              const isFocused = focusZone === "filters" && filterIndex === idx;
              return (
                <Text
                  key={filter}
                  color={isActive ? colors.ui.accent : isFocused ? colors.ui.text : colors.ui.textMuted}
                  bold={isActive}
                  inverse={isFocused}
                >
                  [{filter.toUpperCase()}]
                </Text>
              );
            })}
          </Box>

          {/* Model List */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={focusZone === "list" ? colors.ui.borderFocused : colors.ui.border}
            height={10}
            paddingX={1}
          >
            {filteredModels.length === 0 ? (
              <Text dimColor>No models match filter</Text>
            ) : (
              visibleModels.map((model, idx) => {
                const actualIndex = startIndex + idx;
                const isSelected = actualIndex === selectedIndex;
                const isChecked = model.id === checkedModelId;
                const isFocused = focusZone === "list" && isSelected;

                return (
                  <Box key={model.id} gap={1}>
                    <Text color={isFocused ? colors.ui.accent : undefined}>
                      {isFocused ? ">" : " "}
                    </Text>
                    <Text bold={isChecked}>
                      {isChecked ? "[*]" : "[ ]"}
                    </Text>
                    <Text
                      color={isSelected ? colors.ui.text : undefined}
                      bold={isSelected}
                      inverse={isFocused}
                    >
                      {model.name}
                    </Text>
                    <Text
                      color={model.tier === "free" ? colors.ui.success : colors.ui.textMuted}
                    >
                      {model.tier === "free" ? "FREE" : "PAID"}
                    </Text>
                  </Box>
                );
              })
            )}
            {filteredModels.length > maxVisible && (
              <Text dimColor>
                {startIndex > 0 ? "↑ " : "  "}
                {selectedIndex + 1}/{filteredModels.length}
                {startIndex + maxVisible < filteredModels.length ? " ↓" : "  "}
              </Text>
            )}
          </Box>
        </Box>
      </DialogBody>

      {/* Footer */}
      <DialogFooter>
        <Box justifyContent="space-between" width="100%">
          <Box gap={2}>
            <Text dimColor>↑↓/jk navigate</Text>
            <Text dimColor>/ search</Text>
            <Text dimColor>f filter</Text>
          </Box>
          <DialogActions>
            <Text
              color={focusZone === "footer" && footerButtonIndex === 0 ? colors.ui.accent : colors.ui.textMuted}
              inverse={focusZone === "footer" && footerButtonIndex === 0}
            >
              [Esc] Cancel
            </Text>
            <Text
              color={
                filteredModels.length === 0
                  ? colors.ui.textMuted
                  : focusZone === "footer" && footerButtonIndex === 1
                    ? colors.ui.accent
                    : colors.ui.text
              }
              inverse={focusZone === "footer" && footerButtonIndex === 1}
              dimColor={filteredModels.length === 0}
            >
              [Enter] Confirm
            </Text>
          </DialogActions>
        </Box>
      </DialogFooter>
    </Dialog>
  );
}
