const MAX_LCS_CELLS = 250_000;

/**
 * Actual allocated LCS table cell count for a pair of sequence lengths: the table has
 * `leftLength + 1` rows and `rightLength + 1` columns. Using the raw lengths (without the +1)
 * underestimates the cost whenever either axis is small, letting a degenerate table (e.g. one
 * near-empty side paired with a huge other side) slip past the budget check.
 */
export function lcsTableCellCost(leftLength: number, rightLength: number): number {
  return (leftLength + 1) * (rightLength + 1);
}

/** Builds an LCS table, returning null when the input would exceed the cell budget. */
export function buildLcsTable(a: string[], b: string[]): number[][] | null {
  if (lcsTableCellCost(a.length, b.length) > MAX_LCS_CELLS) {
    return null;
  }

  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    const row = dp[i];
    const prevRow = dp[i - 1];
    if (!row || !prevRow) continue;
    for (let j = 1; j <= n; j++) {
      const prevCell = row[j - 1] ?? 0;
      const upLeft = prevRow[j - 1] ?? 0;
      const up = prevRow[j] ?? 0;
      row[j] = a[i - 1] === b[j - 1] ? upLeft + 1 : Math.max(up, prevCell);
    }
  }
  return dp;
}
