import { wrappedRowCount } from "../../../lib/terminal-width";

/** Callout chrome around its text: the margin above it plus its two border rows. */
export const CALLOUT_CHROME_ROWS = 3;
/** Columns the callout spends per row: border, horizontal padding, icon and its gap. */
export const CALLOUT_CHROME_COLUMNS = 6;

/** Rows `text` occupies inside the callout, honouring the newlines the sanitizer keeps. */
export function calloutTextRows(text: string, columns: number): number {
  return text.split("\n").reduce((rows, line) => rows + wrappedRowCount(line, columns), 0);
}
