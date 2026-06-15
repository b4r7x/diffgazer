import { describe, expect, it } from "vitest";
import { getSearchStatusView } from "./dialog";

describe("getSearchStatusView", () => {
  it("returns the error message with error severity for search errors", () => {
    expect(getSearchStatusView(true, "error", "Search failed. Try again.")).toEqual({
      message: "Search failed. Try again.",
      severity: "error",
    });
  });
});
