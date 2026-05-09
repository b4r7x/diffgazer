import { describe, it, expect } from "vitest";
import { formatTime, formatTimestamp } from "./format.js";

describe("formatTime", () => {
  it.each([
    [0, undefined, "00:00"],
    [5000, undefined, "00:05"],
    [90_000, undefined, "01:30"],
    [3_661_000, undefined, "01:01"],
    [3_661_000, "long" as const, "01:01:01"],
    [0, "long" as const, "00:00:00"],
    [1000, undefined, "00:01"],
    [1000, "long" as const, "00:00:01"],
  ])("formats %dms as %s", (ms, format, expected) => {
    expect(formatTime(ms, format)).toBe(expected);
  });
});

describe("formatTimestamp", () => {
  it("keeps string timestamps and invalid date strings unchanged", () => {
    expect(formatTimestamp("10:30:00")).toBe("10:30:00");
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });

  it("formats Date objects to HH:MM:SS", () => {
    expect(formatTimestamp(new Date("2025-01-15T14:05:09Z"))).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
