import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { formatRelativeTime, getScoreColor } from "./format";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns minutes for times less than 1 hour ago", () => {
    const now = new Date("2026-01-24T12:00:00Z");
    vi.setSystemTime(now);

    const thirtyMinsAgo = new Date("2026-01-24T11:30:00Z").toISOString();
    expect(formatRelativeTime(thirtyMinsAgo)).toBe("30m ago");

    const fiveMinsAgo = new Date("2026-01-24T11:55:00Z").toISOString();
    expect(formatRelativeTime(fiveMinsAgo)).toBe("5m ago");

    const oneMinAgo = new Date("2026-01-24T11:59:00Z").toISOString();
    expect(formatRelativeTime(oneMinAgo)).toBe("1m ago");
  });

  it("returns hours for times less than 24 hours ago", () => {
    const now = new Date("2026-01-24T12:00:00Z");
    vi.setSystemTime(now);

    const twoHoursAgo = new Date("2026-01-24T10:00:00Z").toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe("2h ago");

    const twelveHoursAgo = new Date("2026-01-24T00:00:00Z").toISOString();
    expect(formatRelativeTime(twelveHoursAgo)).toBe("12h ago");

    const twentyThreeHoursAgo = new Date("2026-01-23T13:00:00Z").toISOString();
    expect(formatRelativeTime(twentyThreeHoursAgo)).toBe("23h ago");
  });

  it("returns days for times 24+ hours ago", () => {
    const now = new Date("2026-01-24T12:00:00Z");
    vi.setSystemTime(now);

    const twoDaysAgo = new Date("2026-01-22T12:00:00Z").toISOString();
    expect(formatRelativeTime(twoDaysAgo)).toBe("2d ago");

    const sevenDaysAgo = new Date("2026-01-17T12:00:00Z").toISOString();
    expect(formatRelativeTime(sevenDaysAgo)).toBe("7d ago");

    const thirtyDaysAgo = new Date("2025-12-25T12:00:00Z").toISOString();
    expect(formatRelativeTime(thirtyDaysAgo)).toBe("30d ago");
  });

  it("handles boundary at exactly 60 minutes", () => {
    const now = new Date("2026-01-24T12:00:00Z");
    vi.setSystemTime(now);

    const exactlyOneHourAgo = new Date("2026-01-24T11:00:00Z").toISOString();
    expect(formatRelativeTime(exactlyOneHourAgo)).toBe("1h ago");
  });

  it("handles boundary at exactly 24 hours", () => {
    const now = new Date("2026-01-24T12:00:00Z");
    vi.setSystemTime(now);

    const exactlyOneDayAgo = new Date("2026-01-23T12:00:00Z").toISOString();
    expect(formatRelativeTime(exactlyOneDayAgo)).toBe("1d ago");
  });

  it("handles just under 60 minutes boundary", () => {
    const now = new Date("2026-01-24T12:00:00Z");
    vi.setSystemTime(now);

    const fiftyNineMinsAgo = new Date("2026-01-24T11:01:00Z").toISOString();
    expect(formatRelativeTime(fiftyNineMinsAgo)).toBe("59m ago");
  });

  it("handles just under 24 hours boundary", () => {
    const now = new Date("2026-01-24T12:00:00Z");
    vi.setSystemTime(now);

    const twentyThreeHours59MinsAgo = new Date(
      "2026-01-23T12:01:00Z"
    ).toISOString();
    expect(formatRelativeTime(twentyThreeHours59MinsAgo)).toBe("23h ago");
  });
});

describe("getScoreColor", () => {
  it("returns gray for null score", () => {
    expect(getScoreColor(null)).toBe("gray");
  });

  it("returns green for scores >= 8", () => {
    expect(getScoreColor(8)).toBe("green");
    expect(getScoreColor(9)).toBe("green");
    expect(getScoreColor(10)).toBe("green");
  });

  it("returns yellow for scores between 5 and 7", () => {
    expect(getScoreColor(5)).toBe("yellow");
    expect(getScoreColor(6)).toBe("yellow");
    expect(getScoreColor(7)).toBe("yellow");
  });

  it("returns red for scores < 5", () => {
    expect(getScoreColor(0)).toBe("red");
    expect(getScoreColor(2)).toBe("red");
    expect(getScoreColor(4)).toBe("red");
  });

  it("handles boundary at exactly 8", () => {
    expect(getScoreColor(8)).toBe("green");
    expect(getScoreColor(7.99)).toBe("yellow");
  });

  it("handles boundary at exactly 5", () => {
    expect(getScoreColor(5)).toBe("yellow");
    expect(getScoreColor(4.99)).toBe("red");
  });

  it("handles decimal scores", () => {
    expect(getScoreColor(8.5)).toBe("green");
    expect(getScoreColor(6.5)).toBe("yellow");
    expect(getScoreColor(3.5)).toBe("red");
  });

  it("handles extreme values", () => {
    expect(getScoreColor(100)).toBe("green");
    expect(getScoreColor(-10)).toBe("red");
  });
});
