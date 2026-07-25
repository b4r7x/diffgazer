import { Box, Text } from "ink";
import type { ReactElement } from "react";

export const MIN_TERMINAL_COLUMNS = 40;
export const MIN_TERMINAL_ROWS = 12;

export function isTerminalTooSmall(columns: number, rows: number): boolean {
  return columns < MIN_TERMINAL_COLUMNS || rows < MIN_TERMINAL_ROWS;
}

/** Fills the terminal with the resize instruction, replacing the app frame. */
export function TerminalTooSmall({
  columns,
  rows,
}: {
  columns: number;
  rows: number;
}): ReactElement {
  return (
    <Box width={columns} height={rows} justifyContent="center" alignItems="center">
      <Text>
        Terminal too small ({columns} columns x {rows} rows). Minimum: {MIN_TERMINAL_COLUMNS}{" "}
        columns x {MIN_TERMINAL_ROWS} rows.
      </Text>
    </Box>
  );
}
