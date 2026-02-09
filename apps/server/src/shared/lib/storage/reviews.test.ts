import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCollectionRead, mockCollectionWrite, mockCollectionList, mockCollectionRemove, mockCollectionEnsureDir } = vi.hoisted(() => ({
  mockCollectionRead: vi.fn(),
  mockCollectionWrite: vi.fn(),
  mockCollectionList: vi.fn(),
  mockCollectionRemove: vi.fn(),
  mockCollectionEnsureDir: vi.fn(),
}));

vi.mock("./persistence.js", () => ({
  createCollection: vi.fn(() => ({
    read: mockCollectionRead,
    write: mockCollectionWrite,
    list: mockCollectionList,
    remove: mockCollectionRemove,
    ensureDir: mockCollectionEnsureDir,
  })),
}));

vi.mock("../paths.js", () => ({
  getGlobalDiffgazerDir: vi.fn(() => "/tmp/test-diffgazer"),
  getGlobalConfigPath: vi.fn(() => "/tmp/test-diffgazer/config.json"),
  getGlobalSecretsPath: vi.fn(() => "/tmp/test-diffgazer/secrets.json"),
  getGlobalTrustPath: vi.fn(() => "/tmp/test-diffgazer/trust.json"),
  getGlobalOpenRouterModelsPath: vi.fn(() => "/tmp/test-diffgazer/openrouter-models.json"),
  getProjectDiffgazerDir: vi.fn((root: string) => `${root}/.diffgazer`),
  getProjectInfoPath: vi.fn((root: string) => `${root}/.diffgazer/project.json`),
  resolveProjectRoot: vi.fn(() => "/tmp/test-project"),
  PROJECT_ROOT_HEADER: "x-diffgazer-project-root",
}));

import { saveReview, listReviews, getReview, deleteReview, addDrilldownToReview } from "./reviews.js";

const makeIssue = (overrides: Record<string, unknown> = {}) => ({
  id: "i1",
  title: "Bug",
  severity: "high" as const,
  category: "correctness" as const,
  file: "a.ts",
  line_start: 1,
  line_end: 2,
  rationale: "test rationale",
  recommendation: "fix it",
  suggested_patch: null,
  confidence: 0.9,
  symptom: "broken",
  whyItMatters: "matters",
  evidence: [],
  ...overrides,
});

const makeReviewOptions = (overrides: Record<string, any> = {}) => ({
  projectPath: "/projects/test",
  mode: "unstaged" as const,
  branch: "main",
  commit: "abc123",
  lenses: ["correctness" as const],
  diff: {
    totalStats: { filesChanged: 3, additions: 10, deletions: 5, totalSizeBytes: 1000 },
    files: [],
  },
  result: {
    summary: "Test review",
    issues: [makeIssue()],
  },
  ...overrides,
});

const makeSavedReview = (overrides: Record<string, any> = {}) => ({
  metadata: {
    id: "550e8400-e29b-41d4-a716-446655440000",
    projectPath: "/projects/test",
    createdAt: "2025-01-01T00:00:00.000Z",
    mode: "unstaged",
    branch: "main",
    profile: null,
    lenses: ["correctness"],
    issueCount: 2,
    blockerCount: 0,
    highCount: 1,
    mediumCount: 1,
    lowCount: 0,
    nitCount: 0,
    fileCount: 3,
    durationMs: undefined,
  },
  result: {
    summary: "Review summary",
    issues: [
      makeIssue({ id: "i1", title: "Bug", severity: "high" as const, file: "a.ts" }),
      makeIssue({ id: "i2", title: "Warn", severity: "medium" as const, file: "b.ts", line_start: 5, line_end: 6 }),
    ],
  },
  gitContext: {
    branch: "main",
    commit: "abc123",
    fileCount: 3,
    additions: 10,
    deletions: 5,
  },
  drilldowns: [],
  ...overrides,
});

describe("reviews storage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("saveReview", () => {
    it("should write review and return metadata", async () => {
      mockCollectionWrite.mockResolvedValue({ ok: true, value: undefined });

      const result = await saveReview(makeReviewOptions());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.projectPath).toBe("/projects/test");
        expect(result.value.branch).toBe("main");
        expect(result.value.issueCount).toBe(1);
        expect(result.value.id).toBeDefined();
      }
      expect(mockCollectionWrite).toHaveBeenCalled();
    });

    it("should calculate severity counts from issues", async () => {
      mockCollectionWrite.mockResolvedValue({ ok: true, value: undefined });

      const result = await saveReview(makeReviewOptions({
        result: {
          summary: "test",
          issues: [
            makeIssue({ id: "i1", title: "A", severity: "blocker" as const, file: "a.ts" }),
            makeIssue({ id: "i2", title: "B", severity: "high" as const, file: "b.ts" }),
            makeIssue({ id: "i3", title: "C", severity: "nit" as const, file: "c.ts" }),
          ],
        },
      }));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.blockerCount).toBe(1);
        expect(result.value.highCount).toBe(1);
        expect(result.value.nitCount).toBe(1);
        expect(result.value.issueCount).toBe(3);
      }
    });

    it("should use provided reviewId", async () => {
      mockCollectionWrite.mockResolvedValue({ ok: true, value: undefined });

      const result = await saveReview(makeReviewOptions({ reviewId: "custom-id" }));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe("custom-id");
      }
    });

    it("should propagate write errors", async () => {
      mockCollectionWrite.mockResolvedValue({
        ok: false,
        error: { code: "WRITE_ERROR", message: "disk full" },
      });

      const result = await saveReview(makeReviewOptions());

      expect(result.ok).toBe(false);
    });
  });

  describe("listReviews", () => {
    it("should return reviews sorted by date (newest first)", async () => {
      mockCollectionList.mockResolvedValue({
        ok: true,
        value: {
          items: [
            { ...makeSavedReview().metadata, id: "old", createdAt: "2024-01-01T00:00:00.000Z" },
            { ...makeSavedReview().metadata, id: "new", createdAt: "2025-06-01T00:00:00.000Z" },
          ],
          warnings: [],
        },
      });

      const result = await listReviews();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items[0]?.id).toBe("new");
        expect(result.value.items[1]?.id).toBe("old");
      }
    });

    it("should filter by projectPath when provided", async () => {
      mockCollectionList.mockResolvedValue({
        ok: true,
        value: {
          items: [
            { ...makeSavedReview().metadata, id: "a", projectPath: "/proj/a", createdAt: "2025-01-01" },
            { ...makeSavedReview().metadata, id: "b", projectPath: "/proj/b", createdAt: "2025-01-02" },
          ],
          warnings: [],
        },
      });

      const result = await listReviews("/proj/a");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.items).toHaveLength(1);
        expect(result.value.items[0]?.id).toBe("a");
      }
    });

    it("should migrate old reviews with missing severity counts", async () => {
      const oldMetadata = {
        ...makeSavedReview().metadata,
        blockerCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        nitCount: 0,
        issueCount: 2,
      };
      mockCollectionList.mockResolvedValue({
        ok: true,
        value: { items: [oldMetadata], warnings: [] },
      });
      // When migration reads the full review
      const fullReview = makeSavedReview();
      fullReview.metadata = { ...oldMetadata };
      mockCollectionRead.mockResolvedValue({ ok: true, value: fullReview });
      mockCollectionWrite.mockResolvedValue({ ok: true, value: undefined });

      const result = await listReviews();

      expect(result.ok).toBe(true);
      if (result.ok) {
        // After migration, severity counts should be recalculated
        expect(result.value.items[0]?.highCount).toBe(1);
        expect(result.value.items[0]?.mediumCount).toBe(1);
      }
    });

    it("should skip migration when severity counts already present", async () => {
      mockCollectionList.mockResolvedValue({
        ok: true,
        value: {
          items: [makeSavedReview().metadata],
          warnings: [],
        },
      });

      const result = await listReviews();

      expect(result.ok).toBe(true);
      // Should not attempt to read full review for migration
      expect(mockCollectionRead).not.toHaveBeenCalled();
    });

    it("should propagate list errors", async () => {
      mockCollectionList.mockResolvedValue({
        ok: false,
        error: { code: "PERMISSION_ERROR", message: "denied" },
      });

      const result = await listReviews();

      expect(result.ok).toBe(false);
    });
  });

  describe("getReview", () => {
    it("should return a saved review", async () => {
      const review = makeSavedReview();
      mockCollectionRead.mockResolvedValue({ ok: true, value: review });

      const result = await getReview("test-id");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.metadata.id).toBe(review.metadata.id);
      }
    });

    it("should migrate and persist if severity counts are missing", async () => {
      const review = makeSavedReview({
        metadata: {
          ...makeSavedReview().metadata,
          blockerCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          nitCount: 0,
          issueCount: 2,
        },
      });
      mockCollectionRead.mockResolvedValue({ ok: true, value: review });
      mockCollectionWrite.mockResolvedValue({ ok: true, value: undefined });

      const result = await getReview("test-id");

      expect(result.ok).toBe(true);
      // Should have written the migrated review
      expect(mockCollectionWrite).toHaveBeenCalled();
    });

    it("should propagate read errors", async () => {
      mockCollectionRead.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "not found" },
      });

      const result = await getReview("missing-id");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("deleteReview", () => {
    it("should delegate to collection remove", async () => {
      mockCollectionRemove.mockResolvedValue({ ok: true, value: { existed: true } });

      const result = await deleteReview("test-id");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.existed).toBe(true);
      }
    });
  });

  describe("addDrilldownToReview", () => {
    it("should add new drilldown to review", async () => {
      const review = makeSavedReview();
      mockCollectionRead.mockResolvedValue({ ok: true, value: review });
      mockCollectionWrite.mockResolvedValue({ ok: true, value: undefined });

      const drilldown = { issueId: "i1", analysis: "detailed analysis" };
      const result = await addDrilldownToReview("test-id", drilldown as any);

      expect(result.ok).toBe(true);
      expect(mockCollectionWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          drilldowns: [drilldown],
        })
      );
    });

    it("should replace existing drilldown for same issueId", async () => {
      const review = makeSavedReview({
        drilldowns: [{ issueId: "i1", analysis: "old" }],
      });
      mockCollectionRead.mockResolvedValue({ ok: true, value: review });
      mockCollectionWrite.mockResolvedValue({ ok: true, value: undefined });

      const drilldown = { issueId: "i1", analysis: "new" };
      const result = await addDrilldownToReview("test-id", drilldown as any);

      expect(result.ok).toBe(true);
      expect(mockCollectionWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          drilldowns: [drilldown],
        })
      );
    });

    it("should propagate read errors", async () => {
      mockCollectionRead.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "not found" },
      });

      const result = await addDrilldownToReview("missing", { issueId: "i1" } as any);

      expect(result.ok).toBe(false);
    });
  });
});
