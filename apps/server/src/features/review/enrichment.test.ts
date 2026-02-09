import { describe, it, expect, vi } from "vitest";
import { enrichIssues, type EnrichGitService } from "./enrichment.js";
import type { ReviewIssue } from "@diffgazer/schemas/review";

const makeIssue = (overrides: Partial<ReviewIssue> = {}): ReviewIssue =>
  ({
    id: "issue-1",
    file: "src/index.ts",
    severity: "high",
    title: "Test issue",
    description: "desc",
    lens: "correctness",
    line_start: 10,
    line_end: 15,
    suggestion: null,
    enrichment: null,
    ...overrides,
  }) as ReviewIssue;

const makeMockGitService = (): EnrichGitService => ({
  getBlame: vi.fn().mockResolvedValue({
    author: "John",
    authorEmail: "john@test.com",
    commit: "abc123",
    commitDate: "2024-01-01",
    summary: "initial commit",
  }),
  getFileLines: vi.fn().mockResolvedValue([
    "line 1",
    "line 2",
    "line 3",
    "line 4",
    "line 5",
    "line 6",
    "line 7",
    "line 8",
    "line 9",
    "line 10",
    "line 11",
  ]),
});

describe("enrichIssues", () => {
  it("should enrich issues with blame and context", async () => {
    const gitService = makeMockGitService();
    const issues = [makeIssue()];
    const onEvent = vi.fn();

    const result = await enrichIssues(issues, gitService, onEvent);

    expect(result).toHaveLength(1);
    expect(result[0]!.enrichment).not.toBeNull();
    expect(result[0]!.enrichment!.blame).toEqual({
      author: "John",
      authorEmail: "john@test.com",
      commit: "abc123",
      commitDate: "2024-01-01",
      summary: "initial commit",
    });
  });

  it("should emit progress events for blame and context", async () => {
    const gitService = makeMockGitService();
    const issues = [makeIssue()];
    const onEvent = vi.fn();

    await enrichIssues(issues, gitService, onEvent);

    const blameEvents = onEvent.mock.calls.filter(
      ([e]) => e.enrichmentType === "blame",
    );
    expect(blameEvents).toHaveLength(2); // started + complete

    const contextEvents = onEvent.mock.calls.filter(
      ([e]) => e.enrichmentType === "context",
    );
    expect(contextEvents).toHaveLength(2); // started + complete
  });

  it("should skip blame/context for issues without line_start", async () => {
    const gitService = makeMockGitService();
    const issues = [makeIssue({ line_start: null, line_end: null })];
    const onEvent = vi.fn();

    const result = await enrichIssues(issues, gitService, onEvent);

    expect(result[0]!.enrichment!.blame).toBeNull();
    expect(result[0]!.enrichment!.context).toBeNull();
    expect(gitService.getBlame).not.toHaveBeenCalled();
  });

  it("should handle partial failures gracefully", async () => {
    const gitService = makeMockGitService();
    vi.mocked(gitService.getBlame)
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("blame failed"));

    const issues = [makeIssue({ id: "i1" }), makeIssue({ id: "i2" })];
    const onEvent = vi.fn();

    const result = await enrichIssues(issues, gitService, onEvent);

    // First should succeed with null blame, second should fall back to original
    expect(result).toHaveLength(2);
    expect(result[0]!.enrichment!.blame).toBeNull();
    // Second issue failed entirely, falls back to original
    expect(result[1]!.id).toBe("i2");
  });

  it("should return original issues when signal is already aborted", async () => {
    const gitService = makeMockGitService();
    const issues = [makeIssue()];
    const onEvent = vi.fn();
    const controller = new AbortController();
    controller.abort();

    const result = await enrichIssues(
      issues,
      gitService,
      onEvent,
      controller.signal,
    );

    expect(result).toBe(issues);
    expect(gitService.getBlame).not.toHaveBeenCalled();
  });

  it("should handle empty issues array", async () => {
    const gitService = makeMockGitService();
    const onEvent = vi.fn();

    const result = await enrichIssues([], gitService, onEvent);

    expect(result).toEqual([]);
  });
});
