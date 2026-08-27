import { describe, expect, test } from "vitest";
import { nextHistoryZone } from "./focus-zones";

describe("nextHistoryZone", () => {
  test("cycles search -> timeline -> runs -> insights -> search", () => {
    expect(nextHistoryZone("search")).toBe("timeline");
    expect(nextHistoryZone("timeline")).toBe("runs");
    expect(nextHistoryZone("runs")).toBe("insights");
    expect(nextHistoryZone("insights")).toBe("search");
  });
});
