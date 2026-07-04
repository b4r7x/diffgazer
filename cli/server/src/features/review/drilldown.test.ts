import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Result } from "@diffgazer/core/result";
import { err, ok } from "@diffgazer/core/result";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import type { AIClient, AIError } from "../../shared/lib/ai/types.js";
import { makeIssue } from "../../shared/lib/testing/factories.js";
import { parseDiff } from "./engine/diff/parser.js";
import type { ParsedDiff } from "./engine/diff/types.js";
import type { DrilldownAIResponse } from "./schemas.js";

// Boundary mock: git/service wraps the `git` CLI subprocess (external-process boundary); tests provide canned diff/blame/file-lines responses so drilldown behavior can be exercised without a real repository.
vi.mock("../../shared/lib/git/service.js", () => ({
  createGitService: vi.fn(),
}));

import { createGitService } from "../../shared/lib/git/service.js";

type GitService = ReturnType<typeof createGitService>;

const REVIEW_ID = "550e8400-e29b-41d4-a716-446655440000";
let tempHome: string;

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
    getStatus: vi.fn(async () =>
      ok({
        isGitRepo: true,
        branch: "main",
        remoteBranch: null,
        ahead: 0,
        behind: 0,
        files: { staged: [], unstaged: [], untracked: [] },
        hasChanges: true,
        conflicted: [],
      }),
    ),
    getDiff: async () => ok(DIFF),
    isGitInstalled: vi.fn(async () => true),
    getHeadCommit: vi.fn(async () => ok("HEAD")),
    getStatusHash: vi.fn(async () => ({ kind: "full" as const, hash: "hash-1" })),
    ...overrides,
  };
}

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "diffgazer-drilldown-"));
  process.env.DIFFGAZER_HOME = tempHome;
  vi.resetModules();
  vi.clearAllMocks();
  vi.mocked(createGitService).mockReturnValue(makeGitService());
});

afterEach(async () => {
  delete process.env.DIFFGAZER_HOME;
  // Reviews storage persists the project index and migrations as fire-and-forget
  // writes that can still be recreating .index/ when teardown runs; retry past the
  // resulting ENOTEMPTY race.
  await rm(tempHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
});

async function loadDrilldown() {
  return import("./drilldown.js");
}

async function loadReviewStorage() {
  return import("./storage/reviews.js");
}

function makeMockClient(
  generateResult: Result<DrilldownAIResponse, AIError> = ok({
    detailedAnalysis: "analysis",
    rootCause: "cause",
    impact: "impact",
    suggestedFix: "fix",
    patch: null,
    relatedIssues: [],
    references: [],
  }),
): AIClient {
  return {
    provider: "openrouter",
    generate: async <T extends z.ZodType>(_prompt: string, schema: T) => {
      if (!generateResult.ok) {
        return generateResult;
      }

      return ok(schema.parse(generateResult.value) as z.output<T>);
    },
  };
}

async function saveReviewWithIssues(
  issues: ReviewIssue[],
  projectPath = "/project",
): Promise<void> {
  const { saveReview } = await loadReviewStorage();
  const result = await saveReview({
    reviewId: REVIEW_ID,
    projectPath,
    mode: "unstaged",
    branch: "main",
    commit: "abc123",
    lenses: ["correctness"],
    diff: parseDiff(DIFF),
    result: { summary: "summary", issues },
  });
  expect(result.ok).toBe(true);
}

async function removeStoredDiff(): Promise<void> {
  const reviewPath = join(tempHome, "triage-reviews", `${REVIEW_ID}.json`);
  const review = JSON.parse(await readFile(reviewPath, "utf-8"));
  delete review.diff;
  await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf-8");
}

describe("drilldownIssue", () => {
  it("uses the parsed diff context and returns the AI analysis with a trace step", async () => {
    const { drilldownIssue } = await loadDrilldown();
    const issue = makeIssue({ file: "src/app.ts", line_start: 1, line_end: 2 });
    const diff = parseDiff(DIFF);
    const client = makeMockClient();

    const result = await drilldownIssue(client, issue, diff, []);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        issueId: "issue-1",
        issue,
        detailedAnalysis: "analysis",
        rootCause: "cause",
      });
      // The drilldown records a real generateAnalysis trace step, not fabricated
      // readFileContext tool events.
      expect(result.value.trace?.[0]?.tool).toBe("generateAnalysis");
    }
  });

  it("strips terminal escape bytes from the AI analysis before returning it", async () => {
    const { drilldownIssue } = await loadDrilldown();
    const esc = "\u001b";
    const osc52 = `${esc}]52;c;payload\u0007`;

    const result = await drilldownIssue(
      makeMockClient(
        ok({
          detailedAnalysis: `analysis${osc52}`,
          rootCause: `cause${osc52}`,
          impact: `impact${osc52}`,
          suggestedFix: `fix${osc52}`,
          patch: `patch${osc52}`,
          relatedIssues: [`related${osc52}`],
          references: [`reference${osc52}`],
        }),
      ),
      makeIssue(),
      parseDiff(DIFF),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.stringify(result.value)).not.toContain(esc);
      expect(result.value).toMatchObject({
        detailedAnalysis: "analysis",
        rootCause: "cause",
        impact: "impact",
        suggestedFix: "fix",
        patch: "patch",
        relatedIssues: ["related"],
        references: ["reference"],
      });
    }
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
  it("loads a persisted review, uses its stored diff, and stores the drilldown", async () => {
    const issue = makeIssue({ id: "issue-1" });
    await saveReviewWithIssues([issue]);
    vi.mocked(createGitService).mockClear();
    const { handleDrilldownRequest } = await loadDrilldown();
    const { getReview } = await loadReviewStorage();

    const result = await handleDrilldownRequest(makeMockClient(), REVIEW_ID, "issue-1", "/project");

    expect(result.ok).toBe(true);
    expect(createGitService).not.toHaveBeenCalled();
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

    const missingReview = await handleDrilldownRequest(
      makeMockClient(),
      REVIEW_ID,
      "issue-1",
      "/project",
    );
    expect(missingReview.ok).toBe(false);
    if (!missingReview.ok) expect(missingReview.error.code).toBe("NOT_FOUND");

    await saveReviewWithIssues([makeIssue()]);
    await removeStoredDiff();
    const missingDiff = await handleDrilldownRequest(
      makeMockClient(),
      REVIEW_ID,
      "issue-1",
      "/project",
    );
    expect(missingDiff.ok).toBe(false);
    if (!missingDiff.ok) expect(missingDiff.error.code).toBe("COMMAND_FAILED");

    await saveReviewWithIssues([makeIssue()]);
    const missingIssue = await handleDrilldownRequest(
      makeMockClient(),
      REVIEW_ID,
      "missing",
      "/project",
    );
    expect(missingIssue.ok).toBe(false);
    if (!missingIssue.ok) expect(missingIssue.error.code).toBe("ISSUE_NOT_FOUND");
  });

  it("does not run drilldown against a review from another project", async () => {
    await saveReviewWithIssues([makeIssue({ id: "issue-1" })], "/other-project");
    const { handleDrilldownRequest } = await loadDrilldown();
    const { getReview } = await loadReviewStorage();

    const result = await handleDrilldownRequest(makeMockClient(), REVIEW_ID, "issue-1", "/project");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");

    const stored = await getReview(REVIEW_ID);
    expect(stored.ok).toBe(true);
    if (stored.ok) {
      expect(stored.value.drilldowns ?? []).toEqual([]);
    }
  });
});
