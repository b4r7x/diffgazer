import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatDuration,
  formatTime,
  formatTimestamp,
  formatTimestampOrNA,
  getDateKey,
  getDateLabel,
} from "./format.js";

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

describe("formatDuration", () => {
  it.each([
    [null, "--"],
    [undefined, "--"],
    [0, "0ms"],
    [250, "250ms"],
    [5300, "5.3s"],
    [59_999, "59.9s"],
    [60_000, "1m 0s"],
    [125_500, "2m 5s"],
  ])("formats %j as %j", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe("getDateKey", () => {
  it("returns the first ten chars (YYYY-MM-DD) of an ISO date string", () => {
    expect(getDateKey("2026-02-09T18:00:00.000Z")).toBe("2026-02-09");
  });

  it("returns an empty string for empty input", () => {
    expect(getDateKey("")).toBe("");
  });
});

describe("getDateLabel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-09T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("labels today's date as Today", () => {
    expect(getDateLabel("2026-02-09T08:00:00.000Z")).toBe("Today");
  });

  it("labels the previous calendar day as Yesterday", () => {
    expect(getDateLabel("2026-02-08T08:00:00.000Z")).toBe("Yesterday");
  });

  it("falls back to a short month/day label for older dates", () => {
    expect(getDateLabel("2026-01-15T08:00:00.000Z")).toMatch(/^Jan\s+15$/);
  });

  it("includes the year when requested", () => {
    expect(getDateLabel("2025-01-15T08:00:00.000Z", { showYear: true })).toMatch(
      /^Jan\s+15,\s+2025$/,
    );
  });
});

describe("formatTimestampOrNA", () => {
  it("returns the fallback when the value is missing", () => {
    expect(formatTimestampOrNA(null)).toBe("N/A");
    expect(formatTimestampOrNA(undefined)).toBe("N/A");
    expect(formatTimestampOrNA("", "—")).toBe("—");
  });

  it("formats a present timestamp via the platform locale formatter", () => {
    expect(formatTimestampOrNA("2025-01-15T14:05:09Z")).not.toBe("N/A");
  });
});
