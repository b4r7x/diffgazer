import { MAX_REVIEW_ISSUES_PER_LENS } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { describe, expect, it } from "vitest";
import { salvageLensIssues } from "./salvage-issues.js";

describe("salvageLensIssues", () => {
  it("keeps the valid elements of an issues array that failed as a whole", () => {
    const valid = makeIssue({ id: "kept" });
    const payload = { issues: [valid, { id: "broken" }] };

    const salvaged = salvageLensIssues(payload, JSON.stringify(payload));

    expect(salvaged.issues).toEqual([valid]);
    expect(salvaged.droppedCount).toBe(1);
  });

  it("recovers the complete issues of a truncated answer", () => {
    const first = makeIssue({ id: "first" });
    const content = `{"issues":[${JSON.stringify(first)},{"id":"second","severity":"hi`;

    const salvaged = salvageLensIssues(null, content);

    expect(salvaged.issues).toEqual([first]);
  });

  it("does not turn a nested evidence object into a second finding", () => {
    const issue = makeIssue({
      evidence: [{ type: "code", title: "e", sourceId: "s", excerpt: "x" }],
    });
    const content = `{"issues":[${JSON.stringify(issue)},{"id":"cut`;

    const salvaged = salvageLensIssues(null, content);

    expect(salvaged.issues).toEqual([issue]);
  });

  it("keeps nothing when no candidate validates on its own", () => {
    const salvaged = salvageLensIssues({ issues: [{ id: "broken" }] }, "irrelevant");

    expect(salvaged.issues).toEqual([]);
    expect(salvaged.droppedCount).toBe(1);
  });

  it("keeps a candidate whose only defect is object-shaped testsToAdd, with the entries coerced to strings", () => {
    const payload = {
      issues: [
        {
          ...makeIssue({ id: "kept" }),
          testsToAdd: [{ name: "adds two positives", description: "expect(add(2, 3)).toBe(5)" }],
        },
      ],
    };

    const salvaged = salvageLensIssues(payload, JSON.stringify(payload));

    expect(salvaged.issues).toMatchObject([
      { id: "kept", testsToAdd: [expect.stringContaining("adds two positives")] },
    ]);
    expect(salvaged.droppedCount).toBe(0);
  });

  it("stops at the per-lens cap", () => {
    const issues = Array.from({ length: MAX_REVIEW_ISSUES_PER_LENS + 3 }, (_, index) =>
      makeIssue({ id: `issue-${index}` }),
    );

    const salvaged = salvageLensIssues({ issues }, "");

    expect(salvaged.issues).toHaveLength(MAX_REVIEW_ISSUES_PER_LENS);
    expect(salvaged.droppedCount).toBe(3);
  });
});
