import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDateLabel, formatDuration, buildTimelineItems, getDateKey } from "./utils";
import type { ReviewMetadata } from "@stargazer/schemas/review";

function makeReview(createdAt: string): ReviewMetadata {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    projectPath: "/test",
    createdAt,
    mode: "staged",
    branch: "main",
    profile: null,
    lenses: ["correctness"],
    issueCount: 0,
    blockerCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    nitCount: 0,
    fileCount: 1,
  } as ReviewMetadata;
}

describe("getDateLabel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "Today" for today\'s date', () => {
    expect(getDateLabel("2025-06-15T10:00:00Z")).toBe("Today");
  });

  it('should return "Yesterday" for yesterday\'s date', () => {
    expect(getDateLabel("2025-06-14T10:00:00Z")).toBe("Yesterday");
  });

  it("should return formatted date for older dates", () => {
    const result = getDateLabel("2025-06-10T10:00:00Z");
    expect(result).toContain("Jun");
    expect(result).toContain("10");
  });
});

describe("getDateKey", () => {
  it("should extract date portion from ISO string", () => {
    expect(getDateKey("2025-06-15T10:30:00Z")).toBe("2025-06-15");
  });
});

describe("formatDuration", () => {
  it("should return -- for null", () => {
    expect(formatDuration(null)).toBe("--");
  });

  it("should return -- for undefined", () => {
    expect(formatDuration(undefined)).toBe("--");
  });

  it("should return -- for 0", () => {
    expect(formatDuration(0)).toBe("--");
  });

  it("should format milliseconds for sub-second durations", () => {
    expect(formatDuration(500)).toBe("500ms");
  });

  it("should format seconds with one decimal", () => {
    expect(formatDuration(5200)).toBe("5.2s");
  });

  it("should format minutes and seconds", () => {
    expect(formatDuration(125000)).toBe("2m 5s");
  });

  it("should handle exact minute boundaries", () => {
    expect(formatDuration(60000)).toBe("1m 0s");
  });
});

describe("buildTimelineItems", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return empty array for no reviews", () => {
    expect(buildTimelineItems([])).toEqual([]);
  });

  it("should group reviews by date", () => {
    const reviews = [
      makeReview("2025-06-15T10:00:00Z"),
      makeReview("2025-06-15T11:00:00Z"),
      makeReview("2025-06-14T09:00:00Z"),
    ];
    const items = buildTimelineItems(reviews);
    expect(items).toHaveLength(2);
  });

  it("should sort groups newest first", () => {
    const reviews = [
      makeReview("2025-06-13T10:00:00Z"),
      makeReview("2025-06-15T10:00:00Z"),
      makeReview("2025-06-14T10:00:00Z"),
    ];
    const items = buildTimelineItems(reviews);
    expect(items[0]?.id).toBe("2025-06-15");
    expect(items[1]?.id).toBe("2025-06-14");
    expect(items[2]?.id).toBe("2025-06-13");
  });

  it("should count reviews per group", () => {
    const reviews = [
      makeReview("2025-06-15T10:00:00Z"),
      makeReview("2025-06-15T11:00:00Z"),
      makeReview("2025-06-15T12:00:00Z"),
    ];
    const items = buildTimelineItems(reviews);
    expect(items[0]?.count).toBe(3);
  });

  it("should use date labels", () => {
    const reviews = [makeReview("2025-06-15T10:00:00Z")];
    const items = buildTimelineItems(reviews);
    expect(items[0]?.label).toBe("Today");
  });
});
