import { describe, expect, it } from "vitest";
import { buildLcsTable } from "./lcs";

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
});
