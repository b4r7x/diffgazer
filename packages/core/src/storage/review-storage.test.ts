import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createStorageTestContext, createPathsMock, unwrap, delay, UUID_V4_PATTERN } from "../../__test__/testing.js";
import type { ParsedDiff } from "../diff/types.js";
import type { TriageResult, TriageIssue } from "@repo/schemas/triage";
import type { DrilldownResult } from "@repo/schemas/lens";

const mocks = vi.hoisted(() => ({ testDir: "" }));

vi.mock("./paths.js", async () => ({
  get paths() {
    return createPathsMock(mocks);
  },
}));

let saveTriageReview: typeof import("./review-storage.js").saveTriageReview;
let listTriageReviews: typeof import("./review-storage.js").listTriageReviews;
let getTriageReview: typeof import("./review-storage.js").getTriageReview;
let deleteTriageReview: typeof import("./review-storage.js").deleteTriageReview;
let addDrilldownToReview: typeof import("./review-storage.js").addDrilldownToReview;
let triageReviewStore: typeof import("./review-storage.js").triageReviewStore;

function createMockDiff(): ParsedDiff {
  return {
    files: [
      {
        filePath: "src/index.ts",
        previousPath: null,
        operation: "modify",
        hunks: [],
        rawDiff: "+code",
        stats: { additions: 5, deletions: 2, sizeBytes: 100 },
      },
    ],
    totalStats: {
      filesChanged: 1,
      additions: 5,
      deletions: 2,
      totalSizeBytes: 100,
    },
  };
}

function createMockTriageResult(): TriageResult {
  return {
    summary: "Found 2 issues",
    issues: [
      {
        id: "issue_1",
        severity: "blocker",
        category: "security",
        title: "SQL Injection",
        file: "src/index.ts",
        line_start: 10,
        line_end: 10,
        rationale: "User input not sanitized",
        recommendation: "Use prepared statements",
        suggested_patch: null,
        confidence: 0.95,
        symptom: "User input concatenated into SQL query",
        whyItMatters: "Could allow attackers to execute arbitrary SQL commands",
        evidence: [
          {
            type: "code",
            title: "Code at src/index.ts:10",
            sourceId: "src/index.ts:10-10",
            file: "src/index.ts",
            range: { start: 10, end: 10 },
            excerpt: "db.query('SELECT * FROM users WHERE id = ' + userId)",
          },
        ],
      },
      {
        id: "issue_2",
        severity: "high",
        category: "correctness",
        title: "Null pointer",
        file: "src/index.ts",
        line_start: 20,
        line_end: 20,
        rationale: "Missing null check",
        recommendation: "Add validation",
        suggested_patch: null,
        confidence: 0.9,
        symptom: "Variable accessed without null check",
        whyItMatters: "Could cause runtime crash when value is undefined",
        evidence: [
          {
            type: "code",
            title: "Code at src/index.ts:20",
            sourceId: "src/index.ts:20-20",
            file: "src/index.ts",
            range: { start: 20, end: 20 },
            excerpt: "data.value.toString()",
          },
        ],
      },
    ],
  };
}

describe("Triage Review Storage", () => {
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const context = await createStorageTestContext("triage-reviews");
    mocks.testDir = context.testDir;
    cleanup = context.cleanup;

    vi.resetModules();
    const storageMod = await import("./review-storage.js");
    saveTriageReview = storageMod.saveTriageReview;
    listTriageReviews = storageMod.listTriageReviews;
    getTriageReview = storageMod.getTriageReview;
    deleteTriageReview = storageMod.deleteTriageReview;
    addDrilldownToReview = storageMod.addDrilldownToReview;
    triageReviewStore = storageMod.triageReviewStore;
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await cleanup();
  });

  describe("saveTriageReview", () => {
    it("generates valid UUID and creates readable review", async () => {
      const diff = createMockDiff();
      const result = createMockTriageResult();

      const saved = unwrap(
        await saveTriageReview({
          projectPath: "/test/project",
          staged: false,
          result,
          diff,
          branch: "main",
          commit: "abc123",
          lenses: ["correctness", "security"],
        })
      );

      expect(saved.id).toMatch(UUID_V4_PATTERN);
      expect(saved.projectPath).toBe("/test/project");
      expect(saved.staged).toBe(false);
      expect(saved.branch).toBe("main");
      expect(saved.issueCount).toBe(2);
      expect(saved.blockerCount).toBe(1);
      expect(saved.highCount).toBe(1);
    });

    it("stores profile when provided", async () => {
      const diff = createMockDiff();
      const result = createMockTriageResult();

      const saved = unwrap(
        await saveTriageReview({
          projectPath: "/test/project",
          staged: false,
          result,
          diff,
          branch: null,
          commit: null,
          profile: "strict",
          lenses: ["correctness", "security", "tests"],
        })
      );

      const read = unwrap(await getTriageReview(saved.id));
      expect(read.metadata.profile).toBe("strict");
      expect(read.metadata.lenses).toEqual(["correctness", "security", "tests"]);
    });

    it("preserves git context", async () => {
      const diff = createMockDiff();
      const result = createMockTriageResult();

      const saved = unwrap(
        await saveTriageReview({
          projectPath: "/test/project",
          staged: true,
          result,
          diff,
          branch: "feature/test",
          commit: "def456",
          lenses: ["correctness"],
        })
      );

      const read = unwrap(await getTriageReview(saved.id));
      expect(read.gitContext.branch).toBe("feature/test");
      expect(read.gitContext.commit).toBe("def456");
      expect(read.gitContext.fileCount).toBe(1);
      expect(read.gitContext.additions).toBe(5);
      expect(read.gitContext.deletions).toBe(2);
    });
  });

  describe("listTriageReviews", () => {
    it("lists reviews for project", async () => {
      const diff = createMockDiff();
      const result = createMockTriageResult();

      await saveTriageReview({
        projectPath: "/project/a",
        staged: false,
        result,
        diff,
        branch: "main",
        commit: null,
        lenses: ["correctness"],
      });

      await saveTriageReview({
        projectPath: "/project/b",
        staged: false,
        result,
        diff,
        branch: "main",
        commit: null,
        lenses: ["correctness"],
      });

      await saveTriageReview({
        projectPath: "/project/a",
        staged: false,
        result,
        diff,
        branch: "develop",
        commit: null,
        lenses: ["correctness"],
      });

      const list = unwrap(await listTriageReviews("/project/a"));
      expect(list.items).toHaveLength(2);
    });

    it("returns all reviews when no filter", async () => {
      const diff = createMockDiff();
      const result = createMockTriageResult();

      await saveTriageReview({
        projectPath: "/project/a",
        staged: false,
        result,
        diff,
        branch: "main",
        commit: null,
        lenses: ["correctness"],
      });

      await saveTriageReview({
        projectPath: "/project/b",
        staged: false,
        result,
        diff,
        branch: "main",
        commit: null,
        lenses: ["correctness"],
      });

      const list = unwrap(await listTriageReviews());
      expect(list.items).toHaveLength(2);
    });

    it("sorts by createdAt descending", async () => {
      const diff = createMockDiff();
      const result = createMockTriageResult();

      await saveTriageReview({
        projectPath: "/project",
        staged: false,
        result,
        diff,
        branch: "first",
        commit: null,
        lenses: ["correctness"],
      });

      await delay(10);

      await saveTriageReview({
        projectPath: "/project",
        staged: false,
        result,
        diff,
        branch: "second",
        commit: null,
        lenses: ["correctness"],
      });

      const list = unwrap(await listTriageReviews("/project"));
      expect(list.items[0]!.branch).toBe("second");
      expect(list.items[1]!.branch).toBe("first");
    });
  });

  describe("addDrilldownToReview", () => {
    it("adds drilldown to existing review", async () => {
      const diff = createMockDiff();
      const result = createMockTriageResult();

      const saved = unwrap(
        await saveTriageReview({
          projectPath: "/project",
          staged: false,
          result,
          diff,
          branch: "main",
          commit: null,
          lenses: ["correctness"],
        })
      );

      const drilldown: DrilldownResult = {
        issueId: "issue_1",
        issue: result.issues[0]!,
        detailedAnalysis: "Deep analysis...",
        rootCause: "Missing validation",
        impact: "Could cause data breach",
        suggestedFix: "Use prepared statements",
        patch: "--- a/src/index.ts\n+++ b/src/index.ts\n...",
        relatedIssues: [],
        references: ["https://owasp.org"],
      };

      unwrap(await addDrilldownToReview(saved.id, drilldown));

      const read = unwrap(await getTriageReview(saved.id));
      expect(read.drilldowns).toHaveLength(1);
      expect(read.drilldowns[0]!.issueId).toBe("issue_1");
    });

    it("updates existing drilldown for same issue", async () => {
      const diff = createMockDiff();
      const result = createMockTriageResult();

      const saved = unwrap(
        await saveTriageReview({
          projectPath: "/project",
          staged: false,
          result,
          diff,
          branch: "main",
          commit: null,
          lenses: ["correctness"],
        })
      );

      const drilldown1: DrilldownResult = {
        issueId: "issue_1",
        issue: result.issues[0]!,
        detailedAnalysis: "First analysis",
        rootCause: "Cause 1",
        impact: "Impact 1",
        suggestedFix: "Fix 1",
        patch: null,
        relatedIssues: [],
        references: [],
      };

      const drilldown2: DrilldownResult = {
        issueId: "issue_1",
        issue: result.issues[0]!,
        detailedAnalysis: "Updated analysis",
        rootCause: "Cause 2",
        impact: "Impact 2",
        suggestedFix: "Fix 2",
        patch: "new patch",
        relatedIssues: [],
        references: [],
      };

      unwrap(await addDrilldownToReview(saved.id, drilldown1));
      unwrap(await addDrilldownToReview(saved.id, drilldown2));

      const read = unwrap(await getTriageReview(saved.id));
      expect(read.drilldowns).toHaveLength(1);
      expect(read.drilldowns[0]!.detailedAnalysis).toBe("Updated analysis");
      expect(read.drilldowns[0]!.patch).toBe("new patch");
    });
  });

  describe("deleteTriageReview", () => {
    it("removes review from storage", async () => {
      const diff = createMockDiff();
      const result = createMockTriageResult();

      const saved1 = unwrap(
        await saveTriageReview({
          projectPath: "/project",
          staged: false,
          result,
          diff,
          branch: "main",
          commit: null,
          lenses: ["correctness"],
        })
      );

      await saveTriageReview({
        projectPath: "/project",
        staged: false,
        result,
        diff,
        branch: "develop",
        commit: null,
        lenses: ["correctness"],
      });

      const deleteResult = unwrap(await deleteTriageReview(saved1.id));
      expect(deleteResult.existed).toBe(true);

      const list = unwrap(await listTriageReviews("/project"));
      expect(list.items).toHaveLength(1);
      expect(list.items[0]!.branch).toBe("develop");
    });

    it("returns existed: false for non-existent review", async () => {
      const deleteResult = unwrap(await deleteTriageReview("550e8400-e29b-41d4-a716-446655440000"));
      expect(deleteResult.existed).toBe(false);
    });
  });
});
