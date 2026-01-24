import { describe, it, expect, vi } from "vitest";
import { triageReview, triageWithProfile } from "./triage.js";
import type { AIClient } from "../ai/types.js";
import type { ParsedDiff } from "../diff/types.js";
import type { TriageResult } from "@repo/schemas/triage";
import { ok } from "../result.js";

function createMockAIClient(responses: TriageResult[]): AIClient {
  let callIndex = 0;
  return {
    provider: "gemini",
    generate: vi.fn().mockImplementation(async () => {
      const response = responses[callIndex] ?? responses[0];
      callIndex++;
      return ok(response);
    }),
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

describe("triageReview", () => {
  describe("basic functionality", () => {
    it("returns error when no files changed", async () => {
      const client = createMockAIClient([]);
      const diff: ParsedDiff = { files: [], totalStats: { filesChanged: 0, additions: 0, deletions: 0, totalSizeBytes: 0 } };

      const result = await triageReview(client, diff);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NO_DIFF");
      }
    });

    it("returns issues from AI client", async () => {
      const mockResult: TriageResult = {
        summary: "Found 1 issue",
        issues: [
          {
            id: "correctness_null_1",
            severity: "high",
            category: "correctness",
            title: "Null check missing",
            file: "src/index.ts",
            line_start: 10,
            line_end: 10,
            rationale: "This could crash",
            recommendation: "Add null check",
            suggested_patch: null,
            confidence: 0.9,
          },
        ],
      };
      const client = createMockAIClient([mockResult]);
      const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+const x = null;" }]);

      const result = await triageReview(client, diff);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.issues).toHaveLength(1);
        expect(result.value.issues[0]!.title).toBe("Null check missing");
      }
    });
  });

  describe("multi-lens review", () => {
    it("combines issues from multiple lenses", async () => {
      const correctnessResult: TriageResult = {
        summary: "Correctness issues",
        issues: [
          {
            id: "correctness_1",
            severity: "high",
            category: "correctness",
            title: "Logic error",
            file: "src/index.ts",
            line_start: 10,
            line_end: 10,
            rationale: "Bug",
            recommendation: "Fix it",
            suggested_patch: null,
            confidence: 0.9,
          },
        ],
      };
      const securityResult: TriageResult = {
        summary: "Security issues",
        issues: [
          {
            id: "security_1",
            severity: "blocker",
            category: "security",
            title: "SQL injection",
            file: "src/db.ts",
            line_start: 20,
            line_end: 20,
            rationale: "Vulnerable",
            recommendation: "Use prepared statements",
            suggested_patch: null,
            confidence: 0.95,
          },
        ],
      };

      const client = createMockAIClient([correctnessResult, securityResult]);
      const diff = createMockDiff([
        { path: "src/index.ts", rawDiff: "+bug" },
        { path: "src/db.ts", rawDiff: "+sql" },
      ]);

      const result = await triageReview(client, diff, { lenses: ["correctness", "security"] });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.issues).toHaveLength(2);
        expect(result.value.summary).toContain("Correctness");
        expect(result.value.summary).toContain("Security");
      }
    });

    it("deduplicates similar issues from different lenses", async () => {
      const result1: TriageResult = {
        summary: "Issues",
        issues: [
          {
            id: "lens1_issue",
            severity: "medium",
            category: "correctness",
            title: "Same issue",
            file: "src/index.ts",
            line_start: 10,
            line_end: 10,
            rationale: "Problem",
            recommendation: "Fix",
            suggested_patch: null,
            confidence: 0.8,
          },
        ],
      };
      const result2: TriageResult = {
        summary: "Issues",
        issues: [
          {
            id: "lens2_issue",
            severity: "high",
            category: "correctness",
            title: "Same issue",
            file: "src/index.ts",
            line_start: 10,
            line_end: 10,
            rationale: "Problem",
            recommendation: "Fix",
            suggested_patch: null,
            confidence: 0.9,
          },
        ],
      };

      const client = createMockAIClient([result1, result2]);
      const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);

      const triageResult = await triageReview(client, diff, { lenses: ["correctness", "security"] });

      expect(triageResult.ok).toBe(true);
      if (triageResult.ok) {
        expect(triageResult.value.issues).toHaveLength(1);
        expect(triageResult.value.issues[0]!.severity).toBe("high");
      }
    });
  });

  describe("severity filtering", () => {
    it("filters out low severity issues when minSeverity is high", async () => {
      const mockResult: TriageResult = {
        summary: "Issues",
        issues: [
          {
            id: "high_issue",
            severity: "high",
            category: "correctness",
            title: "High severity",
            file: "src/index.ts",
            line_start: 10,
            line_end: 10,
            rationale: "Bad",
            recommendation: "Fix",
            suggested_patch: null,
            confidence: 0.9,
          },
          {
            id: "low_issue",
            severity: "low",
            category: "style",
            title: "Low severity",
            file: "src/index.ts",
            line_start: 20,
            line_end: 20,
            rationale: "Minor",
            recommendation: "Consider",
            suggested_patch: null,
            confidence: 0.7,
          },
        ],
      };

      const client = createMockAIClient([mockResult]);
      const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);

      const result = await triageReview(client, diff, { filter: { minSeverity: "high" } });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.issues).toHaveLength(1);
        expect(result.value.issues[0]!.severity).toBe("high");
      }
    });

    it("includes blocker and high when minSeverity is high", async () => {
      const mockResult: TriageResult = {
        summary: "Issues",
        issues: [
          {
            id: "blocker_issue",
            severity: "blocker",
            category: "security",
            title: "Blocker",
            file: "src/index.ts",
            line_start: 5,
            line_end: 5,
            rationale: "Critical",
            recommendation: "Fix now",
            suggested_patch: null,
            confidence: 1.0,
          },
          {
            id: "high_issue",
            severity: "high",
            category: "correctness",
            title: "High",
            file: "src/index.ts",
            line_start: 10,
            line_end: 10,
            rationale: "Bad",
            recommendation: "Fix",
            suggested_patch: null,
            confidence: 0.9,
          },
        ],
      };

      const client = createMockAIClient([mockResult]);
      const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);

      const result = await triageReview(client, diff, { filter: { minSeverity: "high" } });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.issues).toHaveLength(2);
      }
    });
  });

  describe("sorting", () => {
    it("sorts issues by severity (blocker first)", async () => {
      const mockResult: TriageResult = {
        summary: "Issues",
        issues: [
          {
            id: "low_issue",
            severity: "low",
            category: "style",
            title: "Low",
            file: "src/a.ts",
            line_start: 1,
            line_end: 1,
            rationale: "Minor",
            recommendation: "Consider",
            suggested_patch: null,
            confidence: 0.5,
          },
          {
            id: "blocker_issue",
            severity: "blocker",
            category: "security",
            title: "Blocker",
            file: "src/b.ts",
            line_start: 1,
            line_end: 1,
            rationale: "Critical",
            recommendation: "Fix now",
            suggested_patch: null,
            confidence: 1.0,
          },
          {
            id: "high_issue",
            severity: "high",
            category: "correctness",
            title: "High",
            file: "src/c.ts",
            line_start: 1,
            line_end: 1,
            rationale: "Bad",
            recommendation: "Fix",
            suggested_patch: null,
            confidence: 0.9,
          },
        ],
      };

      const client = createMockAIClient([mockResult]);
      const diff = createMockDiff([
        { path: "src/a.ts", rawDiff: "+a" },
        { path: "src/b.ts", rawDiff: "+b" },
        { path: "src/c.ts", rawDiff: "+c" },
      ]);

      const result = await triageReview(client, diff);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.issues[0]!.severity).toBe("blocker");
        expect(result.value.issues[1]!.severity).toBe("high");
        expect(result.value.issues[2]!.severity).toBe("low");
      }
    });
  });
});

describe("triageWithProfile", () => {
  it("uses profile lenses and filter", async () => {
    const mockResult: TriageResult = {
      summary: "Quick review",
      issues: [
        {
          id: "high_issue",
          severity: "high",
          category: "correctness",
          title: "High severity issue",
          file: "src/index.ts",
          line_start: 10,
          line_end: 10,
          rationale: "Bad",
          recommendation: "Fix",
          suggested_patch: null,
          confidence: 0.9,
        },
        {
          id: "low_issue",
          severity: "low",
          category: "style",
          title: "Low severity issue",
          file: "src/index.ts",
          line_start: 20,
          line_end: 20,
          rationale: "Minor",
          recommendation: "Consider",
          suggested_patch: null,
          confidence: 0.5,
        },
      ],
    };

    const client = createMockAIClient([mockResult]);
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);

    const result = await triageWithProfile(client, diff, "quick");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issues).toHaveLength(1);
      expect(result.value.issues[0]!.severity).toBe("high");
    }
  });
});
