/** The `[` and `]` a full chip label is wrapped in. */
const CHIP_BRACKET_COLUMNS = 2;
/** `columnGap={1}` between chips on the same row. */
const CHIP_GAP = 1;

type SeverityChipMode = "full" | "wrapped" | "short";

export interface SeverityChipLayout {
  mode: SeverityChipMode;
  /** Rows the chip row occupies, so the list pane can budget its viewport. */
  rows: number;
}

export interface SeverityChipLayoutInput {
  labels: string[];
  hasReset: boolean;
  contentWidth: number;
}

/**
 * Rows a first-fit wrap spends on `chipWidths`, matching how Ink packs whole
 * `flexShrink={0}` chips: a chip that does not fit moves entirely to the next
 * row rather than splitting across the break.
 */
function countWrappedRows(chipWidths: number[], contentWidth: number): number {
  let rows = 1;
  let rowWidth = 0;
  for (const chipWidth of chipWidths) {
    const withChip = rowWidth === 0 ? chipWidth : rowWidth + CHIP_GAP + chipWidth;
    if (withChip <= contentWidth) {
      rowWidth = withChip;
      continue;
    }
    rows += 1;
    rowWidth = chipWidth;
  }
  return rows;
}

/**
 * Readable chips are worth a second row: the row wraps before it collapses to
 * single letters, so the cryptic codes survive only where one whole chip cannot
 * fit on a line.
 */
export function getSeverityChipLayout({
  labels,
  hasReset,
  contentWidth,
}: SeverityChipLayoutInput): SeverityChipLayout {
  const chipWidths = [...labels, ...(hasReset ? ["Reset"] : [])].map(
    (label) => label.length + CHIP_BRACKET_COLUMNS,
  );
  const fullRowWidth = chipWidths.reduce(
    (width, chipWidth, index) => width + chipWidth + (index > 0 ? CHIP_GAP : 0),
    0,
  );
  if (fullRowWidth <= contentWidth) return { mode: "full", rows: 1 };

  if (Math.max(...chipWidths) > contentWidth) return { mode: "short", rows: 1 };

  return { mode: "wrapped", rows: countWrappedRows(chipWidths, Math.max(contentWidth, 1)) };
}
