import { terminalCellWidth } from "../../../lib/terminal-width";

export const WIZARD_PROGRESS_MARKERS = {
  completed: "[x]",
  current: "[o]",
  upcoming: "[ ]",
} as const;

export function getFullProgressWidth(labels: readonly string[]): number {
  const markerWidth = terminalCellWidth(WIZARD_PROGRESS_MARKERS.current);
  const labelsWidth = labels.reduce(
    (width, label) => width + markerWidth + 1 + terminalCellWidth(label),
    0,
  );
  return labelsWidth + Math.max(labels.length - 1, 0) * 2;
}
