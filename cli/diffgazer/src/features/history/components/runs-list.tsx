import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { EmptyState } from "../../../components/ui/empty-state";
import { NavigationList } from "../../../components/ui/navigation-list";
import { getListWindow, type ListWindow } from "../../../lib/list-window";
import { useTheme } from "../../../theme/provider";
import type { MappedRun } from "../lib/run-mapping";

interface RunsWindowOptions {
  selectedIndex: number;
  total: number;
  viewportRows: number;
  itemRows: number;
}

/**
 * A run spends two rows while a scroll caret spends one, so the window has to
 * be solved in rows rather than items: take the cheapest caret budget whose
 * window actually draws that many carets. Reserving both up front costs a whole
 * run on the short panes history renders.
 */
function getRunsWindow({ selectedIndex, total, viewportRows, itemRows }: RunsWindowOptions) {
  function windowFor(indicatorRows: number): ListWindow {
    const maxContentRows = Math.max(Math.floor((viewportRows - indicatorRows) / itemRows), 1);
    return getListWindow({
      selectedIndex,
      total,
      viewportRows: maxContentRows + indicatorRows,
      maxContentRows,
    });
  }

  for (const indicatorRows of [0, 1]) {
    const candidate = windowFor(indicatorRows);
    if (Number(candidate.canScrollUp) + Number(candidate.canScrollDown) <= indicatorRows) {
      return candidate;
    }
  }
  return windowFor(2);
}

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

  const itemRows = availableRows < 4 ? 1 : 2;
  const showsPaginationStatus = paginationStatus !== null && availableRows >= itemRows + 1;
  const listViewportRows = availableRows - (showsPaginationStatus ? 1 : 0);
  const selectedIndex = Math.max(
    runs.findIndex((run) => run.id === selectedId),
    0,
  );
  const window = getRunsWindow({
    selectedIndex,
    total: runs.length,
    viewportRows: listViewportRows,
    itemRows,
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
      {runs.length === 0 ? (
        <EmptyState>
          <EmptyState.Message>{emptyMessage}</EmptyState.Message>
        </EmptyState>
      ) : (
        <>
          {window.canScrollUp ? <Text color={tokens.muted}>{"\u25B2"}</Text> : null}
          <NavigationList
            selectedId={selectedId}
            highlightedId={selectedId}
            onSelect={onSelect}
            onHighlightChange={onHighlightChange}
            isActive={isActive}
            wrap={false}
            navigationItems={runs.map((run) => ({ id: run.id, disabled: false }))}
          >
            {visibleRuns.map((run) => (
              <NavigationList.Item key={run.id} id={run.id}>
                {({ tone }) =>
                  itemRows === 1 ? (
                    <Box width={itemWidth}>
                      <Text wrap="truncate-end">
                        <Text color={tone.primary} bold>
                          {run.displayId}
                        </Text>{" "}
                        <Text color={tone.secondary}>{run.summary}</Text>
                      </Text>
                    </Box>
                  ) : (
                    <Box flexDirection="column">
                      <Box width={itemWidth}>
                        <Text wrap="truncate-end">
                          <Text color={tone.primary} bold>
                            {run.displayId}
                          </Text>{" "}
                          <Text color={tone.secondary}>[{run.branch}]</Text>{" "}
                          <Text color={tone.secondary}>{run.timestamp}</Text>
                        </Text>
                      </Box>
                      <Box width={itemWidth}>
                        <Text color={tone.secondary} wrap="truncate-end">
                          {run.summary}
                        </Text>
                      </Box>
                    </Box>
                  )
                }
              </NavigationList.Item>
            ))}
          </NavigationList>
          {window.canScrollDown ? <Text color={tokens.muted}>{"\u25BC"}</Text> : null}
        </>
      )}
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
