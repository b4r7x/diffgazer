import { describe, expect, it } from "vitest";
import {
  getAlternateReviewMode,
  getDetailsEmptyCopy,
  getNoChangesCopy,
  NO_CHANGES_COPY,
} from "./empty-state.js";

describe("review empty-state presentation", () => {
  it("keeps the shared issue-details empty copy", () => {
    expect(getDetailsEmptyCopy("no-issues")).toEqual({
      title: "No issues in this review",
      description: "This analysis passed without issues.",
    });
    expect(getDetailsEmptyCopy("filter-empty")).toEqual({
      title: "No issues match this filter",
      description: "Choose another severity to continue.",
    });
    expect(getDetailsEmptyCopy("no-selection")).toEqual({
      title: "Select an issue to view details",
    });
  });

  it.each([
    ["staged", NO_CHANGES_COPY.staged],
    ["unstaged", NO_CHANGES_COPY.unstaged],
    ["files", NO_CHANGES_COPY.files],
  ] as const)("keeps the shared no-diff copy for %s mode", (mode, expected) => {
    expect(getNoChangesCopy(mode)).toEqual(expected);
  });

  it("keeps alternate review modes for every no-diff mode", () => {
    expect(getAlternateReviewMode("staged")).toBe("unstaged");
    expect(getAlternateReviewMode("unstaged")).toBe("staged");
    expect(getAlternateReviewMode("files")).toBe("unstaged");
  });
});
