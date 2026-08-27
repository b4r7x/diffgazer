import type { HistoryRunSummary } from "@diffgazer/core/review";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import { Box, Text, useInput } from "ink";
import { type ReactElement, useEffect } from "react";
import { EmptyState } from "../../../components/ui/empty-state";
import { NavigationList } from "../../../components/ui/navigation-list";
import { getListWindow, type ListWindow } from "../../../lib/list-window";
import { terminalCellWidth, wrappedRowCount } from "../../../lib/terminal-width";
import { rowTone } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";
import type { HistoryRunsSubZone } from "../types";

interface RunsWindowOptions {
  selectedIndex: number;
  total: number;
  viewportRows: number;
  itemRows: number;
}

const SALVAGED_MARKER = "[Salvaged]";

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
  runs: HistoryRunSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  onNavigationBoundaryReached?: (direction: 1 | -1) => void;
  isActive?: boolean;
  emptyMessage: string;
  height: number;
  width: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  salvagedRunIds?: ReadonlySet<string>;
  subZone?: HistoryRunsSubZone;
  onSubZoneChange?: (zone: HistoryRunsSubZone) => void;
  onLoadMore?: () => void;
}

export function RunsList({
  runs,
  selectedId,
  onSelect,
  onHighlightChange,
  onNavigationBoundaryReached,
  isActive = true,
  emptyMessage,
  height,
  width,
  hasMore = false,
  isLoadingMore = false,
  salvagedRunIds,
  subZone = "list",
  onSubZoneChange,
  onLoadMore,
}: RunsListProps): ReactElement {
  const { tokens } = useTheme();
  const paddingY = height >= 6 ? 1 : 0;
  const availableRows = Math.max(height - paddingY * 2, 1);
  let paginationStatus: string | null = null;
  if (isLoadingMore) paginationStatus = "Loading older runs...";
  else if (hasMore) paginationStatus = "l  Load older runs";

  const displayIds = runs.map((run) => run.displayId);
  const regularItemWidth = Math.max(width - 4, 1);
  const hasSalvagedRun = runs.some((run) => salvagedRunIds?.has(run.id));
  const tightIdentifierLayout = displayIds.some(
    (displayId) =>
      terminalCellWidth(displayId) > regularItemWidth ||
      (hasSalvagedRun &&
        terminalCellWidth(displayId) + SALVAGED_MARKER.length + 1 > regularItemWidth),
  );
  const itemWidth = tightIdentifierLayout ? Math.max(width, 1) : regularItemWidth;
  const statusWidth = tightIdentifierLayout ? Math.max(width, 1) : Math.max(width - 2, 1);
  const maxIdentifierRows = tightIdentifierLayout
    ? Math.max(...displayIds.map((displayId) => wrappedRowCount(displayId, itemWidth)), 1)
    : 1;
  const defaultItemRows = availableRows < 4 ? 1 : 2;
  const itemRows = tightIdentifierLayout
    ? maxIdentifierRows + (hasSalvagedRun ? 1 : 0)
    : defaultItemRows;
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
  const effectiveSubZone: HistoryRunsSubZone = showsPaginationStatus ? subZone : "list";

  useEffect(() => {
    if (subZone === "load-more" && !showsPaginationStatus) onSubZoneChange?.("list");
  }, [subZone, showsPaginationStatus, onSubZoneChange]);

  const paginationTone = rowTone(tokens, {
    isHighlighted: effectiveSubZone === "load-more",
    isActive,
  });

  useInput(
    (input, key) => {
      if (key.upArrow || input === "k") {
        onSubZoneChange?.("list");
        return;
      }
      if (key.return) onLoadMore?.();
    },
    { isActive: isActive && effectiveSubZone === "load-more" },
  );

  return (
    <Box
      width={width}
      flexDirection="column"
      paddingX={tightIdentifierLayout ? 0 : 1}
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
            onNavigationBoundaryReached={(direction) => {
              if (direction === 1 && showsPaginationStatus) {
                onSubZoneChange?.("load-more");
                return;
              }
              onNavigationBoundaryReached?.(direction);
            }}
            isActive={isActive && effectiveSubZone === "list"}
            wrap={false}
            navigationItems={runs.map((run) => ({ id: run.id, disabled: false }))}
          >
            {visibleRuns.map((run, visibleIndex) => {
              const runIndex = window.start + visibleIndex;
              const displayId = displayIds[runIndex] ?? run.displayId;
              const safeBranch = run.branch ? sanitizeTerminalText(run.branch) : run.branch;
              const isSalvaged = salvagedRunIds?.has(run.id) ?? false;
              return (
                <NavigationList.Item key={run.id} id={run.id}>
                  {({ tone }) => {
                    if (tightIdentifierLayout) {
                      return (
                        <Box flexDirection="column">
                          <Box width={itemWidth} marginLeft={-2}>
                            <Text wrap="wrap">
                              <Text color={tone.primary} bold>
                                {displayId}
                              </Text>{" "}
                            </Text>
                          </Box>
                          {hasSalvagedRun ? (
                            <Box width={itemWidth} marginLeft={-2}>
                              <Text color={tone.secondary} wrap="truncate-end">
                                {isSalvaged ? (
                                  <Text color={tokens.warning}>{SALVAGED_MARKER} </Text>
                                ) : null}
                                {run.summary}
                              </Text>
                            </Box>
                          ) : null}
                        </Box>
                      );
                    }

                    if (itemRows === 1) {
                      return (
                        <Box width={itemWidth}>
                          <Text wrap="truncate-end">
                            <Text color={tone.primary} bold>
                              {displayId}
                            </Text>{" "}
                            {isSalvaged ? (
                              <Text color={tokens.warning}>{SALVAGED_MARKER} </Text>
                            ) : null}
                            <Text color={tone.secondary}>{run.summary}</Text>
                          </Text>
                        </Box>
                      );
                    }

                    return (
                      <Box flexDirection="column">
                        <Box width={itemWidth}>
                          <Text wrap="truncate-end">
                            <Text color={tone.primary} bold>
                              {displayId}
                            </Text>{" "}
                            <Text color={tone.secondary}>[{safeBranch}]</Text>{" "}
                            <Text color={tone.secondary}>{run.timestamp}</Text>
                          </Text>
                        </Box>
                        <Box width={itemWidth}>
                          <Text color={tone.secondary} wrap="truncate-end">
                            {isSalvaged ? (
                              <Text color={tokens.warning}>{SALVAGED_MARKER} </Text>
                            ) : null}
                            {run.summary}
                          </Text>
                        </Box>
                      </Box>
                    );
                  }}
                </NavigationList.Item>
              );
            })}
          </NavigationList>
          {window.canScrollDown ? <Text color={tokens.muted}>{"\u25BC"}</Text> : null}
        </>
      )}
      {showsPaginationStatus ? (
        <Box width={statusWidth} backgroundColor={paginationTone.background}>
          <Text color={paginationTone.secondary} wrap="truncate-end">
            {paginationStatus}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
