import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import type { ReviewIssue, ReviewResult } from "@diffgazer/core/schemas/review";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { err, ok } from "@diffgazer/core/result";
import type { SSEWriter } from "../../shared/lib/http/types.js";
import type { AIClient } from "../../shared/lib/ai/types.js";
import type { createGitService as createGitServiceType } from "../../shared/lib/git/service.js";

vi.mock("../../shared/lib/git/service.js", () => ({
  createGitService: vi.fn(),
}));

type GitService = ReturnType<typeof createGitServiceType>;
type ServiceModule = typeof import("./service.js");
type SessionsModule = typeof import("./sessions.js");
type GitModule = typeof import("../../shared/lib/git/service.js");
type ReviewStorageModule = typeof import("../../shared/lib/storage/reviews.js");

const REVIEW_DIFF = [
  "diff --git a/src/app.ts b/src/app.ts",
  "index 1111111..2222222 100644",
  "--- a/src/app.ts",
  "+++ b/src/app.ts",
  "@@ -1,3 +1,4 @@",
  " export function add(a: number, b: number) {",
  "+  return a - b;",
  " }",
].join("\n");

let streamActiveSessionToSSE: ServiceModule["streamActiveSessionToSSE"];
let streamReviewToSSE: ServiceModule["streamReviewToSSE"];
let addEvent: SessionsModule["addEvent"];
let createSession: SessionsModule["createSession"];
let deleteSession: SessionsModule["deleteSession"];
let getSession: SessionsModule["getSession"];
let markReady: SessionsModule["markReady"];
let createGitService: GitModule["createGitService"];
let getReview: ReviewStorageModule["getReview"];
let originalDiffgazerHome: string | undefined;
let tempHome: string;
let projectRoot: string;

const createdSessionIds = new Set<string>();

function trackSession(reviewId: string): void {
  createdSessionIds.add(reviewId);
}

function cleanupTrackedSessions(): void {
  for (const id of createdSessionIds) {
    deleteSession(id);
  }
  createdSessionIds.clear();
}

function makeProjectRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "diffgazer-review-service-project-"));
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "0.0.0" }));
  writeFileSync(join(root, "README.md"), "# Fixture\n");
  writeFileSync(join(root, "src/app.ts"), "export function add(a: number, b: number) {\n  return a + b;\n}\n");
  return root;
}

function makeMockStream(): SSEWriter & { events: Array<{ event: string; data: string }> } {
  const events: Array<{ event: string; data: string }> = [];
  return {
    events,
    writeSSE: vi.fn(async (payload: { event: string; data: string }) => {
      events.push(payload);
      const parsed = JSON.parse(payload.data) as FullReviewStreamEvent;
      if ("reviewId" in parsed && typeof parsed.reviewId === "string") {
        trackSession(parsed.reviewId);
      }
    }),
  };
}

function parsedEvents(stream: { events: Array<{ data: string }> }): FullReviewStreamEvent[] {
  return stream.events.map((event) => JSON.parse(event.data) as FullReviewStreamEvent);
}

function makeGitService(options: {
  diff?: string;
  headCommit?: string;
  headCommitError?: string;
  statusHash?: string;
} = {}): GitService {
  const {
    diff = REVIEW_DIFF,
    headCommit = "abc123",
    headCommitError,
    statusHash = "hash123",
  } = options;

  return {
    getStatus: async () => ({
      isGitRepo: true,
      branch: "main",
      remoteBranch: null,
      ahead: 0,
      behind: 0,
      files: { staged: [], unstaged: [], untracked: [] },
      hasChanges: false,
      conflicted: [],
    }),
    getDiff: async () => diff,
    isGitInstalled: async () => true,
    getBlame: async () => ({
      author: "Test Author",
      authorEmail: "author@example.com",
      commit: "abc123",
      commitDate: "2026-05-11T00:00:00.000Z",
      summary: "Fixture commit",
    }),
    getFileLines: async () => [
      "export function add(a: number, b: number) {",
      "  return a + b;",
      "}",
    ],
    getHeadCommit: async () =>
      headCommitError ? err({ message: headCommitError }) : ok(headCommit),
    getStatusHash: async () => statusHash,
  };
}

function makeReviewIssue(overrides: Partial<ReviewIssue> = {}): ReviewIssue {
  return {
    id: "issue-1",
    severity: "high",
    category: "correctness",
    title: "Subtraction used in addition helper",
    file: "src/app.ts",
    line_start: 2,
    line_end: 2,
    rationale: "The changed implementation subtracts instead of adding.",
    recommendation: "Return a + b.",
    suggested_patch: null,
    confidence: 0.95,
    symptom: "The add helper returns the wrong result.",
    whyItMatters: "Callers receive incorrect arithmetic results.",
    evidence: [],
    ...overrides,
  };
}

function makeAIClient(result: ReviewResult = {
  summary: "Model found one correctness issue.",
  issues: [makeReviewIssue()],
}): AIClient {
  const generate: AIClient["generate"] = async <T extends z.ZodType>(
    _prompt: string,
    schema: T,
    _options?: { signal?: AbortSignal },
  ) => ok(schema.parse(result));

  return {
    provider: "openrouter",
    generate,
    generateStream: async () => {},
  };
}

function findCompleteEvent(events: FullReviewStreamEvent[]): Extract<FullReviewStreamEvent, { type: "complete" }> {
  const completeEvent = events.find(
    (event): event is Extract<FullReviewStreamEvent, { type: "complete" }> =>
      event.type === "complete",
  );
  if (!completeEvent) {
    throw new Error("Expected a complete review event");
  }
  return completeEvent;
}

beforeAll(async () => {
  originalDiffgazerHome = process.env.DIFFGAZER_HOME;
  tempHome = mkdtempSync(join(tmpdir(), "diffgazer-review-service-home-"));
  process.env.DIFFGAZER_HOME = tempHome;
  writeFileSync(
    join(tempHome, "config.json"),
    JSON.stringify({ settings: { defaultLenses: ["correctness"], agentExecution: "sequential" } }),
  );

  const service = await import("./service.js");
  const sessions = await import("./sessions.js");
  const git = await import("../../shared/lib/git/service.js");
  const reviewStorage = await import("../../shared/lib/storage/reviews.js");

  streamActiveSessionToSSE = service.streamActiveSessionToSSE;
  streamReviewToSSE = service.streamReviewToSSE;
  addEvent = sessions.addEvent;
  createSession = sessions.createSession;
  deleteSession = sessions.deleteSession;
  getSession = sessions.getSession;
  markReady = sessions.markReady;
  createGitService = git.createGitService;
  getReview = reviewStorage.getReview;
});

beforeEach(() => {
  vi.resetAllMocks();
  projectRoot = makeProjectRoot();
  vi.mocked(createGitService).mockReturnValue(makeGitService());
});

afterEach(() => {
  cleanupTrackedSessions();
  rmSync(projectRoot, { recursive: true, force: true });
  vi.useRealTimers();
});

afterAll(() => {
  rmSync(tempHome, { recursive: true, force: true });
  if (originalDiffgazerHome === undefined) {
    delete process.env.DIFFGAZER_HOME;
  } else {
    process.env.DIFFGAZER_HOME = originalDiffgazerHome;
  }
});

describe("streamActiveSessionToSSE", () => {
  it("replays buffered events to the SSE stream", async () => {
    const stream = makeMockStream();
    const session = createSession("replay-session", projectRoot, "abc123", "hash123", "unstaged");
    trackSession(session.reviewId);
    const events: FullReviewStreamEvent[] = [
      { type: "step_start", step: "diff", timestamp: new Date().toISOString() },
      { type: "complete", result: { issues: [], summary: "Clean" }, reviewId: session.reviewId, durationMs: 100 },
    ];
    session.events.push(...events);
    session.isComplete = true;

    await streamActiveSessionToSSE(stream, session);

    expect(parsedEvents(stream)).toEqual(events);
  });

  it("streams live events until a terminal event arrives", async () => {
    const stream = makeMockStream();
    const session = createSession("live-session", projectRoot, "abc123", "hash123", "unstaged");
    trackSession(session.reviewId);

    const replay = streamActiveSessionToSSE(stream, session);
    addEvent(session.reviewId, {
      type: "complete",
      result: { issues: [], summary: "Clean" },
      reviewId: session.reviewId,
      durationMs: 50,
    });

    await replay;

    expect(parsedEvents(stream)).toMatchObject([
      { type: "complete", reviewId: session.reviewId },
    ]);
  });

  it("writes a stale error when the session cannot be subscribed", async () => {
    const stream = makeMockStream();
    const session = createSession("stale-session", projectRoot, "abc123", "hash123", "unstaged");
    trackSession(session.reviewId);
    deleteSession(session.reviewId);

    await streamActiveSessionToSSE(stream, session);

    expect(parsedEvents(stream)).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.SESSION_STALE } },
    ]);
  });

  it("stops without writing when the client aborts", async () => {
    const stream = makeMockStream();
    const session = createSession("abort-session", projectRoot, "abc123", "hash123", "unstaged");
    const controller = new AbortController();
    trackSession(session.reviewId);

    const replay = streamActiveSessionToSSE(stream, session, controller.signal);
    controller.abort();

    await replay;

    expect(stream.events).toEqual([]);
  });

  it("writes a terminal event discovered after subscription", async () => {
    vi.useFakeTimers();
    const stream = makeMockStream();
    const session = createSession("poll-session", projectRoot, "abc123", "hash123", "unstaged");
    trackSession(session.reviewId);

    const replay = streamActiveSessionToSSE(stream, session);
    session.events.push({
      type: "complete",
      result: { issues: [], summary: "Clean" },
      reviewId: session.reviewId,
      durationMs: 200,
    });
    session.isComplete = true;

    await vi.advanceTimersByTimeAsync(250);
    await replay;

    expect(parsedEvents(stream)).toMatchObject([
      { type: "complete", reviewId: session.reviewId },
    ]);
  });
});

describe("streamReviewToSSE", () => {
  it("replays a matching active session instead of starting a new review", async () => {
    const stream = makeMockStream();
    const existing = createSession("existing-session", projectRoot, "abc123", "hash123", "unstaged");
    trackSession(existing.reviewId);
    markReady(existing.reviewId);
    addEvent(existing.reviewId, {
      type: "complete",
      result: { issues: [], summary: "Already done" },
      reviewId: existing.reviewId,
      durationMs: 100,
    });

    await streamReviewToSSE(makeAIClient(), { mode: "unstaged", projectPath: projectRoot }, stream);

    expect(parsedEvents(stream)).toMatchObject([
      { type: "complete", reviewId: existing.reviewId },
    ]);
    expect(stream.events).toHaveLength(1);
  });

  it("streams review progress, issue events, completion, and persisted review data", async () => {
    const stream = makeMockStream();

    await streamReviewToSSE(makeAIClient(), { mode: "unstaged", projectPath: projectRoot }, stream);

    const events = parsedEvents(stream);
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining([
      "step_start",
      "review_started",
      "orchestrator_start",
      "issue_found",
      "complete",
    ]));

    const issueEvent = events.find((event) => event.type === "issue_found");
    expect(issueEvent).toMatchObject({
      type: "issue_found",
      issue: { title: "Subtraction used in addition helper", file: "src/app.ts" },
    });

    const completeEvent = findCompleteEvent(events);
    expect(completeEvent.result.issues).toHaveLength(1);
    expect(completeEvent.result.summary).toContain("Found 1 issue across 1 file.");
    expect(getSession(completeEvent.reviewId)?.isComplete).toBe(true);

    const savedReview = await getReview(completeEvent.reviewId);
    expect(savedReview.ok).toBe(true);
    if (savedReview.ok) {
      expect(savedReview.value.metadata).toMatchObject({
        id: completeEvent.reviewId,
        projectPath: projectRoot,
        mode: "unstaged",
        issueCount: 1,
      });
    }
  });

  it("cancels stale in-flight reviews for the same project and mode before streaming the new result", async () => {
    const stream = makeMockStream();
    const stale = createSession("stale-review", projectRoot, "old-head", "old-hash", "unstaged");
    trackSession(stale.reviewId);
    markReady(stale.reviewId);

    await streamReviewToSSE(makeAIClient(), { mode: "unstaged", projectPath: projectRoot }, stream);

    expect(stale.isComplete).toBe(true);
    expect(stale.controller.signal.aborted).toBe(true);
    expect(stale.events).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.SESSION_STALE } },
    ]);
    expect(parsedEvents(stream).some((event) => event.type === "complete")).toBe(true);
  });

  it("does not start a review when the client signal is already aborted", async () => {
    const stream = makeMockStream();
    const controller = new AbortController();
    controller.abort();

    await streamReviewToSSE(makeAIClient(), { mode: "unstaged", projectPath: projectRoot }, stream, controller.signal);

    expect(stream.events).toEqual([]);
    expect(createGitService).not.toHaveBeenCalled();
  });

  it("streams step and terminal errors from the real diff pipeline", async () => {
    const stream = makeMockStream();
    vi.mocked(createGitService).mockReturnValue(makeGitService({ diff: "" }));

    await streamReviewToSSE(makeAIClient(), { mode: "unstaged", projectPath: projectRoot }, stream);

    expect(parsedEvents(stream)).toMatchObject([
      { type: "step_start", step: "diff" },
      { type: "step_error", step: "diff", error: expect.stringContaining("No unstaged changes found") },
      { type: "error", error: { code: ReviewErrorCode.NO_DIFF, message: expect.stringContaining("No unstaged changes found") } },
    ]);
  });

  it("streams repository inspection failures before creating a review session", async () => {
    const stream = makeMockStream();
    vi.mocked(createGitService).mockReturnValue(makeGitService({ headCommitError: "HEAD unavailable" }));

    await streamReviewToSSE(makeAIClient(), { mode: "unstaged", projectPath: projectRoot }, stream);

    expect(parsedEvents(stream)).toMatchObject([
      {
        type: "error",
        error: {
          code: ReviewErrorCode.GENERATION_FAILED,
          message: "Failed to inspect repository state: HEAD unavailable",
        },
      },
    ]);
  });

  it("rejects when the SSE stream closes while an error event is being written", async () => {
    const stream = makeMockStream();
    vi.mocked(createGitService).mockReturnValue(makeGitService({ headCommitError: "HEAD unavailable" }));
    stream.writeSSE = vi.fn().mockRejectedValue(new Error("stream closed"));

    await expect(
      streamReviewToSSE(makeAIClient(), { mode: "unstaged", projectPath: projectRoot }, stream),
    ).rejects.toThrow("stream closed");
  });
});
