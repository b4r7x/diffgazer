export interface ListWindow {
  start: number;
  end: number;
  canScrollUp: boolean;
  canScrollDown: boolean;
}

export interface GetListWindowOptions {
  selectedIndex: number;
  total: number;
  viewportRows: number;
  maxContentRows?: number;
}

function getWindowBounds(selectedIndex: number, total: number, visibleRows: number) {
  const maxStart = Math.max(total - visibleRows, 0);
  const start = Math.min(Math.max(selectedIndex - visibleRows + 1, 0), maxStart);
  return { start, end: Math.min(start + visibleRows, total) };
}

export function getListWindow({
  selectedIndex,
  total,
  viewportRows,
  maxContentRows = viewportRows,
}: GetListWindowOptions): ListWindow {
  if (total <= 0 || viewportRows <= 0 || maxContentRows <= 0) {
    return { start: 0, end: 0, canScrollUp: false, canScrollDown: false };
  }

  const safeSelectedIndex = Math.min(Math.max(selectedIndex, 0), total - 1);
  if (total <= Math.min(viewportRows, maxContentRows)) {
    return { start: 0, end: total, canScrollUp: false, canScrollDown: false };
  }
  if (viewportRows === 1) {
    return {
      start: safeSelectedIndex,
      end: safeSelectedIndex + 1,
      canScrollUp: false,
      canScrollDown: false,
    };
  }
  let visibleRows = Math.min(total, viewportRows, maxContentRows);
  let window = getWindowBounds(safeSelectedIndex, total, visibleRows);
  let canScrollUp = window.start > 0;
  let canScrollDown = window.end < total;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const availableRows = viewportRows - Number(canScrollUp) - Number(canScrollDown);
    const nextVisibleRows = Math.max(1, Math.min(total, availableRows, maxContentRows));
    if (nextVisibleRows === visibleRows) break;

    visibleRows = nextVisibleRows;
    window = getWindowBounds(safeSelectedIndex, total, visibleRows);
    canScrollUp = window.start > 0;
    canScrollDown = window.end < total;
  }

  return { ...window, canScrollUp, canScrollDown };
}
