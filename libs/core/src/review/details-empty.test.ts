import { describe, expect, it } from "vitest";
import { selectDetailsEmptyKind } from "./details-empty.js";

describe("selectDetailsEmptyKind", () => {
  it("returns no-issues when the source list is empty", () => {
    expect(selectDetailsEmptyKind(0, 0)).toBe("no-issues");
  });

  it("returns filter-empty when filtering removed every issue", () => {
    expect(selectDetailsEmptyKind(5, 0)).toBe("filter-empty");
  });

  it("returns no-selection when issues remain but nothing is selected", () => {
    expect(selectDetailsEmptyKind(5, 5)).toBe("no-selection");
    expect(selectDetailsEmptyKind(5, 2)).toBe("no-selection");
  });
});
