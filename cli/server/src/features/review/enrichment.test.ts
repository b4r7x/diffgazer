import { describe, expect, it, vi } from "vitest";
import { makeIssue } from "../../shared/lib/testing/factories.js";
import { type EnrichGitService, enrichIssues } from "./enrichment.js";

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
  it("attaches git blame and surrounding context to each issue", async () => {
    const gitService = makeMockGitService();
    const issues = [makeIssue()];
    const onEvent = vi.fn();

    const result = await enrichIssues(issues, gitService, onEvent);

    expect(result).toHaveLength(1);
    expect(result[0]?.enrichment).not.toBeNull();
    expect(result[0]?.enrichment?.blame).toEqual({
      author: "John",
      authorEmail: "john@test.com",
      commit: "abc123",
      commitDate: "2024-01-01",
      summary: "initial commit",
    });
  });

  it("emits blame and context progress events in order", async () => {
    const gitService = makeMockGitService();
    const issues = [makeIssue()];
    const sequence: Array<{ enrichmentType: string; status: string }> = [];

    await enrichIssues(issues, gitService, (event) => {
      sequence.push({ enrichmentType: event.enrichmentType, status: event.status });
    });

    expect(sequence).toEqual([
      { enrichmentType: "blame", status: "started" },
      { enrichmentType: "blame", status: "complete" },
      { enrichmentType: "context", status: "started" },
      { enrichmentType: "context", status: "complete" },
    ]);
  });

  it("leaves blame and context null when the issue has no starting line", async () => {
    const gitService = makeMockGitService();
    const issues = [makeIssue({ line_start: null, line_end: null })];
    const onEvent = vi.fn();

    const result = await enrichIssues(issues, gitService, onEvent);

    expect(result[0]?.enrichment?.blame).toBeNull();
    expect(result[0]?.enrichment?.context).toBeNull();
    expect(gitService.getBlame).not.toHaveBeenCalled();
  });

  it("falls back to the original issue when blame retrieval throws", async () => {
    const gitService = makeMockGitService();
    vi.mocked(gitService.getBlame)
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("blame failed"));

    const issues = [makeIssue({ id: "i1" }), makeIssue({ id: "i2" })];
    const onEvent = vi.fn();

    const result = await enrichIssues(issues, gitService, onEvent);

    // First should succeed with null blame, second should fall back to original
    expect(result).toHaveLength(2);
    expect(result[0]?.enrichment?.blame).toBeNull();
    // Second issue failed entirely, falls back to original
    expect(result[1]?.id).toBe("i2");
  });

  it("returns the original issues unchanged when the signal is already aborted", async () => {
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

  it("returns an empty result for an empty issues list", async () => {
    const gitService = makeMockGitService();
    const onEvent = vi.fn();

    const result = await enrichIssues([], gitService, onEvent);

    expect(result).toEqual([]);
  });
});
