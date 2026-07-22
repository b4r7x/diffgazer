import { describe, expect, it, vi } from "vitest";
import {
  formatDuration,
  formatRunId,
  formatTime,
  formatTimestamp,
  formatTimestampOrNA,
  getDateKey,
  getDateLabel,
  getTimestamp,
} from "./format.js";

const TIME_ZONES = ["UTC", "America/New_York", "Pacific/Kiritimati"] as const;

function inTimeZone(timeZone: string, run: () => void): void {
  const originalTimeZone = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    run();
  } finally {
    if (originalTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimeZone;
    }
  }
}

function localInstant(
  year: number,
  monthIndex: number,
  day: number,
  hour = 12,
  minute = 0,
  second = 0,
): string {
  return new Date(year, monthIndex, day, hour, minute, second).toISOString();
}

function withFrozenNow(timeZone: string, run: () => void): void {
  inTimeZone(timeZone, () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 9, 12, 0, 0));
    try {
      run();
    } finally {
      vi.useRealTimers();
    }
  });
}

describe("formatTime", () => {
  it.each([
    [0, undefined, "00:00"],
    [5000, undefined, "00:05"],
    [90_000, undefined, "01:30"],
    [3_661_000, undefined, "61:01"],
    [3_600_000, undefined, "60:00"],
    [7_261_000, undefined, "121:01"],
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

  it("formats Date objects to HH:MM:SS in local time", () => {
    expect(formatTimestamp(new Date(2025, 0, 15, 14, 5, 9))).toBe("14:05:09");
  });

  it("returns a stable string for an invalid Date object", () => {
    expect(formatTimestamp(new Date("invalid"))).toBe("Invalid Date");
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

describe.each(TIME_ZONES)("getDateKey (%s)", (timeZone) => {
  it("returns the local YYYY-MM-DD key of an ISO timestamp", () => {
    inTimeZone(timeZone, () => {
      expect(getDateKey(localInstant(2026, 1, 9, 18, 0, 0))).toBe("2026-02-09");
    });
  });

  it("keeps an existing date key as a calendar date instead of parsing it as UTC", () => {
    inTimeZone(timeZone, () => {
      expect(getDateKey("2026-02-09")).toBe("2026-02-09");
    });
  });

  it("returns an empty string for empty input", () => {
    inTimeZone(timeZone, () => {
      expect(getDateKey("")).toBe("");
    });
  });
});

describe.each(TIME_ZONES)("getDateLabel (%s)", (timeZone) => {
  it("labels today's date as Today", () => {
    withFrozenNow(timeZone, () => {
      expect(getDateLabel(localInstant(2026, 1, 9, 8, 0, 0))).toBe("Today");
    });
  });

  it("labels the previous calendar day as Yesterday", () => {
    withFrozenNow(timeZone, () => {
      expect(getDateLabel(localInstant(2026, 1, 8, 8, 0, 0))).toBe("Yesterday");
    });
  });

  it("falls back to a short month/day label for older dates", () => {
    withFrozenNow(timeZone, () => {
      expect(getDateLabel(localInstant(2026, 0, 15, 8, 0, 0))).toBe("Jan 15");
    });
  });

  it("formats a bare date key without shifting it through UTC", () => {
    withFrozenNow(timeZone, () => {
      expect(getDateLabel("2026-01-15")).toBe("Jan 15");
    });
  });

  it("includes the year when requested", () => {
    withFrozenNow(timeZone, () => {
      expect(getDateLabel(localInstant(2025, 0, 15, 8, 0, 0), { showYear: true })).toBe(
        "Jan 15, 2025",
      );
    });
  });
});

describe.each(TIME_ZONES)("getTimestamp (%s)", (timeZone) => {
  it("formats an afternoon timestamp in en-US 12-hour time", () => {
    inTimeZone(timeZone, () => {
      expect(getTimestamp(localInstant(2026, 1, 9, 14, 30, 0))).toBe("2:30 PM");
    });
  });

  it("formats a morning timestamp", () => {
    inTimeZone(timeZone, () => {
      expect(getTimestamp(localInstant(2026, 1, 9, 9, 5, 0))).toBe("9:05 AM");
    });
  });

  it("formats midnight boundary", () => {
    inTimeZone(timeZone, () => {
      expect(getTimestamp(localInstant(2026, 1, 9, 0, 0, 0))).toBe("12:00 AM");
    });
  });

  it("returns 'Invalid Date' for an unparseable date string", () => {
    inTimeZone(timeZone, () => {
      expect(getTimestamp("not-a-date")).toBe("Invalid Date");
    });
  });
});

describe("formatTimestampOrNA", () => {
  it("returns the fallback when the value is missing", () => {
    expect(formatTimestampOrNA(null)).toBe("N/A");
    expect(formatTimestampOrNA(undefined)).toBe("N/A");
    expect(formatTimestampOrNA("", "—")).toBe("—");
  });

  it("formats a present timestamp via the platform locale formatter", () => {
    const value = "2025-01-15T14:05:09Z";
    expect(formatTimestampOrNA(value)).toBe(new Date(value).toLocaleString());
  });
});

describe("formatRunId", () => {
  it("displays a short id with a leading hash", () => {
    expect(formatRunId("abcdef00-0000-4000-8000-000000000000")).toBe("#abcdef00");
  });

  it("extends colliding minimum prefixes until each loaded run is unique", () => {
    const ids = ["abcdef00-0000-4000-8000-000000000000", "abcdef00-1000-4000-8000-000000000000"];

    expect(formatRunId(ids[0] ?? "", ids)).toBe("#abcdef00-0");
    expect(formatRunId(ids[1] ?? "", ids)).toBe("#abcdef00-1");
  });

  it("treats peer ids as case-insensitive when detecting a collision", () => {
    const ids = ["ABCDEF00-0000-4000-8000-000000000000", "abcdef00-1000-4000-8000-000000000000"];

    expect(formatRunId(ids[0] ?? "", ids)).not.toBe(formatRunId(ids[1] ?? "", ids));
  });
});
