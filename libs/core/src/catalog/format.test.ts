import { describe, expect, it } from "vitest";
import { formatContextTokens } from "./format.js";

describe("formatContextTokens", () => {
  it("formats a >=1M window in millions, trimming a trailing .0", () => {
    expect(formatContextTokens(1_048_576)).toBe("1M");
    expect(formatContextTokens(2_000_000)).toBe("2M");
  });

  it("keeps one decimal for non-round millions", () => {
    expect(formatContextTokens(1_500_000)).toBe("1.5M");
  });

  it("formats sub-million windows in rounded thousands", () => {
    expect(formatContextTokens(131_072)).toBe("131K");
    expect(formatContextTokens(204_800)).toBe("205K");
  });

  it("promotes to '1M' once the rounded-K value would reach 1000 (no '1000K' label)", () => {
    expect(formatContextTokens(980_000)).toBe("980K");
    expect(formatContextTokens(999_499)).toBe("999K");
    expect(formatContextTokens(999_500)).toBe("1M");
  });
});
