import { describe, expect, it } from "vitest";
import { buildLcsTable, lcsTableCellCost } from "./lcs";

describe("buildLcsTable", () => {
  it("builds a table sized one larger than each input on each axis", () => {
    const dp = buildLcsTable(["a", "b"], ["a", "c"]);
    if (!dp) throw new Error("expected table");
    expect(dp).toHaveLength(3);
    expect(dp[0]).toHaveLength(3);
  });

  it("reports the longest common subsequence length in the final cell", () => {
    const a = ["a", "b", "c"];
    const b = ["a", "x", "c"];
    const dp = buildLcsTable(a, b);
    if (!dp) throw new Error("expected table");
    expect(dp[a.length]?.[b.length]).toBe(2);
  });

  it("returns 0 length for fully disjoint sequences", () => {
    const dp = buildLcsTable(["a", "b"], ["x", "y"]);
    if (!dp) throw new Error("expected table");
    expect(dp[2]?.[2]).toBe(0);
  });

  it("returns null when the table would exceed the cell budget", () => {
    const big = Array.from({ length: 501 }, (_, i) => String(i));
    expect(buildLcsTable(big, big)).toBeNull();
  });

  it("returns null for a degenerate axis whose true cell cost still exceeds 250,000", () => {
    const big = Array.from({ length: 250_000 }, (_, i) => String(i));
    // a.length is 0, so the raw a.length * b.length estimate is 0 and would slip past the
    // budget check; the real (0 + 1) * (250_000 + 1) table exceeds the 250,000 cell cap.
    expect(buildLcsTable([], big)).toBeNull();
  });
});

describe("lcsTableCellCost", () => {
  it("returns (leftLength + 1) * (rightLength + 1), the exact cost debited from a word-diff budget", () => {
    expect(lcsTableCellCost(0, 0)).toBe(1);
    expect(lcsTableCellCost(2, 3)).toBe(12);
    expect(lcsTableCellCost(0, 250_000)).toBe(250_001);
  });
});
