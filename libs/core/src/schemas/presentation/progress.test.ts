import { describe, expect, it } from "vitest";
import { buildReviewMetricsRows } from "./progress.js";

describe("buildReviewMetricsRows", () => {
  it("formats known and pending prompt totals with shared metric labels", () => {
    expect(
      buildReviewMetricsRows({ filesProcessed: 3, filesTotal: 12, issuesFound: 2 }, "00:42"),
    ).toEqual([
      { id: "files-in-prompt", label: "Files in Prompt", value: "3/12", tone: "default" },
      { id: "issues-found", label: "Issues Found", value: 2, tone: "warning" },
      { id: "elapsed", label: "Elapsed", value: "00:42", tone: "info" },
    ]);

    expect(
      buildReviewMetricsRows({ filesProcessed: 3, filesTotal: 0, issuesFound: 0 }, "00:01")[0],
    ).toMatchObject({ value: "3/..." });
  });

  it("keeps the issue count unemphasized until an issue lands", () => {
    const [, issues] = buildReviewMetricsRows(
      { filesProcessed: 3, filesTotal: 12, issuesFound: 0 },
      "00:42",
    );

    expect(issues).toMatchObject({ value: 0, tone: "default" });
  });
});
