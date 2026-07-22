import { describe, expect, it } from "vitest";
import { SavedReviewSchema } from "../../schemas/review/index.js";
import {
  buildSeverityBreakdownRows,
  formatSeverityFilterLabel,
  toIssueDetailsPresentation,
} from "./issue.js";

describe("review issue presentation", () => {
  it("builds ordered severity rows with zero-count tracks", () => {
    const rows = buildSeverityBreakdownRows({ blocker: 0, high: 3, medium: 1, low: 0, nit: 0 });

    expect(rows.map((row) => row.severity)).toEqual(["blocker", "high", "medium", "low", "nit"]);
    expect(rows[0]).toMatchObject({ count: 0, filledCells: 0, emptyCells: 16 });
    expect(rows[1]).toMatchObject({ count: 3, total: 4, filledCells: 12, emptyCells: 4 });
  });

  it("builds complete issue metadata and fix-step presentation from a saved review", () => {
    const saved = SavedReviewSchema.parse({
      metadata: {
        id: "11111111-1111-4111-8111-111111111111",
        projectPath: "/repo",
        createdAt: "2026-07-14T08:00:00.000Z",
        mode: "unstaged",
        branch: "main",
        profile: null,
        lenses: [],
        issueCount: 1,
        blockerCount: 0,
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
        nitCount: 0,
        fileCount: 2,
      },
      result: {
        issues: [
          {
            id: "saved-issue",
            severity: "high",
            category: "security",
            title: "Unsafe redirect",
            file: "src/auth.ts",
            line_start: 14,
            line_end: 18,
            rationale: "rationale",
            recommendation: "recommendation",
            suggested_patch: null,
            confidence: 0.876,
            symptom: "symptom",
            whyItMatters: "impact",
            evidence: [],
            fixPlan: [
              {
                step: 4,
                action: "Validate the redirect target",
                risk: "high",
                files: ["src/auth.ts", "src/auth.test.ts"],
              },
            ],
            trace: [
              {
                step: 1,
                tool: "search",
                timestamp: "2026-07-14T08:00:01.000Z",
                inputSummary: "find the caller",
                outputSummary: "found one caller",
              },
            ],
          },
        ],
      },
      gitContext: {
        branch: "main",
        commit: "abc123",
        fileCount: 2,
        additions: 5,
        deletions: 1,
      },
    });

    const issue = saved.result.issues[0];
    if (!issue) throw new Error("Expected saved issue fixture");

    expect(toIssueDetailsPresentation(issue)).toEqual({
      category: "security",
      confidence: "88%",
      range: "14-18",
      location: "src/auth.ts:14-18",
      fixPlan: [
        {
          completionIndex: 0,
          number: 4,
          action: "Validate the redirect target",
          risk: "high",
          files: ["src/auth.ts", "src/auth.test.ts"],
        },
      ],
      trace: [
        {
          step: 1,
          tool: "search",
          timestamp: "2026-07-14T08:00:01.000Z",
          input: { label: "in:", summary: "find the caller" },
          output: { label: "out:", summary: "found one caller" },
        },
      ],
    });
  });

  it("keeps the severity-filter label shared across surfaces", () => {
    expect(formatSeverityFilterLabel("high", 3)).toBe("HIGH 3");
  });
});
