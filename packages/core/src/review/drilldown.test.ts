import { describe, it, expect, vi } from "vitest";
import { drilldownIssue, drilldownIssueById, drilldownMultiple } from "./drilldown.js";
import type { AIClient } from "../ai/types.js";
import type { ParsedDiff } from "../diff/types.js";
import type { TriageIssue, TriageResult } from "@repo/schemas/triage";
import { ok, err } from "../result.js";

function createMockAIClient(response: {
  detailedAnalysis: string;
  rootCause: string;
  impact: string;
  suggestedFix: string;
  patch: string | null;
  relatedIssues: string[];
  references: string[];
}): AIClient {
  return {
    provider: "gemini",
    generate: vi.fn().mockResolvedValue(ok(response)),
    generateStream: vi.fn(),
  };
}

function createMockDiff(files: Array<{ path: string; rawDiff: string }>): ParsedDiff {
  return {
    files: files.map((f) => ({
      filePath: f.path,
      previousPath: null,
      operation: "modify" as const,
      hunks: [],
      rawDiff: f.rawDiff,
      stats: { additions: 1, deletions: 1, sizeBytes: f.rawDiff.length },
    })),
    totalStats: {
      filesChanged: files.length,
      additions: files.length,
      deletions: files.length,
      totalSizeBytes: files.reduce((sum, f) => sum + f.rawDiff.length, 0),
    },
  };
}

const sampleIssue: TriageIssue = {
  id: "correctness_null_1",
  severity: "high",
  category: "correctness",
  title: "Missing null check",
  file: "src/index.ts",
  line_start: 10,
  line_end: 15,
  rationale: "The variable could be null here",
  recommendation: "Add a null check before accessing",
  suggested_patch: null,
  confidence: 0.9,
};

const sampleDrilldownResponse = {
  detailedAnalysis: "This function accesses a property without checking if the object is null...",
  rootCause: "Missing defensive programming patterns",
  impact: "Could cause runtime crashes in production when the optional parameter is not provided",
  suggestedFix: "Add an early return or null check at the beginning of the function",
  patch: "--- a/src/index.ts\n+++ b/src/index.ts\n@@ -10,1 +10,3 @@\n+if (!obj) return;\n obj.property",
  relatedIssues: [],
  references: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining"],
};

describe("drilldownIssue", () => {
  it("returns detailed analysis for an issue", async () => {
    const client = createMockAIClient(sampleDrilldownResponse);
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+const x = obj.property;" }]);

    const result = await drilldownIssue(client, sampleIssue, diff);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issueId).toBe(sampleIssue.id);
      expect(result.value.issue).toEqual(sampleIssue);
      expect(result.value.detailedAnalysis).toBe(sampleDrilldownResponse.detailedAnalysis);
      expect(result.value.rootCause).toBe(sampleDrilldownResponse.rootCause);
      expect(result.value.impact).toBe(sampleDrilldownResponse.impact);
      expect(result.value.suggestedFix).toBe(sampleDrilldownResponse.suggestedFix);
      expect(result.value.patch).toBe(sampleDrilldownResponse.patch);
    }
  });

  it("includes file diff in prompt", async () => {
    const client = createMockAIClient(sampleDrilldownResponse);
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+const x = obj.property;" }]);

    await drilldownIssue(client, sampleIssue, diff);

    expect(client.generate).toHaveBeenCalledWith(
      expect.stringContaining("const x = obj.property"),
      expect.anything()
    );
  });

  it("includes other issues in prompt for context", async () => {
    const client = createMockAIClient(sampleDrilldownResponse);
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);
    const otherIssues: TriageIssue[] = [
      { ...sampleIssue, id: "other_issue_1", title: "Related bug" },
      { ...sampleIssue, id: "other_issue_2", title: "Another issue" },
    ];

    await drilldownIssue(client, sampleIssue, diff, otherIssues);

    expect(client.generate).toHaveBeenCalledWith(
      expect.stringContaining("other_issue_1"),
      expect.anything()
    );
    expect(client.generate).toHaveBeenCalledWith(
      expect.stringContaining("other_issue_2"),
      expect.anything()
    );
  });

  it("handles AI errors", async () => {
    const client: AIClient = {
      provider: "gemini",
      generate: vi.fn().mockResolvedValue(err({ code: "API_KEY_INVALID", message: "Bad key" })),
      generateStream: vi.fn(),
    };
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);

    const result = await drilldownIssue(client, sampleIssue, diff);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("API_KEY_INVALID");
    }
  });
});

describe("drilldownIssueById", () => {
  it("finds issue by ID and returns drilldown", async () => {
    const client = createMockAIClient(sampleDrilldownResponse);
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);
    const triageResult: TriageResult = {
      summary: "Issues found",
      issues: [sampleIssue],
    };

    const result = await drilldownIssueById(client, sampleIssue.id, triageResult, diff);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issueId).toBe(sampleIssue.id);
    }
  });

  it("returns error when issue not found", async () => {
    const client = createMockAIClient(sampleDrilldownResponse);
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);
    const triageResult: TriageResult = {
      summary: "Issues found",
      issues: [sampleIssue],
    };

    const result = await drilldownIssueById(client, "nonexistent_id", triageResult, diff);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ISSUE_NOT_FOUND");
      expect(result.error.message).toContain("nonexistent_id");
    }
  });
});

describe("drilldownMultiple", () => {
  it("returns drilldowns for multiple issues", async () => {
    const client = createMockAIClient(sampleDrilldownResponse);
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);
    const issues: TriageIssue[] = [
      { ...sampleIssue, id: "issue_1" },
      { ...sampleIssue, id: "issue_2" },
    ];

    const result = await drilldownMultiple(client, issues, diff);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]!.issueId).toBe("issue_1");
      expect(result.value[1]!.issueId).toBe("issue_2");
    }
  });

  it("returns empty array for no issues", async () => {
    const client = createMockAIClient(sampleDrilldownResponse);
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);

    const result = await drilldownMultiple(client, [], diff);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it("stops and returns error on first failure", async () => {
    let callCount = 0;
    const client: AIClient = {
      provider: "gemini",
      generate: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return err({ code: "RATE_LIMITED", message: "Too many requests" });
        }
        return ok(sampleDrilldownResponse);
      }),
      generateStream: vi.fn(),
    };
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);
    const issues: TriageIssue[] = [
      { ...sampleIssue, id: "issue_1" },
      { ...sampleIssue, id: "issue_2" },
      { ...sampleIssue, id: "issue_3" },
    ];

    const result = await drilldownMultiple(client, issues, diff);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("RATE_LIMITED");
    }
    expect(callCount).toBe(2);
  });
});
