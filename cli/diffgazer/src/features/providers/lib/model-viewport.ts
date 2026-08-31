const MIN_MODEL_VIEWPORT_SIZE = 4;
const MODEL_DIALOG_BASE_CHROME_ROWS = 12;

export function getModelViewportSize({
  contentRows,
  total,
  conditionalRows,
}: {
  contentRows: number;
  total: number;
  conditionalRows: number;
}): number {
  const availableRows = Math.max(
    MIN_MODEL_VIEWPORT_SIZE,
    contentRows - MODEL_DIALOG_BASE_CHROME_ROWS - conditionalRows,
  );
  return Math.min(total, availableRows);
}
