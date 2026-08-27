import { describe, expect, it } from "vitest";
import { getAlternateReviewMode, getDetailsEmptyCopy, getNoChangesCopy } from "./empty-state.js";

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

  // Literal expectations, not the production map: a swapped or emptied no-diff
  // entry must fail here rather than move the oracle with the defect.
  it("keeps the shared no-diff copy for every mode", () => {
    expect(getNoChangesCopy("staged")).toEqual({
      title: "No Staged Changes",
      message:
        "No staged changes found. Use 'git add' to stage files, or review unstaged changes instead.",
      switchLabel: "Review Unstaged",
    });
    expect(getNoChangesCopy("unstaged")).toEqual({
      title: "No Unstaged Changes",
      message:
        "No unstaged changes found. Make some edits first, or review staged changes instead.",
      switchLabel: "Review Staged",
    });
    expect(getNoChangesCopy("files")).toEqual({
      title: "No Changes in Selected Files",
      message:
        "No changes found in the selected files. Make some edits first, or select different files.",
      switchLabel: "Review Unstaged",
    });
  });

  it("keeps alternate review modes for every no-diff mode", () => {
    expect(getAlternateReviewMode("staged")).toBe("unstaged");
    expect(getAlternateReviewMode("unstaged")).toBe("staged");
    expect(getAlternateReviewMode("files")).toBe("unstaged");
  });
});
