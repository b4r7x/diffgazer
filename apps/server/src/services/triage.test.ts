import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { AIClient } from "@repo/core/ai";
import type { ParsedDiff, DiffOperation } from "@repo/core/diff";
import type { TriageResult } from "@repo/schemas/triage";
import { ErrorCode } from "@repo/schemas/errors";

const mockGitService = vi.hoisted(() => ({
  getDiff: vi.fn(),
  getStatus: vi.fn(),
}));

const mockParseDiff = vi.hoisted(() => vi.fn());
const mockFilterDiffByFiles = vi.hoisted(() => vi.fn());
const mockTriageReview = vi.hoisted(() => vi.fn());
const mockGetLenses = vi.hoisted(() => vi.fn());
const mockGetProfile = vi.hoisted(() => vi.fn());
const mockSaveTriageReview = vi.hoisted(() => vi.fn());

vi.mock("./git.js", () => ({
  createGitService: vi.fn(() => mockGitService),
}));

vi.mock("@repo/core/diff", () => ({
  parseDiff: mockParseDiff,
  filterDiffByFiles: mockFilterDiffByFiles,
}));

vi.mock("@repo/core/review", () => ({
  triageReview: mockTriageReview,
  getLenses: mockGetLenses,
  getProfile: mockGetProfile,
}));

vi.mock("@repo/core/storage", () => ({
  saveTriageReview: mockSaveTriageReview,
}));

let streamTriageToSSE: typeof import("./triage.js").streamTriageToSSE;

describe("Triage Service", () => {
  let mockAIClient: AIClient;
  let mockStream: {
    writeSSE: Mock<(data: { event: string; data: string }) => Promise<void>>;
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    mockAIClient = {
      provider: "anthropic",
      generateStream: vi.fn(),
      generate: vi.fn(),
    };

    mockStream = {
      writeSSE: vi.fn().mockResolvedValue(undefined),
    };

    const triageMod = await import("./triage.js");
    streamTriageToSSE = triageMod.streamTriageToSSE;
  });

  describe("streamTriageToSSE", () => {
    const createMockParsedDiff = (sizeBytes = 1000): ParsedDiff => ({
      files: [
        {
          filePath: "test.ts",
          previousPath: null,
          operation: "modify",
          hunks: [],
          rawDiff: "",
          stats: {
            additions: 5,
            deletions: 2,
            sizeBytes: 100,
          },
        },
      ],
      totalStats: {
        additions: 5,
        deletions: 2,
        filesChanged: 1,
        totalSizeBytes: sizeBytes,
      },
    });

    it("validates diff size limit", async () => {
      const largeDiff = "diff --git a/large.ts b/large.ts\n" + "x".repeat(600000);
      mockGitService.getDiff.mockResolvedValue(largeDiff);
      mockParseDiff.mockReturnValue(createMockParsedDiff(600000));

      await streamTriageToSSE(mockAIClient, { staged: true }, mockStream);

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "error",
        data: expect.stringContaining("exceeds maximum allowed size"),
      });
    });

    it("handles empty diff", async () => {
      mockGitService.getDiff.mockResolvedValue("");

      await streamTriageToSSE(mockAIClient, { staged: true }, mockStream);

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "error",
        data: expect.stringContaining("No staged changes to review"),
      });
    });

    it("handles whitespace-only diff", async () => {
      mockGitService.getDiff.mockResolvedValue("   \n\t\n  ");

      await streamTriageToSSE(mockAIClient, { staged: false }, mockStream);

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "error",
        data: expect.stringContaining("No unstaged changes to review"),
      });
    });

    it("filters diff by specified files", async () => {
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();
      const filteredDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockFilterDiffByFiles.mockReturnValue(filteredDiff);
      mockGetLenses.mockReturnValue([{ id: "correctness", name: "Correctness" }]);
      mockTriageReview.mockResolvedValue({
        ok: true,
        value: { summary: "Test", issues: [] },
      });
      mockGitService.getStatus.mockResolvedValue({ branch: "main" });
      mockSaveTriageReview.mockResolvedValue({ ok: true, value: { id: "review-123" } });

      await streamTriageToSSE(
        mockAIClient,
        { staged: true, files: ["test.ts", "other.ts"] },
        mockStream
      );

      expect(mockFilterDiffByFiles).toHaveBeenCalledWith(parsedDiff, ["test.ts", "other.ts"]);
    });

    it("handles no files matching filter", async () => {
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();
      const emptyDiff: ParsedDiff = {
        files: [],
        totalStats: { additions: 0, deletions: 0, filesChanged: 0, totalSizeBytes: 0 },
      };

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockFilterDiffByFiles.mockReturnValue(emptyDiff);

      await streamTriageToSSE(
        mockAIClient,
        { staged: true, files: ["nonexistent.ts"] },
        mockStream
      );

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "error",
        data: expect.stringContaining("None of the specified files have staged changes"),
      });
    });

    it("orchestrates multiple lenses", async () => {
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockGetLenses.mockReturnValue([
        { id: "correctness", name: "Correctness" },
        { id: "security", name: "Security" },
        { id: "performance", name: "Performance" },
      ]);
      mockTriageReview.mockResolvedValue({
        ok: true,
        value: { summary: "Lens summary", issues: [] },
      });
      mockGitService.getStatus.mockResolvedValue({ branch: "main" });
      mockSaveTriageReview.mockResolvedValue({ ok: true, value: { id: "review-123" } });

      await streamTriageToSSE(
        mockAIClient,
        { staged: true, lenses: ["correctness", "security", "performance"] },
        mockStream
      );

      expect(mockTriageReview).toHaveBeenCalledTimes(3);
      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "lens_start",
        data: expect.stringContaining('"lens":"Correctness"'),
      });
      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "lens_start",
        data: expect.stringContaining('"lens":"Security"'),
      });
      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "lens_start",
        data: expect.stringContaining('"lens":"Performance"'),
      });
    });

    it("emits lens_start events with correct indices", async () => {
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockGetLenses.mockReturnValue([
        { id: "correctness", name: "Correctness" },
        { id: "security", name: "Security" },
      ]);
      mockTriageReview.mockResolvedValue({
        ok: true,
        value: { summary: "Test", issues: [] },
      });
      mockGitService.getStatus.mockResolvedValue({ branch: "main" });
      mockSaveTriageReview.mockResolvedValue({ ok: true, value: { id: "review-123" } });

      await streamTriageToSSE(
        mockAIClient,
        { staged: true, lenses: ["correctness", "security"] },
        mockStream
      );

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "lens_start",
        data: JSON.stringify({
          type: "lens_start",
          lens: "Correctness",
          index: 0,
          total: 2,
        }),
      });
      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "lens_start",
        data: JSON.stringify({
          type: "lens_start",
          lens: "Security",
          index: 1,
          total: 2,
        }),
      });
    });

    it("emits lens_complete events", async () => {
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockGetLenses.mockReturnValue([{ id: "correctness", name: "Correctness" }]);
      mockTriageReview.mockResolvedValue({
        ok: true,
        value: { summary: "Test", issues: [] },
      });
      mockGitService.getStatus.mockResolvedValue({ branch: "main" });
      mockSaveTriageReview.mockResolvedValue({ ok: true, value: { id: "review-123" } });

      await streamTriageToSSE(mockAIClient, { staged: true }, mockStream);

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "lens_complete",
        data: JSON.stringify({ type: "lens_complete", lens: "Correctness" }),
      });
    });

    it("aggregates issues from multiple lenses", async () => {
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockGetLenses.mockReturnValue([
        { id: "correctness", name: "Correctness" },
        { id: "security", name: "Security" },
      ]);

      let callCount = 0;
      mockTriageReview.mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          value: {
            summary: `Lens ${callCount} summary`,
            issues: [
              {
                severity: "high",
                title: `Issue ${callCount}`,
                description: "Description",
                file: "test.ts",
                line: callCount,
              },
            ],
          },
        };
      });

      mockGitService.getStatus.mockResolvedValue({ branch: "main" });
      mockSaveTriageReview.mockResolvedValue({ ok: true, value: { id: "review-123" } });

      await streamTriageToSSE(
        mockAIClient,
        { staged: true, lenses: ["correctness", "security"] },
        mockStream
      );

      const completeCall = mockStream.writeSSE.mock.calls.find(
        (call: [{ event: string; data: string }]) => call[0].event === "complete"
      );
      expect(completeCall).toBeTruthy();

      const data = JSON.parse(completeCall![0].data);
      expect(data.result.issues).toHaveLength(2);
      expect(data.result.summary).toContain("Lens 1 summary");
      expect(data.result.summary).toContain("Lens 2 summary");
    });

    it("uses profile lenses when profile specified", async () => {
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockGetProfile.mockReturnValue({
        id: "strict",
        lenses: ["correctness", "security", "tests"],
        filter: { minSeverity: "all" },
      });
      mockGetLenses.mockReturnValue([
        { id: "correctness", name: "Correctness" },
        { id: "security", name: "Security" },
        { id: "tests", name: "Tests" },
      ]);
      mockTriageReview.mockResolvedValue({
        ok: true,
        value: { summary: "Test", issues: [] },
      });
      mockGitService.getStatus.mockResolvedValue({ branch: "main" });
      mockSaveTriageReview.mockResolvedValue({ ok: true, value: { id: "review-123" } });

      await streamTriageToSSE(mockAIClient, { staged: true, profile: "strict" }, mockStream);

      expect(mockGetProfile).toHaveBeenCalledWith("strict");
      expect(mockGetLenses).toHaveBeenCalledWith(["correctness", "security", "tests"]);
    });

    it("defaults to correctness lens when no lenses or profile", async () => {
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockGetLenses.mockReturnValue([{ id: "correctness", name: "Correctness" }]);
      mockTriageReview.mockResolvedValue({
        ok: true,
        value: { summary: "Test", issues: [] },
      });
      mockGitService.getStatus.mockResolvedValue({ branch: "main" });
      mockSaveTriageReview.mockResolvedValue({ ok: true, value: { id: "review-123" } });

      await streamTriageToSSE(mockAIClient, { staged: true }, mockStream);

      expect(mockGetLenses).toHaveBeenCalledWith(["correctness"]);
    });

    it("saves review with metadata", async () => {
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockGetLenses.mockReturnValue([{ id: "correctness", name: "Correctness" }]);
      mockTriageReview.mockResolvedValue({
        ok: true,
        value: { summary: "Test summary", issues: [] },
      });
      mockGitService.getStatus.mockResolvedValue({ branch: "feature-branch" });
      mockSaveTriageReview.mockResolvedValue({ ok: true, value: { id: "review-123" } });

      await streamTriageToSSE(
        mockAIClient,
        { staged: true, lenses: ["correctness"], profile: "quick" },
        mockStream
      );

      expect(mockSaveTriageReview).toHaveBeenCalledWith({
        projectPath: process.cwd(),
        staged: true,
        result: { summary: "Test summary", issues: [] },
        diff: parsedDiff,
        branch: "feature-branch",
        commit: null,
        profile: "quick",
        lenses: ["correctness"],
      });
    });

    it("emits complete event with review ID", async () => {
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockGetLenses.mockReturnValue([{ id: "correctness", name: "Correctness" }]);
      mockTriageReview.mockResolvedValue({
        ok: true,
        value: { summary: "Test", issues: [] },
      });
      mockGitService.getStatus.mockResolvedValue({ branch: "main" });
      mockSaveTriageReview.mockResolvedValue({ ok: true, value: { id: "review-456" } });

      await streamTriageToSSE(mockAIClient, { staged: true }, mockStream);

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "complete",
        data: expect.stringContaining('"reviewId":"review-456"'),
      });
    });

    it("handles git diff error", async () => {
      mockGitService.getDiff.mockRejectedValue(new Error("Git not found"));

      await streamTriageToSSE(mockAIClient, { staged: true }, mockStream);

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "error",
        data: expect.stringContaining("code"),
      });
    });

    it("handles lens review error", async () => {
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockGetLenses.mockReturnValue([{ id: "correctness", name: "Correctness" }]);
      mockTriageReview.mockResolvedValue({
        ok: false,
        error: { message: "AI service error", code: "AI_ERROR" },
      });

      await streamTriageToSSE(mockAIClient, { staged: true }, mockStream);

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "error",
        data: expect.stringContaining("AI service error"),
      });
    });

    it("handles save error", async () => {
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockGetLenses.mockReturnValue([{ id: "correctness", name: "Correctness" }]);
      mockTriageReview.mockResolvedValue({
        ok: true,
        value: { summary: "Test", issues: [] },
      });
      mockGitService.getStatus.mockResolvedValue({ branch: "main" });
      mockSaveTriageReview.mockResolvedValue({
        ok: false,
        error: { message: "Write failed" },
      });

      await streamTriageToSSE(mockAIClient, { staged: true }, mockStream);

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "error",
        data: expect.stringContaining("Write failed"),
      });
    });

    it("handles unexpected errors", async () => {
      mockGitService.getDiff.mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      await streamTriageToSSE(mockAIClient, { staged: true }, mockStream);

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "error",
        data: expect.stringContaining("Unexpected error"),
      });
    });

    it("applies profile filter to lens reviews", async () => {
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockGetProfile.mockReturnValue({
        id: "quick",
        lenses: ["correctness"],
        filter: { minSeverity: "high" },
      });
      mockGetLenses.mockReturnValue([{ id: "correctness", name: "Correctness" }]);
      mockTriageReview.mockResolvedValue({
        ok: true,
        value: { summary: "Test", issues: [] },
      });
      mockGitService.getStatus.mockResolvedValue({ branch: "main" });
      mockSaveTriageReview.mockResolvedValue({ ok: true, value: { id: "review-123" } });

      await streamTriageToSSE(mockAIClient, { staged: true, profile: "quick" }, mockStream);

      expect(mockTriageReview).toHaveBeenCalledWith(
        mockAIClient,
        parsedDiff,
        expect.objectContaining({
          filter: { minSeverity: "high" },
        })
      );
    });

    it("handles git status failure gracefully", async () => {
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockGetLenses.mockReturnValue([{ id: "correctness", name: "Correctness" }]);
      mockTriageReview.mockResolvedValue({
        ok: true,
        value: { summary: "Test", issues: [] },
      });
      mockGitService.getStatus.mockRejectedValue(new Error("Git status failed"));
      mockSaveTriageReview.mockResolvedValue({ ok: true, value: { id: "review-123" } });

      await streamTriageToSSE(mockAIClient, { staged: true }, mockStream);

      expect(mockSaveTriageReview).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: null,
        })
      );
    });

    it("processes unstaged changes when staged=false", async () => {
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockGetLenses.mockReturnValue([{ id: "correctness", name: "Correctness" }]);
      mockTriageReview.mockResolvedValue({
        ok: true,
        value: { summary: "Test", issues: [] },
      });
      mockGitService.getStatus.mockResolvedValue({ branch: "main" });
      mockSaveTriageReview.mockResolvedValue({ ok: true, value: { id: "review-123" } });

      await streamTriageToSSE(mockAIClient, { staged: false }, mockStream);

      expect(mockGitService.getDiff).toHaveBeenCalledWith(false);
      expect(mockSaveTriageReview).toHaveBeenCalledWith(
        expect.objectContaining({
          staged: false,
        })
      );
    });
  });
});
