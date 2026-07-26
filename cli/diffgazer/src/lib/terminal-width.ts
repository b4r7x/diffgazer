import stringWidth from "string-width";

export const terminalCellWidth = stringWidth;

/** Rows `text` occupies once wrapped to `width` cells. */
export function wrappedRowCount(text: string, width: number): number {
  return Math.max(Math.ceil(terminalCellWidth(text) / Math.max(width, 1)), 1);
}
