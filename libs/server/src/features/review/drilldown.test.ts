import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ok, err } from "@diffgazer/core/result";
import type { Result } from "@diffgazer/core/result";
import type { AIClient } from "../../shared/lib/ai/types.js";
import type { AIError } from "../../shared/lib/ai/types.js";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import type { ParsedDiff } from "../../shared/lib/diff/types.js";
import { makeIssue } from "../../shared/lib/testing/factories.js";
import { parseDiff } from "../../shared/lib/diff/parser.js";
import type { DrilldownAIResponse } from "./schemas.js";
import type { z } from "zod";

vi.mock("../../shared/lib/git/service.js", () => ({
  createGitService: vi.fn(),
}));

import { createGitService } from "../../shared/lib/git/service.js";

type GitService = ReturnType<typeof createGitService>;

const REVIEW_ID = "550e8400-e29b-41d4-a716-446655440000";
let tempHome: string;
let failNextDiff = false;

const DIFF = [
  "diff --git a/src/app.ts b/src/app.ts",
  "index 1111111..2222222 100644",
  "--- a/src/app.ts",
  "+++ b/src/app.ts",
  "@@ -1,2 +1,3 @@",
  " export const a = 1;",
  "+export const b = 2;",
  " export const c = 3;",
  "",
].join("\n");

function makeGitService(overrides: Partial<GitService> = {}): GitService {
  return {
    getStatus: vi.fn(async () => ({
      isGitRepo: true,
      branch: "main",
      remoteBranch: null,
      ahead: 0,
      behind: 0,
      files: { staged: [], unstaged: [], untracked: [] },
      hasChanges: true,
      conflicted: [],
    })),
    getDiff: async () => {
      if (failNextDiff) {
        failNextDiff = false;
        throw new Error("git failed");
      }
      return DIFF;
    },
    isGitInstalled: vi.fn(async () => true),
    getBlame: vi.fn(async () => null),
    getFileLines: vi.fn(async () => []),
    getHeadCommit: vi.fn(async () => ok("HEAD")),
    getStatusHash: vi.fn(async () => "hash-1"),
    ...overrides,
  };
}

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "diffgazer-drilldown-"));
  process.env.DIFFGAZER_HOME = tempHome;
  failNextDiff = false;
  vi.resetModules();
  vi.mocked(createGitService).mockReturnValue(makeGitService());
});

afterEach(async () => {
  delete process.env.DIFFGAZER_HOME;
  await rm(tempHome, { recursive: true, force: true });
});

async function loadDrilldown() {
  return import("./drilldown.js");
}

async function loadReviewStorage() {
  return import("../../shared/lib/storage/reviews.js");
}

function makeMockClient(generateResult: Result<DrilldownAIResponse, AIError> = ok({
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
    generate: async <T extends z.ZodType>(_prompt: string, schema: T) => {
      if (!generateResult.ok) {
        return generateResult;
      }

      return ok(schema.parse(generateResult.value) as z.output<T>);
    },
    generateStream: vi.fn(),
  };
}

async function saveReviewWithIssues(issues: ReviewIssue[]): Promise<void> {
  const { saveReview } = await loadReviewStorage();
  const result = await saveReview({
    reviewId: REVIEW_ID,
    projectPath: "/project",
    mode: "unstaged",
    branch: "main",
    commit: "abc123",
    lenses: ["correctness"],
    diff: parseDiff(DIFF),
    result: { summary: "summary", issues },
  });
  expect(result.ok).toBe(true);
}

describe("drilldownIssue", () => {
  it("uses the parsed diff context and returns the AI analysis with trace events", async () => {
    const { drilldownIssue } = await loadDrilldown();
    const issue = makeIssue({ file: "src/app.ts", line_start: 1, line_end: 2 });
    const diff = parseDiff(DIFF);
    const client = makeMockClient();
    const events: unknown[] = [];

    const result = await drilldownIssue(client, issue, diff, [], {
      onEvent: (event) => events.push(event),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        issueId: "issue-1",
        issue,
        detailedAnalysis: "analysis",
        rootCause: "cause",
      });
    }
    expect(events).toMatchObject([
      {
        type: "tool_call",
        agent: "detective",
        tool: "readFileContext",
        input: "src/app.ts:1-2",
      },
      {
        type: "tool_result",
        agent: "detective",
        tool: "readFileContext",
        summary: expect.stringContaining("src/app.ts"),
      },
    ]);
  });

  it("does not emit file-context events when the issue file is absent from the diff", async () => {
    const { drilldownIssue } = await loadDrilldown();
    const issue = makeIssue({ file: "src/missing.ts" });
    const client = makeMockClient();
    const events: unknown[] = [];

    const result = await drilldownIssue(client, issue, parseDiff(DIFF), [], {
      onEvent: (event) => events.push(event),
    });

    expect(result.ok).toBe(true);
    expect(events).toEqual([]);
  });

  it("returns AI generation failures", async () => {
    const { drilldownIssue } = await loadDrilldown();
    const result = await drilldownIssue(
      makeMockClient(err({ code: "MODEL_ERROR", message: "model failed" })),
      makeIssue(),
      parseDiff(DIFF),
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "MODEL_ERROR", message: "model failed" },
    });
  });
});

describe("drilldownIssueById", () => {
  it("returns ISSUE_NOT_FOUND when the requested issue is absent", async () => {
    const { drilldownIssueById } = await loadDrilldown();
    const reviewResult = { summary: "summary", issues: [makeIssue({ id: "issue-1" })] };

    const result = await drilldownIssueById(
      makeMockClient(),
      "missing",
      reviewResult,
      parseDiff(DIFF),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ISSUE_NOT_FOUND");
      expect(result.error.message).toContain("missing");
    }
  });

  it("returns drilldown analysis for the matching issue", async () => {
    const { drilldownIssueById } = await loadDrilldown();
    const issue = makeIssue({ id: "issue-1" });
    const reviewResult = { summary: "summary", issues: [issue] };
    const diff: ParsedDiff = parseDiff(DIFF);

    const result = await drilldownIssueById(makeMockClient(), "issue-1", reviewResult, diff);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issueId).toBe("issue-1");
      expect(result.value.issue).toBe(issue);
    }
  });
});

describe("handleDrilldownRequest", () => {
  it("loads a persisted review, parses the current git diff, and stores the drilldown", async () => {
    const issue = makeIssue({ id: "issue-1" });
    await saveReviewWithIssues([issue]);
    const { handleDrilldownRequest } = await loadDrilldown();
    const { getReview } = await loadReviewStorage();

    const result = await handleDrilldownRequest(
      makeMockClient(),
      REVIEW_ID,
      "issue-1",
      "/project",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        issueId: "issue-1",
        detailedAnalysis: "analysis",
      });
    }

    const stored = await getReview(REVIEW_ID);
    expect(stored.ok).toBe(true);
    if (stored.ok) {
      expect(stored.value.drilldowns).toMatchObject([
        { issueId: "issue-1", detailedAnalysis: "analysis" },
      ]);
    }
  });

  it("returns storage, git, and issue lookup failures as observable errors", async () => {
    const { handleDrilldownRequest } = await loadDrilldown();

    const missingReview = await handleDrilldownRequest(makeMockClient(), REVIEW_ID, "issue-1", "/project");
    expect(missingReview.ok).toBe(false);
    if (!missingReview.ok) expect(missingReview.error.code).toBe("NOT_FOUND");

    await saveReviewWithIssues([makeIssue()]);
    failNextDiff = true;
    const gitFailure = await handleDrilldownRequest(makeMockClient(), REVIEW_ID, "issue-1", "/project");
    expect(gitFailure.ok).toBe(false);
    if (!gitFailure.ok) expect(gitFailure.error.code).toBe("COMMAND_FAILED");

    const missingIssue = await handleDrilldownRequest(makeMockClient(), REVIEW_ID, "missing", "/project");
    expect(missingIssue.ok).toBe(false);
    if (!missingIssue.ok) expect(missingIssue.error.code).toBe("ISSUE_NOT_FOUND");
  });
});
