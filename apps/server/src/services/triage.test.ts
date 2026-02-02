import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { AIClient } from "../ai/index.js";
import type { ParsedDiff } from "../diff/index.js";
import type { TriageResult } from "@repo/schemas/triage";
import { ErrorCode } from "@repo/schemas/errors";

const mockGitService = vi.hoisted(() => ({
  getDiff: vi.fn(),
  getStatus: vi.fn(),
  getHeadCommit: vi.fn(),
  getStatusHash: vi.fn(),
}));

const mockParseDiff = vi.hoisted(() => vi.fn());
const mockFilterDiffByFiles = vi.hoisted(() => vi.fn());
const mockTriageReviewStream = vi.hoisted(() => vi.fn());
const mockGetProfile = vi.hoisted(() => vi.fn());
const mockSaveTriageReview = vi.hoisted(() => vi.fn());

vi.mock("./git.js", () => ({
  createGitService: vi.fn(() => mockGitService),
}));

vi.mock("../diff/index.js", () => ({
  parseDiff: mockParseDiff,
  filterDiffByFiles: mockFilterDiffByFiles,
}));

vi.mock("../review/index.js", () => ({
  triageReviewStream: mockTriageReviewStream,
  getProfile: mockGetProfile,
}));

vi.mock("../storage/index.js", () => ({
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

    const setupSuccessfulTriage = () => {
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      mockGitService.getStatusHash.mockResolvedValue("M  file1.ts\nM  file2.ts");
      mockTriageReviewStream.mockResolvedValue({
        ok: true,
        value: { summary: "Test summary", issues: [] },
      });
      mockGitService.getStatus.mockResolvedValue({ branch: "main" });
      mockSaveTriageReview.mockResolvedValue({ ok: true, value: { id: "review-123" } });
    };

    it("validates diff size limit", async () => {
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
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
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      mockGitService.getDiff.mockResolvedValue("");

      await streamTriageToSSE(mockAIClient, { staged: true }, mockStream);

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "error",
        data: expect.stringContaining("No staged changes to review"),
      });
    });

    it("handles whitespace-only diff", async () => {
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      mockGitService.getDiff.mockResolvedValue("   \n\t\n  ");

      await streamTriageToSSE(mockAIClient, { staged: false }, mockStream);

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "error",
        data: expect.stringContaining("No unstaged changes to review"),
      });
    });

    it("filters diff by specified files", async () => {
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();
      const filteredDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockFilterDiffByFiles.mockReturnValue(filteredDiff);
      setupSuccessfulTriage();

      await streamTriageToSSE(
        mockAIClient,
        { staged: true, files: ["test.ts", "other.ts"] },
        mockStream
      );

      expect(mockFilterDiffByFiles).toHaveBeenCalledWith(parsedDiff, ["test.ts", "other.ts"]);
    });

    it("handles no files matching filter", async () => {
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
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

    it("calls triageReviewStream with correct parameters", async () => {
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      setupSuccessfulTriage();

      await streamTriageToSSE(
        mockAIClient,
        { staged: true, lenses: ["correctness", "security"] },
        mockStream
      );

      expect(mockTriageReviewStream).toHaveBeenCalledWith(
        mockAIClient,
        parsedDiff,
        expect.objectContaining({
          lenses: ["correctness", "security"],
        }),
        expect.any(Function)
      );
    });

    it("uses profile lenses when profile specified", async () => {
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockGetProfile.mockReturnValue({
        id: "strict",
        lenses: ["correctness", "security", "tests"],
        filter: { minSeverity: "all" },
      });
      setupSuccessfulTriage();

      await streamTriageToSSE(mockAIClient, { staged: true, profile: "strict" }, mockStream);

      expect(mockGetProfile).toHaveBeenCalledWith("strict");
      expect(mockTriageReviewStream).toHaveBeenCalledWith(
        mockAIClient,
        parsedDiff,
        expect.objectContaining({
          lenses: ["correctness", "security", "tests"],
        }),
        expect.any(Function)
      );
    });

    it("defaults to correctness lens when no lenses or profile", async () => {
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      setupSuccessfulTriage();

      await streamTriageToSSE(mockAIClient, { staged: true }, mockStream);

      expect(mockTriageReviewStream).toHaveBeenCalledWith(
        mockAIClient,
        parsedDiff,
        expect.objectContaining({
          lenses: ["correctness"],
        }),
        expect.any(Function)
      );
    });

    it("saves review with metadata", async () => {
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockTriageReviewStream.mockResolvedValue({
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
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockTriageReviewStream.mockResolvedValue({
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
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      mockGitService.getDiff.mockRejectedValue(new Error("Git not found"));

      await streamTriageToSSE(mockAIClient, { staged: true }, mockStream);

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "error",
        data: expect.stringContaining("code"),
      });
    });

    it("handles triage review error", async () => {
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockTriageReviewStream.mockResolvedValue({
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
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockTriageReviewStream.mockResolvedValue({
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
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      mockGitService.getDiff.mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      await streamTriageToSSE(mockAIClient, { staged: true }, mockStream);

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "error",
        data: expect.stringContaining("Unexpected error"),
      });
    });

    it("applies profile filter to triage stream", async () => {
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockGetProfile.mockReturnValue({
        id: "quick",
        lenses: ["correctness"],
        filter: { minSeverity: "high" },
      });
      setupSuccessfulTriage();

      await streamTriageToSSE(mockAIClient, { staged: true, profile: "quick" }, mockStream);

      expect(mockTriageReviewStream).toHaveBeenCalledWith(
        mockAIClient,
        parsedDiff,
        expect.objectContaining({
          filter: { minSeverity: "high" },
        }),
        expect.any(Function)
      );
    });

    it("handles git status failure gracefully", async () => {
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockTriageReviewStream.mockResolvedValue({
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
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      setupSuccessfulTriage();

      await streamTriageToSSE(mockAIClient, { staged: false }, mockStream);

      expect(mockGitService.getDiff).toHaveBeenCalledWith(false);
      expect(mockSaveTriageReview).toHaveBeenCalledWith(
        expect.objectContaining({
          staged: false,
        })
      );
    });

    it("forwards agent events to SSE stream", async () => {
      mockGitService.getHeadCommit.mockResolvedValue("abc123");
      mockGitService.getStatusHash.mockResolvedValue("M  test.ts");
      const diff = "diff content";
      const parsedDiff = createMockParsedDiff();

      mockGitService.getDiff.mockResolvedValue(diff);
      mockParseDiff.mockReturnValue(parsedDiff);
      mockTriageReviewStream.mockImplementation(async (_client, _diff, _options, onEvent) => {
        onEvent({ type: "agent_start", agent: { id: "detective", name: "Detective" }, timestamp: "2024-01-01T00:00:00Z" });
        onEvent({ type: "agent_complete", agent: "detective", issueCount: 0, timestamp: "2024-01-01T00:00:01Z" });
        return { ok: true, value: { summary: "Test", issues: [] } };
      });
      mockGitService.getStatus.mockResolvedValue({ branch: "main" });
      mockSaveTriageReview.mockResolvedValue({ ok: true, value: { id: "review-123" } });

      await streamTriageToSSE(mockAIClient, { staged: true }, mockStream);

      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "agent_start",
        data: expect.stringContaining('"type":"agent_start"'),
      });
      expect(mockStream.writeSSE).toHaveBeenCalledWith({
        event: "agent_complete",
        data: expect.stringContaining('"type":"agent_complete"'),
      });
    });
  });
});
