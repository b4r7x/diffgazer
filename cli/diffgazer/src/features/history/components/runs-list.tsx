import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { EmptyState } from "../../../components/ui/empty-state";
import { NavigationList } from "../../../components/ui/navigation-list";
import { getListWindow } from "../../../lib/list-window";
import { useTheme } from "../../../theme/provider";
import type { MappedRun } from "../lib/run-mapping";

export interface RunsListProps {
  runs: MappedRun[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  isActive?: boolean;
  emptyMessage: string;
  height: number;
  width: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export function RunsList({
  runs,
  selectedId,
  onSelect,
  onHighlightChange,
  isActive = true,
  emptyMessage,
  height,
  width,
  hasMore = false,
  isLoadingMore = false,
}: RunsListProps): ReactElement {
  const { tokens } = useTheme();
  const itemWidth = Math.max(width - 4, 1);
  const statusWidth = Math.max(width - 2, 1);
  const paddingY = height >= 6 ? 1 : 0;
  const availableRows = Math.max(height - paddingY * 2, 1);
  let paginationStatus: string | null = null;
  if (isLoadingMore) paginationStatus = "Loading older runs...";
  else if (hasMore) paginationStatus = "l  Load older runs";

  if (runs.length === 0) {
    const showsPaginationStatus = paginationStatus !== null && availableRows > 1;
    return (
      <Box
        width={width}
        flexDirection="column"
        paddingX={1}
        paddingY={paddingY}
        height={height}
        overflow="hidden"
      >
        <EmptyState>
          <EmptyState.Message>{emptyMessage}</EmptyState.Message>
        </EmptyState>
        {showsPaginationStatus ? (
          <Box width={statusWidth}>
            <Text color={tokens.muted} wrap="truncate-end">
              {paginationStatus}
            </Text>
          </Box>
        ) : null}
      </Box>
    );
  }

  const itemRows = availableRows < 4 ? 1 : 2;
  const scrollingIndicatorRows = runs.length > 1 ? 2 : 0;
  const showsPaginationStatus =
    paginationStatus !== null && availableRows >= itemRows + scrollingIndicatorRows + 1;
  const listViewportRows = availableRows - (showsPaginationStatus ? 1 : 0);
  const maxVisibleItems = Math.max(
    Math.floor((listViewportRows - scrollingIndicatorRows) / itemRows),
    1,
  );
  const indicatorAwareViewportRows =
    maxVisibleItems + (runs.length > maxVisibleItems ? scrollingIndicatorRows : 0);
  const selectedIndex = Math.max(
    runs.findIndex((run) => run.id === selectedId),
    0,
  );
  const window = getListWindow({
    selectedIndex,
    total: runs.length,
    viewportRows: indicatorAwareViewportRows,
    maxContentRows: maxVisibleItems,
  });
  const visibleRuns = runs.slice(window.start, window.end);

  return (
    <Box
      width={width}
      flexDirection="column"
      paddingX={1}
      paddingY={paddingY}
      height={height}
      overflow="hidden"
    >
      {window.canScrollUp ? <Text color={tokens.muted}>{"\u25B2"}</Text> : null}
      <NavigationList
        selectedId={selectedId}
        highlightedId={isActive ? selectedId : null}
        onSelect={onSelect}
        onHighlightChange={onHighlightChange}
        isActive={isActive}
        wrap={false}
        navigationItems={runs.map((run) => ({ id: run.id, disabled: false }))}
      >
        {visibleRuns.map((run) => (
          <NavigationList.Item key={run.id} id={run.id}>
            {itemRows === 1 ? (
              <Box width={itemWidth}>
                <Text wrap="truncate-end">
                  <Text color={tokens.fg} bold>
                    {run.displayId}
                  </Text>{" "}
                  <Text color={tokens.muted}>{run.summary}</Text>
                </Text>
              </Box>
            ) : (
              <Box flexDirection="column">
                <Box width={itemWidth}>
                  <Text wrap="truncate-end">
                    <Text color={tokens.fg} bold>
                      {run.displayId}
                    </Text>{" "}
                    <Text color={tokens.muted}>[{run.branch}]</Text>{" "}
                    <Text color={tokens.muted}>{run.timestamp}</Text>
                  </Text>
                </Box>
                <Box width={itemWidth}>
                  <Text color={tokens.muted} wrap="truncate-end">
                    {run.summary}
                  </Text>
                </Box>
              </Box>
            )}
          </NavigationList.Item>
        ))}
      </NavigationList>
      {window.canScrollDown ? <Text color={tokens.muted}>{"\u25BC"}</Text> : null}
      {showsPaginationStatus ? (
        <Box width={statusWidth}>
          <Text color={tokens.muted} wrap="truncate-end">
            {paginationStatus}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
