import { describe, expect, it } from "vitest";
import { getReviewResultsFooter } from "./use-review-results-keyboard";

describe("getReviewResultsFooter", () => {
  it("returns list shortcuts with back hint", () => {
    const footer = getReviewResultsFooter("list", false);

    expect(footer.shortcuts).toEqual([
      { key: "j/k", label: "Select Issue" },
      { key: "→", label: "Issue Details" },
    ]);
    expect(footer.rightShortcuts).toEqual([{ key: "Esc", label: "Back" }]);
  });

  it("returns filter-only shortcuts in filter zone", () => {
    const footer = getReviewResultsFooter("filters", false);

    expect(footer.shortcuts).toEqual([
      { key: "←/→", label: "Move Filter" },
      { key: "Enter/Space", label: "Toggle Filter" },
      { key: "j", label: "Issue List" },
    ]);
    expect(footer.rightShortcuts).toEqual([{ key: "Esc", label: "Back" }]);
  });

  it("adapts tab range based on patch availability", () => {
    expect(getReviewResultsFooter("details", false).shortcuts[0]).toEqual({
      key: "1-3",
      label: "Switch Tab",
    });
    expect(getReviewResultsFooter("details", true).shortcuts[0]).toEqual({
      key: "1-4",
      label: "Switch Tab",
    });
    expect(getReviewResultsFooter("details", false).rightShortcuts).toEqual([
      { key: "Esc", label: "Back" },
    ]);
  });
});
