import { describe, expect, it } from "vitest";
import { buildRunIdLookup } from "../../format.js";
import {
  buildHistoryWarningMessages,
  getHistoryWarningTargetIds,
  summarizeHistoryWarnings,
} from "./warnings.js";

const NO_WARNINGS = {
  unreadableReviewCount: 0,
  unreadableReviewIds: [],
  droppedIssueCount: 0,
  droppedIssueReviewIds: [],
  droppedExecutionReviewIds: [],
  indexBuildFailed: false,
  indexRewriteFailed: false,
};

describe("summarizeHistoryWarnings", () => {
  it("separates unreadable records from salvage loss", () => {
    expect(
      summarizeHistoryWarnings([
        {
          kind: "unreadable_review",
          reviewId: "11111111-1111-4111-8111-111111111111",
        },
        {
          kind: "invalid_issues_dropped",
          reviewId: "22222222-2222-4222-8222-222222222222",
          count: 2,
        },
        {
          kind: "invalid_issues_dropped",
          reviewId: "33333333-3333-4333-8333-333333333333",
          count: 1,
        },
      ]),
    ).toEqual({
      ...NO_WARNINGS,
      unreadableReviewCount: 1,
      unreadableReviewIds: ["11111111-1111-4111-8111-111111111111"],
      droppedIssueCount: 3,
      droppedIssueReviewIds: [
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
      ],
    });
  });

  it("keeps a dropped execution record apart from dropped issues", () => {
    expect(
      summarizeHistoryWarnings([
        {
          kind: "invalid_execution_dropped",
          reviewId: "55555555-5555-4555-8555-555555555555",
        },
      ]),
    ).toEqual({
      ...NO_WARNINGS,
      droppedExecutionReviewIds: ["55555555-5555-4555-8555-555555555555"],
    });
  });

  // Rebuild and cleanup fail independently in storage, so each flag is asserted
  // on its own: a swapped assignment cannot hide behind the other one.
  it("raises only the build flag for an index build failure", () => {
    expect(summarizeHistoryWarnings([{ kind: "index_build_failed" }])).toEqual({
      ...NO_WARNINGS,
      indexBuildFailed: true,
    });
  });

  it("raises only the rewrite flag for an index rewrite failure", () => {
    expect(summarizeHistoryWarnings([{ kind: "index_rewrite_failed" }])).toEqual({
      ...NO_WARNINGS,
      indexRewriteFailed: true,
    });
  });
});

describe("getHistoryWarningTargetIds", () => {
  it("lists every affected run once across unreadable, salvaged, and execution-dropped runs", () => {
    expect(
      getHistoryWarningTargetIds({
        ...NO_WARNINGS,
        unreadableReviewCount: 1,
        unreadableReviewIds: ["11111111-1111-4111-8111-111111111111"],
        droppedIssueCount: 2,
        droppedIssueReviewIds: [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
        ],
        droppedExecutionReviewIds: [
          "22222222-2222-4222-8222-222222222222",
          "55555555-5555-4555-8555-555555555555",
        ],
      }),
    ).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "55555555-5555-4555-8555-555555555555",
    ]);
  });

  it("is empty when only index maintenance failed", () => {
    expect(getHistoryWarningTargetIds({ ...NO_WARNINGS, indexBuildFailed: true })).toEqual([]);
  });
});

describe("buildHistoryWarningMessages", () => {
  it.each([20, 50])("keeps every warning target in web copy for %d ids", (count) => {
    const ids = Array.from(
      { length: count },
      (_, index) => `${index.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`,
    );
    const message = buildHistoryWarningMessages({
      ...NO_WARNINGS,
      unreadableReviewCount: count,
      unreadableReviewIds: ids,
    })[0];

    if (!message) throw new Error("Expected an unreadable-review warning");
    for (const id of ids) {
      expect(message).toContain(`#${id.slice(0, 8)}`);
    }
  });

  it("bounds terminal warning copy while retaining the hidden target count", () => {
    const ids = Array.from(
      { length: 50 },
      (_, index) => `${index.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`,
    );
    const message = buildHistoryWarningMessages(
      {
        ...NO_WARNINGS,
        unreadableReviewCount: ids.length,
        unreadableReviewIds: ids,
      },
      buildRunIdLookup(ids),
      { maxTargetIds: 3 },
    )[0];

    expect(message).toContain("… +47 more");
    expect(message).toContain("#00000000");
    expect(message).toContain("#00000001");
    expect(message).toContain("#00000002");
    expect(message).not.toContain("#00000003");
  });

  it("builds all warning messages with singular grammar", () => {
    expect(
      buildHistoryWarningMessages({
        unreadableReviewCount: 1,
        unreadableReviewIds: ["11111111-1111-4111-8111-111111111111"],
        droppedIssueCount: 1,
        droppedIssueReviewIds: ["22222222-2222-4222-8222-222222222222"],
        droppedExecutionReviewIds: ["55555555-5555-4555-8555-555555555555"],
        indexBuildFailed: true,
        indexRewriteFailed: true,
      }),
    ).toEqual([
      "1 saved review (#11111111) could not be read.",
      "1 invalid saved issue was omitted from #22222222. Re-run the affected reviews for complete results.",
      "Execution details for 1 saved review (#55555555) could not be read. Re-run the affected reviews to restore the outcome and trace.",
      "The history index could not be rebuilt. Readable reviews are still shown; reopen History to retry.",
      "The history index could not be cleaned up. Readable reviews are still shown; reopen History to retry.",
    ]);
  });

  it("builds all warning messages with plural grammar", () => {
    expect(
      buildHistoryWarningMessages({
        unreadableReviewCount: 2,
        unreadableReviewIds: [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
        ],
        droppedIssueCount: 3,
        droppedIssueReviewIds: [
          "33333333-3333-4333-8333-333333333333",
          "44444444-4444-4444-8444-444444444444",
        ],
        droppedExecutionReviewIds: [
          "55555555-5555-4555-8555-555555555555",
          "66666666-6666-4666-8666-666666666666",
        ],
        indexBuildFailed: true,
        indexRewriteFailed: true,
      }),
    ).toEqual([
      "2 saved reviews (#11111111, #22222222) could not be read.",
      "3 invalid saved issues were omitted from #33333333, #44444444. Re-run the affected reviews for complete results.",
      "Execution details for 2 saved reviews (#55555555, #66666666) could not be read. Re-run the affected reviews to restore the outcome and trace.",
      "The history index could not be rebuilt. Readable reviews are still shown; reopen History to retry.",
      "The history index could not be cleaned up. Readable reviews are still shown; reopen History to retry.",
    ]);
  });

  it("names the rebuild failure only when the build flag is raised", () => {
    expect(buildHistoryWarningMessages({ ...NO_WARNINGS, indexBuildFailed: true })).toEqual([
      "The history index could not be rebuilt. Readable reviews are still shown; reopen History to retry.",
    ]);
  });

  it("names the cleanup failure only when the rewrite flag is raised", () => {
    expect(buildHistoryWarningMessages({ ...NO_WARNINGS, indexRewriteFailed: true })).toEqual([
      "The history index could not be cleaned up. Readable reviews are still shown; reopen History to retry.",
    ]);
  });

  it("keeps affected and unaffected run identifiers distinct", () => {
    const affectedId = "abcdef00-0000-4000-8000-000000000000";
    const unaffectedId = "abcdef00-1000-4000-8000-000000000000";
    const messages = buildHistoryWarningMessages(
      {
        ...NO_WARNINGS,
        droppedIssueCount: 1,
        droppedIssueReviewIds: [affectedId],
      },
      buildRunIdLookup([affectedId, unaffectedId]),
    );

    expect(messages).toEqual([
      "1 invalid saved issue was omitted from #abcdef00-0. Re-run the affected reviews for complete results.",
    ]);
    expect(messages[0]).not.toContain("#abcdef00-1");
  });

  it("labels warning targets from the caller's lookup", () => {
    const id = "abcdef00-0000-4000-8000-000000000000";

    expect(
      buildHistoryWarningMessages(
        {
          ...NO_WARNINGS,
          unreadableReviewCount: 1,
          unreadableReviewIds: [id],
        },
        new Map([[id, "#structural"]]),
      ),
    ).toEqual(["1 saved review (#structural) could not be read."]);
  });
});
