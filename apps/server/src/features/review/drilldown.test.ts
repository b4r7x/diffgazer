import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, err } from "@diffgazer/core/result";

vi.mock("../../shared/lib/storage/reviews.js");
vi.mock("../../shared/lib/git/service.js");
vi.mock("../../shared/lib/diff/parser.js");
vi.mock("../../shared/lib/review/prompts.js");

import {
  getReview as getStoredReview,
  addDrilldownToReview,
} from "../../shared/lib/storage/reviews.js";
import { createGitService } from "../../shared/lib/git/service.js";
import { parseDiff } from "../../shared/lib/diff/parser.js";
import { buildDrilldownPrompt } from "../../shared/lib/review/prompts.js";
import type { AIClient } from "../../shared/lib/ai/types.js";
import type { ReviewIssue } from "@diffgazer/schemas/review";
import type { ParsedDiff, FileDiff } from "../../shared/lib/diff/types.js";
import {
  drilldownIssue,
  drilldownIssueById,
  handleDrilldownRequest,
} from "./drilldown.js";

function makeIssue(overrides: Partial<ReviewIssue> = {}): ReviewIssue {
  return {
    id: "issue-1",
    severity: "high",
    category: "correctness",
    title: "Test issue",
    file: "src/app.ts",
    line_start: 10,
    line_end: 15,
    rationale: "rationale",
    recommendation: "fix it",
    suggested_patch: null,
    confidence: 0.9,
    symptom: "symptom",
    whyItMatters: "matters",
    evidence: [],
    ...overrides,
  };
}

function makeFileDiff(filePath: string): FileDiff {
  return {
    filePath,
    previousPath: null,
    operation: "modify",
    hunks: [{ oldStart: 1, oldCount: 10, newStart: 1, newCount: 12, content: "" }],
    rawDiff: "line1\nline2\nline3",
    stats: { additions: 2, deletions: 0, sizeBytes: 30 },
  };
}

function makeParsedDiff(files: FileDiff[] = []): ParsedDiff {
  return {
    files,
    totalStats: { filesChanged: files.length, additions: 0, deletions: 0, totalSizeBytes: 0 },
  };
}

function makeMockClient(generateResult = ok({
  detailedAnalysis: "analysis",
  rootCause: "cause",
  impact: "impact",
  suggestedFix: "fix",
  patch: null,
  relatedIssues: [],
  references: [],
})): AIClient {
  return {
    provider: "openrouter",
    generate: vi.fn().mockResolvedValue(generateResult),
    generateStream: vi.fn(),
  };
}

describe("drilldownIssue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(buildDrilldownPrompt).mockReturnValue("prompt");
  });

  it("should find target file and emit tool events", async () => {
    const issue = makeIssue({ file: "src/app.ts", line_start: 10, line_end: 15 });
    const fileDiff = makeFileDiff("src/app.ts");
    const diff = makeParsedDiff([fileDiff]);
    const client = makeMockClient();
    const events: unknown[] = [];

    const result = await drilldownIssue(client, issue, diff, [], {
      onEvent: (e) => events.push(e),
    });

    expect(result.ok).toBe(true);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: "tool_call",
      agent: "detective",
      tool: "readFileContext",
      input: "src/app.ts:10-15",
    });
    expect(events[1]).toMatchObject({
      type: "tool_result",
      agent: "detective",
      tool: "readFileContext",
    });
  });

  it("should handle missing target file gracefully", async () => {
    const issue = makeIssue({ file: "nonexistent.ts" });
    const diff = makeParsedDiff([makeFileDiff("other.ts")]);
    const client = makeMockClient();
    const events: unknown[] = [];

    const result = await drilldownIssue(client, issue, diff, [], {
      onEvent: (e) => events.push(e),
    });

    expect(result.ok).toBe(true);
    // No tool_call/tool_result events when file not found
    expect(events).toHaveLength(0);
  });
});

describe("drilldownIssueById", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(buildDrilldownPrompt).mockReturnValue("prompt");
  });

  it("should return error when issue not found", async () => {
    const client = makeMockClient();
    const reviewResult = { summary: "summary", issues: [makeIssue({ id: "issue-1" })] };
    const diff = makeParsedDiff();

    const result = await drilldownIssueById(client, "nonexistent", reviewResult, diff);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ISSUE_NOT_FOUND");
      expect(result.error.message).toContain("nonexistent");
    }
  });

  it("should delegate to drilldownIssue for found issues", async () => {
    const issue = makeIssue({ id: "issue-1" });
    const client = makeMockClient();
    const reviewResult = { summary: "summary", issues: [issue] };
    const diff = makeParsedDiff([makeFileDiff("src/app.ts")]);

    const result = await drilldownIssueById(client, "issue-1", reviewResult, diff);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issueId).toBe("issue-1");
      expect(result.value.issue).toBe(issue);
    }
  });
});

describe("handleDrilldownRequest", () => {
  const mockGetDiff = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(buildDrilldownPrompt).mockReturnValue("prompt");
    vi.mocked(createGitService).mockReturnValue({
      getDiff: mockGetDiff,
    } as unknown as ReturnType<typeof createGitService>);
    vi.mocked(parseDiff).mockReturnValue(makeParsedDiff([makeFileDiff("src/app.ts")]));
  });

  it("should load review from storage and produce drilldown", async () => {
    const issue = makeIssue({ id: "issue-1" });
    const savedReview = {
      metadata: {
        id: "review-1",
        projectPath: "/project",
        createdAt: new Date().toISOString(),
        mode: "unstaged" as const,
        staged: false,
        branch: "main",
        profile: null,
        lenses: [],
        issueCount: 1,
        blockerCount: 0,
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
        nitCount: 0,
        fileCount: 1,
      },
      result: { summary: "summary", issues: [issue] },
      gitContext: { branch: "main", commit: "abc", fileCount: 1, additions: 1, deletions: 0 },
      drilldowns: [],
    };

    vi.mocked(getStoredReview).mockResolvedValue(ok(savedReview));
    mockGetDiff.mockResolvedValue("diff content");
    vi.mocked(addDrilldownToReview).mockResolvedValue(ok(undefined));

    const client = makeMockClient();
    const result = await handleDrilldownRequest(client, "review-1", "issue-1", "/project");

    expect(result.ok).toBe(true);
    expect(getStoredReview).toHaveBeenCalledWith("review-1");
    expect(addDrilldownToReview).toHaveBeenCalled();
  });

  it("should return error on storage failure", async () => {
    vi.mocked(getStoredReview).mockResolvedValue(
      err({ code: "NOT_FOUND" as const, message: "Review not found" }),
    );

    const client = makeMockClient();
    const result = await handleDrilldownRequest(client, "bad-id", "issue-1", "/project");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});
