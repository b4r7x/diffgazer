import type { useModelFilter, useModelSource } from "@diffgazer/core/providers/hooks";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { Spinner } from "../../../components/ui/spinner";
import { getListWindow } from "../../../lib/list-window";
import { useTheme } from "../../../theme/provider";
import { ModelListItem } from "./model-list-item";

interface ModelListBodyProps {
  loading: boolean;
  sourceError: string | undefined;
  reason: string | null;
  models: ReturnType<typeof useModelSource>["models"];
  filteredModels: ReturnType<typeof useModelFilter>["filteredModels"];
  isListFocused: boolean;
  safeHighlightIndex: number;
  selectedId: string | undefined;
  contentWidth: number;
  viewportSize: number;
}

export function ModelListBody({
  loading,
  sourceError,
  reason,
  models,
  filteredModels,
  isListFocused,
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
        {models.length === 0 ? "No models available" : "No models match the current filters."}
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
            isHighlighted={isListFocused && absoluteIndex === safeHighlightIndex}
            isSelected={model.id === selectedId}
            maxWidth={contentWidth}
          />
        );
      })}
      {window.canScrollDown ? <Text color={tokens.muted}>{"\u25BC"}</Text> : null}
    </Box>
  );
}
