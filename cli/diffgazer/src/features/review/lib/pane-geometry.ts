const RESULTS_CHROME_ROWS = 2;
const RESULTS_PANE_BORDER_ROWS = 2;
const ISSUE_LIST_CHROME_ROWS = 5;
const ISSUE_DETAILS_CHROME_ROWS = 7;
// Narrow mode truncates the details title and location to one row each, so the
// half-pane chrome is exact: paddingTop + title + location.
const NARROW_DETAILS_HEADER_ROWS = 3;
const DETAILS_TABS_ROWS = 2;

export interface ReviewPaneGeometryInput {
  columns: number;
  contentRows: number;
  isNarrow: boolean;
  hasDuplicateNotice: boolean;
}

export interface ReviewPaneGeometry {
  listWidth: number;
  listContentWidth: number;
  /** Outer box heights; narrow mode splits the frame, wide mode gives both the full height. */
  listPaneHeight: number;
  detailsPaneHeight: number;
  listScrollHeight: number;
  detailScrollHeight: number;
  /** Narrow mode drops the tab row when the half-pane cannot spare it a body row. */
  showDetailsTabs: boolean;
}

function getDetailScrollHeight({
  isNarrow,
  paneContentHeight,
  narrowDetailsInnerRows,
  showDetailsTabs,
}: {
  isNarrow: boolean;
  paneContentHeight: number;
  narrowDetailsInnerRows: number;
  showDetailsTabs: boolean;
}): number {
  if (!isNarrow) return Math.max(paneContentHeight - ISSUE_DETAILS_CHROME_ROWS, 1);
  return Math.max(
    narrowDetailsInnerRows - NARROW_DETAILS_HEADER_ROWS - (showDetailsTabs ? DETAILS_TABS_ROWS : 0),
    1,
  );
}

/**
 * Row and column budget for the review results panes. Narrow mode stacks the
 * list above the details and splits the frame between them, so the two halves
 * round in opposite directions to spend every row.
 */
export function computePaneGeometry({
  columns,
  contentRows,
  isNarrow,
  hasDuplicateNotice,
}: ReviewPaneGeometryInput): ReviewPaneGeometry {
  // The list carries the severity chip row and issue titles, so its share of the
  // frame is the same at every tier instead of shrinking as the frame grows.
  const listWidth = Math.min(Math.max(Math.floor(columns * 0.4), 34), 56);

  const paneHeight = Math.max(contentRows - RESULTS_CHROME_ROWS - (hasDuplicateNotice ? 1 : 0), 1);
  const paneContentHeight = Math.max(paneHeight - RESULTS_PANE_BORDER_ROWS, 1);
  const listPaneContentHeight = isNarrow
    ? Math.max(Math.floor(paneContentHeight / 2), 1)
    : paneContentHeight;

  const narrowDetailsPaneHeight = Math.floor(paneHeight / 2);
  const narrowDetailsInnerRows = Math.max(narrowDetailsPaneHeight - RESULTS_PANE_BORDER_ROWS, 0);
  const showDetailsTabs =
    !isNarrow || narrowDetailsInnerRows >= NARROW_DETAILS_HEADER_ROWS + DETAILS_TABS_ROWS + 1;

  return {
    listWidth,
    listContentWidth: Math.max((isNarrow ? columns : listWidth) - 4, 1),
    listPaneHeight: isNarrow ? Math.ceil(paneHeight / 2) : paneHeight,
    detailsPaneHeight: isNarrow ? narrowDetailsPaneHeight : paneHeight,
    listScrollHeight: Math.max(listPaneContentHeight - ISSUE_LIST_CHROME_ROWS, 1),
    detailScrollHeight: getDetailScrollHeight({
      isNarrow,
      paneContentHeight,
      narrowDetailsInnerRows,
      showDetailsTabs,
    }),
    showDetailsTabs,
  };
}
