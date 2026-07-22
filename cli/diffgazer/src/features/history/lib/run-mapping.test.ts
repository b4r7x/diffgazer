import { describe, expect, test } from "vitest";
import { HISTORY_ZONE_ORDER, nextHistoryZone } from "./run-mapping";

describe("nextHistoryZone", () => {
  test("cycles search -> timeline -> runs -> insights -> search", () => {
    expect(nextHistoryZone("search")).toBe("timeline");
    expect(nextHistoryZone("timeline")).toBe("runs");
    expect(nextHistoryZone("runs")).toBe("insights");
    expect(nextHistoryZone("insights")).toBe("search");
  });

  test("zone order list contains all four zones", () => {
    expect(HISTORY_ZONE_ORDER).toEqual(["search", "timeline", "runs", "insights"]);
  });
});
