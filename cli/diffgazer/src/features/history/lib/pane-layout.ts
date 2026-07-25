import type { HistoryFocusZone } from "../types";

const HISTORY_CHROME_ROWS = 10;
const HISTORY_INSIGHTS_CHROME_ROWS = 5;
// Below this per-pane slot height the narrow stack cannot give every pane a
// content row (insights needs HISTORY_INSIGHTS_CHROME_ROWS + 1), so history
// degrades to the focused pane only instead of rendering empty bordered boxes.
const MIN_STACKED_PANE_ROWS = HISTORY_INSIGHTS_CHROME_ROWS + 1;

export interface HistoryPaneLayoutInput {
  columns: number;
  isNarrow: boolean;
  isMedium: boolean;
  contentRows: number;
  warningCount: number;
}

export interface HistoryPaneLayout {
  sectionsWidth: number;
  insightsWidth: number;
  sectionsPaneWidth: number;
  runsPaneWidth: number;
  paneHeight: number;
  paneSlotHeight: number;
  listHeight: number;
  insightScrollHeight: number;
  /** False once the narrow stack is too short to give all three panes a row. */
  canStackPanes: boolean;
}

export interface VisibleHistoryPanes {
  sections: boolean;
  runs: boolean;
  insights: boolean;
}

function getHistoryWarningRows(messageCount: number): number {
  if (messageCount === 0) return 0;
  return messageCount + 4;
}

export function computePaneLayout({
  columns,
  isNarrow,
  isMedium,
  contentRows,
  warningCount,
}: HistoryPaneLayoutInput): HistoryPaneLayout {
  const sectionsWidth = isMedium
    ? Math.max(Math.floor(columns * 0.18), 16)
    : Math.max(Math.floor(columns * 0.2), 18);
  const insightsWidth = isMedium
    ? Math.max(Math.floor(columns * 0.32), 26)
    : Math.max(Math.floor(columns * 0.34), 30);
  const contentWidth = Math.max(columns - 4, 1);

  const paneHeight = Math.max(
    contentRows - HISTORY_CHROME_ROWS - getHistoryWarningRows(warningCount),
    1,
  );
  const canStackPanes = !isNarrow || Math.floor(paneHeight / 3) >= MIN_STACKED_PANE_ROWS;
  const paneSlotHeight =
    isNarrow && canStackPanes ? Math.max(Math.floor(paneHeight / 3), 3) : paneHeight;

  return {
    sectionsWidth,
    insightsWidth,
    sectionsPaneWidth: isNarrow ? contentWidth : sectionsWidth,
    runsPaneWidth: isNarrow
      ? contentWidth
      : Math.max(contentWidth - sectionsWidth - insightsWidth, 1),
    paneHeight,
    paneSlotHeight,
    listHeight: Math.max(paneSlotHeight - 4, 1),
    insightScrollHeight: Math.max(paneSlotHeight - HISTORY_INSIGHTS_CHROME_ROWS, 1),
    canStackPanes,
  };
}

/** A stack that fits shows every pane; one that does not shows only the focused pane. */
export function getVisibleHistoryPanes(
  focusZone: HistoryFocusZone,
  canStackPanes: boolean,
): VisibleHistoryPanes {
  if (canStackPanes) return { sections: true, runs: true, insights: true };
  return {
    sections: focusZone === "timeline",
    runs: focusZone !== "timeline" && focusZone !== "insights",
    insights: focusZone === "insights",
  };
}
