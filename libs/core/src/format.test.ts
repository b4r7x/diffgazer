import { describe, expect, it, vi } from "vitest";
import {
  buildRunIdLookup,
  formatDuration,
  formatLocaleDateTimeOrFallback,
  formatRunId,
  formatTime,
  formatTimestamp,
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
    [0, "00:00"],
    [5000, "00:05"],
    [90_000, "01:30"],
    [3_661_000, "61:01"],
    [3_600_000, "60:00"],
    [7_261_000, "121:01"],
    [1000, "00:01"],
  ])("formats %dms as %s", (ms, expected) => {
    expect(formatTime(ms)).toBe(expected);
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
    [0, "<1s"],
    [250, "<1s"],
    [999, "<1s"],
    [1000, "1s"],
    [5300, "5s"],
    [59_999, "59s"],
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

  it("formats noon boundary", () => {
    inTimeZone(timeZone, () => {
      expect(getTimestamp(localInstant(2026, 1, 9, 12, 0, 0))).toBe("12:00 PM");
    });
  });

  it("returns 'Invalid Date' for an unparseable date string", () => {
    inTimeZone(timeZone, () => {
      expect(getTimestamp("not-a-date")).toBe("Invalid Date");
    });
  });
});

describe("formatLocaleDateTimeOrFallback", () => {
  it("returns the fallback when the value is missing", () => {
    expect(formatLocaleDateTimeOrFallback(null)).toBe("N/A");
    expect(formatLocaleDateTimeOrFallback(undefined)).toBe("N/A");
    expect(formatLocaleDateTimeOrFallback("", "—")).toBe("—");
  });

  it("formats a present timestamp via the platform locale formatter", () => {
    inTimeZone("UTC", () => {
      const formatted = formatLocaleDateTimeOrFallback("2025-01-15T14:05:09Z");
      expect(formatted).not.toBe("N/A");
      expect(formatted).toContain("2025");
      expect(formatted).toMatch(/2:05:09|14:05:09/);
    });
  });

  it("ignores a custom fallback when the value is present", () => {
    inTimeZone("UTC", () => {
      expect(formatLocaleDateTimeOrFallback("2025-01-15T14:05:09Z", "—")).not.toBe("—");
    });
  });
});

describe("formatRunId", () => {
  it("displays a short id with a leading hash", () => {
    expect(formatRunId("abcdef00-0000-4000-8000-000000000000")).toBe("#abcdef00");
  });
});

describe("buildRunIdLookup", () => {
  it("labels every run in a batch with its shortest unique prefix", () => {
    const ids = [
      "abcdef00-0000-4000-8000-000000000000",
      "abcdef00-1000-4000-8000-000000000000",
      "fedcba99-2000-4000-8000-000000000000",
    ];
    const lookup = buildRunIdLookup(ids);

    expect(ids.map((id) => lookup.get(id))).toEqual(["#abcdef00-0", "#abcdef00-1", "#fedcba99"]);
  });

  it("treats peer ids as case-insensitive when detecting a collision", () => {
    const ids = ["ABCDEF00-0000-4000-8000-000000000000", "abcdef00-1000-4000-8000-000000000000"];
    const lookup = buildRunIdLookup(ids);

    expect(lookup.get(ids[0] ?? "")).toBe("#ABCDEF00-0");
    expect(lookup.get(ids[1] ?? "")).toBe("#abcdef00-1");
  });

  it("keeps every label distinct across realistic history sizes", () => {
    for (const size of [50, 500, 1000]) {
      const ids = Array.from({ length: size }, (_, index) => {
        const suffix = index.toString().padStart(4, "0");
        return `abcdef00-${suffix}-4000-8000-000000000000`;
      });

      const lookup = buildRunIdLookup(ids);
      const labels = ids.map((id) => lookup.get(id));

      expect(lookup.size, `size ${size}`).toBe(size);
      expect(new Set(labels).size, `size ${size}`).toBe(size);
    }
  });
});
