const MAX_LCS_CELLS = 250_000;

/** Builds an LCS table, returning null when the input would exceed the cell budget. */
export function buildLcsTable(a: string[], b: string[]): number[][] | null {
  if (a.length * b.length > MAX_LCS_CELLS) {
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
