import {
  HISTORY_SECTION_ALL_ID,
  resolveSelectedDateId,
  resolveSelectedId,
} from "@diffgazer/core/review";
import { describe, expect, it } from "vitest";
import type { Run } from "@/features/history/types";

function makeRun(id: string): Run {
  return {
    id,
    displayId: `#${id}`,
    branch: "Main",
    timestamp: "Today",
    summary: "Passed",
  };
}

describe("history selection resolution", () => {
  it("derives a valid date without mutating route state", () => {
    const timelineItems = [
      { id: HISTORY_SECTION_ALL_ID, label: "All", count: 2 },
      { id: "2026-02-09", label: "Feb 9", count: 1 },
    ];

    expect(resolveSelectedDateId("2026-02-09", timelineItems)).toBe("2026-02-09");
    expect(resolveSelectedDateId("missing", timelineItems)).toBe(HISTORY_SECTION_ALL_ID);
  });

  it("derives a valid run from the filtered run list", () => {
    const runs = [makeRun("run-a"), makeRun("run-b")];

    expect(resolveSelectedId("run-b", runs)).toBe("run-b");
    expect(resolveSelectedId("missing", runs)).toBe("run-a");
    expect(resolveSelectedId("missing", [])).toBeNull();
  });
});
