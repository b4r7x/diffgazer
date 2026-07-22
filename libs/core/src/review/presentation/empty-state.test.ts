import { describe, expect, it } from "vitest";
import {
  DETAILS_EMPTY_COPY,
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
    expect(Object.keys(DETAILS_EMPTY_COPY)).toEqual(["no-issues", "filter-empty", "no-selection"]);
  });

  it("keeps the shared no-diff copy", () => {
    expect(getNoChangesCopy("staged")).toMatchObject({
      title: "No Staged Changes",
      switchLabel: "Review Unstaged",
    });
    expect(getNoChangesCopy("unstaged")).toMatchObject({
      title: "No Unstaged Changes",
      switchLabel: "Review Staged",
    });
    expect(getNoChangesCopy("files")).toMatchObject({
      title: "No Changes in Selected Files",
      switchLabel: "Review Unstaged",
    });
    expect(Object.keys(NO_CHANGES_COPY)).toEqual(["staged", "unstaged", "files"]);
    expect(getAlternateReviewMode("staged")).toBe("unstaged");
    expect(getAlternateReviewMode("unstaged")).toBe("staged");
    expect(getAlternateReviewMode("files")).toBe("unstaged");
  });
});
