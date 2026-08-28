import { describe, expect, it } from "vitest";
import { selectDetailsEmptyKind } from "./details-empty.js";

describe("selectDetailsEmptyKind", () => {
  it("returns filter-empty when filtering removed every issue", () => {
    expect(selectDetailsEmptyKind(0)).toBe("filter-empty");
  });

  it("returns no-selection when issues remain but nothing is selected", () => {
    expect(selectDetailsEmptyKind(5)).toBe("no-selection");
    expect(selectDetailsEmptyKind(2)).toBe("no-selection");
  });
});
