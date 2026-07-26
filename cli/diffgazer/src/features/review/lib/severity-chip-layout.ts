export type SeverityChipMode = "full" | "wrapped" | "short";

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
 * Readable chips are worth a second row: the row wraps before it collapses to
 * single letters, so the cryptic codes survive only where one whole chip cannot
 * fit on a line.
 */
export function getSeverityChipLayout({
  labels,
  hasReset,
  contentWidth,
}: SeverityChipLayoutInput): SeverityChipLayout {
  const chips = [...labels, ...(hasReset ? ["Reset"] : [])];
  const fullRowWidth = chips.reduce(
    (width, label, index) => width + label.length + 2 + (index > 0 ? 1 : 0),
    0,
  );
  if (fullRowWidth <= contentWidth) return { mode: "full", rows: 1 };

  const widestChip = Math.max(...chips.map((label) => label.length + 2));
  if (widestChip > contentWidth) return { mode: "short", rows: 1 };

  return { mode: "wrapped", rows: Math.ceil(fullRowWidth / Math.max(contentWidth, 1)) };
}
