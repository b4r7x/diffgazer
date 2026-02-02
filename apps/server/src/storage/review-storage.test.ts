import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { saveTriageReview, getTriageReview, triageReviewStore } from "./review-storage.js";
import type { SaveTriageReviewOptions } from "./review-storage.js";
import type { TriageIssue, TriageResult, TriageSeverity, SavedTriageReview } from "@repo/schemas";
import { ok } from "@repo/core";

// Mock the store
vi.mock("./persistence.js", () => ({
  createCollection: vi.fn(() => ({
    write: vi.fn(),
    read: vi.fn(),
    list: vi.fn(),
    remove: vi.fn(),
    ensureDir: vi.fn(),
  })),
  filterByProjectAndSort: vi.fn((items) => items),
}));

function createMockIssue(severity: TriageSeverity, id: string = "test-issue"): TriageIssue {
  return {
    id,
    severity,
    category: "correctness",
    title: `Test ${severity} issue`,
    file: "src/test.ts",
    line_start: 1,
    line_end: 1,
    rationale: "Test rationale",
    recommendation: "Test recommendation",
    suggested_patch: null,
    confidence: 0.9,
    symptom: "Test symptom",
    whyItMatters: "Test why it matters",
    evidence: [
      {
        type: "code",
        title: "Test evidence",
        sourceId: "test-source",
        excerpt: "test code",
      },
    ],
  };
}

function createMockTriageResult(issues: TriageIssue[]): TriageResult {
  return {
    summary: `Found ${issues.length} issues`,
    issues,
  };
}

function createMockDiff() {
  return {
    files: [],
    totalStats: {
      filesChanged: 5,
      additions: 100,
      deletions: 50,
      totalSizeBytes: 1500,
    },
  };
}

describe("review-storage severity histogram", () => {
  beforeEach(() => {
    vi.mocked(triageReviewStore.write).mockResolvedValue(ok(undefined));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("countIssuesBySeverity", () => {
    it("calculates all five severity counts when saving review with all severities", async () => {
      const issues = [
        createMockIssue("blocker", "issue-1"),
        createMockIssue("high", "issue-2"),
        createMockIssue("medium", "issue-3"),
        createMockIssue("low", "issue-4"),
        createMockIssue("nit", "issue-5"),
      ];

      const options: SaveTriageReviewOptions = {
        projectPath: "/test/project",
        mode: "unstaged",
        result: createMockTriageResult(issues),
        diff: createMockDiff(),
        branch: "main",
        commit: "abc123",
        lenses: ["correctness"],
      };

      await saveTriageReview(options);

      expect(triageReviewStore.write).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            issueCount: 5,
            blockerCount: 1,
            highCount: 1,
            mediumCount: 1,
            lowCount: 1,
            nitCount: 1,
          }),
        })
      );
    });

    it("calculates correct counts when only some severities are present", async () => {
      const issues = [
        createMockIssue("blocker", "issue-1"),
        createMockIssue("low", "issue-2"),
      ];

      const options: SaveTriageReviewOptions = {
        projectPath: "/test/project",
        mode: "unstaged",
        result: createMockTriageResult(issues),
        diff: createMockDiff(),
        branch: "main",
        commit: "abc123",
        lenses: ["correctness"],
      };

      await saveTriageReview(options);

      expect(triageReviewStore.write).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            issueCount: 2,
            blockerCount: 1,
            highCount: 0,
            mediumCount: 0,
            lowCount: 1,
            nitCount: 0,
          }),
        })
      );
    });

    it("sets all counts to zero when no issues are present", async () => {
      const options: SaveTriageReviewOptions = {
        projectPath: "/test/project",
        mode: "unstaged",
        result: createMockTriageResult([]),
        diff: createMockDiff(),
        branch: "main",
        commit: "abc123",
        lenses: ["correctness"],
      };

      await saveTriageReview(options);

      expect(triageReviewStore.write).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            issueCount: 0,
            blockerCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0,
            nitCount: 0,
          }),
        })
      );
    });

    it("counts multiple issues of the same severity correctly", async () => {
      const issues = [
        createMockIssue("high", "issue-1"),
        createMockIssue("high", "issue-2"),
        createMockIssue("high", "issue-3"),
      ];

      const options: SaveTriageReviewOptions = {
        projectPath: "/test/project",
        mode: "unstaged",
        result: createMockTriageResult(issues),
        diff: createMockDiff(),
        branch: "main",
        commit: "abc123",
        lenses: ["correctness"],
      };

      await saveTriageReview(options);

      expect(triageReviewStore.write).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            issueCount: 3,
            blockerCount: 0,
            highCount: 3,
            mediumCount: 0,
            lowCount: 0,
            nitCount: 0,
          }),
        })
      );
    });

    it("calculates counts correctly for medium severity issues", async () => {
      const issues = [
        createMockIssue("medium", "issue-1"),
        createMockIssue("medium", "issue-2"),
        createMockIssue("blocker", "issue-3"),
      ];

      const options: SaveTriageReviewOptions = {
        projectPath: "/test/project",
        mode: "unstaged",
        result: createMockTriageResult(issues),
        diff: createMockDiff(),
        branch: "main",
        commit: "abc123",
        lenses: ["correctness"],
      };

      await saveTriageReview(options);

      expect(triageReviewStore.write).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            issueCount: 3,
            blockerCount: 1,
            highCount: 0,
            mediumCount: 2,
            lowCount: 0,
            nitCount: 0,
          }),
        })
      );
    });

    it("calculates counts correctly for low severity issues", async () => {
      const issues = [
        createMockIssue("low", "issue-1"),
        createMockIssue("low", "issue-2"),
        createMockIssue("low", "issue-3"),
        createMockIssue("nit", "issue-4"),
      ];

      const options: SaveTriageReviewOptions = {
        projectPath: "/test/project",
        mode: "unstaged",
        result: createMockTriageResult(issues),
        diff: createMockDiff(),
        branch: "main",
        commit: "abc123",
        lenses: ["correctness"],
      };

      await saveTriageReview(options);

      expect(triageReviewStore.write).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            issueCount: 4,
            blockerCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 3,
            nitCount: 1,
          }),
        })
      );
    });

    it("calculates counts correctly for nit severity issues", async () => {
      const issues = [
        createMockIssue("nit", "issue-1"),
        createMockIssue("nit", "issue-2"),
        createMockIssue("nit", "issue-3"),
        createMockIssue("nit", "issue-4"),
        createMockIssue("nit", "issue-5"),
      ];

      const options: SaveTriageReviewOptions = {
        projectPath: "/test/project",
        mode: "unstaged",
        result: createMockTriageResult(issues),
        diff: createMockDiff(),
        branch: "main",
        commit: "abc123",
        lenses: ["correctness"],
      };

      await saveTriageReview(options);

      expect(triageReviewStore.write).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            issueCount: 5,
            blockerCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0,
            nitCount: 5,
          }),
        })
      );
    });

    it("calculates counts correctly for large mixed severity dataset", async () => {
      const issues = [
        createMockIssue("blocker", "issue-1"),
        createMockIssue("blocker", "issue-2"),
        createMockIssue("high", "issue-3"),
        createMockIssue("high", "issue-4"),
        createMockIssue("high", "issue-5"),
        createMockIssue("medium", "issue-6"),
        createMockIssue("medium", "issue-7"),
        createMockIssue("medium", "issue-8"),
        createMockIssue("medium", "issue-9"),
        createMockIssue("low", "issue-10"),
        createMockIssue("low", "issue-11"),
        createMockIssue("low", "issue-12"),
        createMockIssue("low", "issue-13"),
        createMockIssue("low", "issue-14"),
        createMockIssue("nit", "issue-15"),
        createMockIssue("nit", "issue-16"),
        createMockIssue("nit", "issue-17"),
        createMockIssue("nit", "issue-18"),
        createMockIssue("nit", "issue-19"),
        createMockIssue("nit", "issue-20"),
      ];

      const options: SaveTriageReviewOptions = {
        projectPath: "/test/project",
        mode: "unstaged",
        result: createMockTriageResult(issues),
        diff: createMockDiff(),
        branch: "main",
        commit: "abc123",
        lenses: ["correctness"],
      };

      await saveTriageReview(options);

      expect(triageReviewStore.write).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            issueCount: 20,
            blockerCount: 2,
            highCount: 3,
            mediumCount: 4,
            lowCount: 5,
            nitCount: 6,
          }),
        })
      );
    });

    it("maintains correct count when issue count matches severity distribution", async () => {
      const issues = [
        createMockIssue("medium", "issue-1"),
        createMockIssue("medium", "issue-2"),
        createMockIssue("medium", "issue-3"),
      ];

      const options: SaveTriageReviewOptions = {
        projectPath: "/test/project",
        mode: "unstaged",
        result: createMockTriageResult(issues),
        diff: createMockDiff(),
        branch: "main",
        commit: "abc123",
        lenses: ["correctness"],
      };

      const result = await saveTriageReview(options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.issueCount).toBe(3);
        expect(result.value.mediumCount).toBe(3);
        expect(
          result.value.blockerCount +
            result.value.highCount +
            result.value.mediumCount +
            result.value.lowCount +
            result.value.nitCount
        ).toBe(result.value.issueCount);
      }
    });
  });

  describe("on-read migration for old reviews", () => {
    it("migrates review with missing severity counts when issueCount > 0", async () => {
      const issues = [
        createMockIssue("blocker", "issue-1"),
        createMockIssue("high", "issue-2"),
        createMockIssue("medium", "issue-3"),
      ];

      // Simulate old review data with missing counts (defaulting to 0)
      const oldReview: SavedTriageReview = {
        metadata: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          projectPath: "/test/project",
          createdAt: new Date().toISOString(),
          mode: "unstaged",
          branch: "main",
          profile: null,
          lenses: ["correctness"],
          issueCount: 3,
          blockerCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          nitCount: 0,
          fileCount: 5,
        },
        result: createMockTriageResult(issues),
        gitContext: {
          branch: "main",
          commit: "abc123",
          fileCount: 5,
          additions: 100,
          deletions: 50,
        },
        drilldowns: [],
      };

      vi.mocked(triageReviewStore.read).mockResolvedValue(ok(oldReview));
      vi.mocked(triageReviewStore.write).mockResolvedValue(ok(undefined));

      const result = await getTriageReview("550e8400-e29b-41d4-a716-446655440000");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.metadata.blockerCount).toBe(1);
        expect(result.value.metadata.highCount).toBe(1);
        expect(result.value.metadata.mediumCount).toBe(1);
        expect(result.value.metadata.lowCount).toBe(0);
        expect(result.value.metadata.nitCount).toBe(0);
      }

      // Should persist the migrated data
      expect(triageReviewStore.write).toHaveBeenCalled();
    });

    it("does not migrate review that already has severity counts", async () => {
      const issues = [
        createMockIssue("blocker", "issue-1"),
        createMockIssue("high", "issue-2"),
      ];

      const newReview: SavedTriageReview = {
        metadata: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          projectPath: "/test/project",
          createdAt: new Date().toISOString(),
          mode: "unstaged",
          branch: "main",
          profile: null,
          lenses: ["correctness"],
          issueCount: 2,
          blockerCount: 1,
          highCount: 1,
          mediumCount: 0,
          lowCount: 0,
          nitCount: 0,
          fileCount: 5,
        },
        result: createMockTriageResult(issues),
        gitContext: {
          branch: "main",
          commit: "abc123",
          fileCount: 5,
          additions: 100,
          deletions: 50,
        },
        drilldowns: [],
      };

      vi.mocked(triageReviewStore.read).mockResolvedValue(ok(newReview));

      const result = await getTriageReview("550e8400-e29b-41d4-a716-446655440000");

      expect(result.ok).toBe(true);
      // Should NOT persist since no migration was needed
      expect(triageReviewStore.write).not.toHaveBeenCalled();
    });

    it("does not migrate review with zero issues", async () => {
      const emptyReview: SavedTriageReview = {
        metadata: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          projectPath: "/test/project",
          createdAt: new Date().toISOString(),
          mode: "unstaged",
          branch: "main",
          profile: null,
          lenses: ["correctness"],
          issueCount: 0,
          blockerCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          nitCount: 0,
          fileCount: 5,
        },
        result: createMockTriageResult([]),
        gitContext: {
          branch: "main",
          commit: "abc123",
          fileCount: 5,
          additions: 100,
          deletions: 50,
        },
        drilldowns: [],
      };

      vi.mocked(triageReviewStore.read).mockResolvedValue(ok(emptyReview));

      const result = await getTriageReview("550e8400-e29b-41d4-a716-446655440000");

      expect(result.ok).toBe(true);
      expect(triageReviewStore.write).not.toHaveBeenCalled();
    });
  });
});
