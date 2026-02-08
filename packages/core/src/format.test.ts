import { describe, it, expect } from "vitest";
import { formatTime, formatTimestamp } from "./format.js";

describe("formatTime", () => {
  it("formats 0ms as 00:00", () => {
    expect(formatTime(0)).toBe("00:00");
  });

  it("formats seconds correctly", () => {
    expect(formatTime(5000)).toBe("00:05");
  });

  it("formats minutes and seconds", () => {
    expect(formatTime(90_000)).toBe("01:30");
  });

  it("wraps at 60 minutes in short format", () => {
    // 3661 seconds = 1h 1m 1s, short format only shows mm:ss
    expect(formatTime(3_661_000)).toBe("01:01");
  });

  it("formats long format with hours", () => {
    expect(formatTime(3_661_000, "long")).toBe("01:01:01");
  });

  it("formats 0ms in long format as 00:00:00", () => {
    expect(formatTime(0, "long")).toBe("00:00:00");
  });

  it("pads single digits with leading zeros", () => {
    expect(formatTime(1000)).toBe("00:01");
    expect(formatTime(1000, "long")).toBe("00:00:01");
  });
});

describe("formatTimestamp", () => {
  it("returns string timestamps unchanged", () => {
    expect(formatTimestamp("10:30:00")).toBe("10:30:00");
  });

  it("formats Date objects to HH:MM:SS", () => {
    const date = new Date("2025-01-15T14:05:09Z");
    const result = formatTimestamp(date);
    // Result depends on local timezone, just check format
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("should return invalid date string unchanged", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });
});
