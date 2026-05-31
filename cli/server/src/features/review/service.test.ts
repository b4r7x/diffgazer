import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import type { ReviewResult } from "@diffgazer/core/schemas/review";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { err, ok } from "@diffgazer/core/result";
import type { SSEWriter } from "../../shared/lib/http/types.js";
import type { AIClient } from "../../shared/lib/ai/types.js";
import type { createGitService as createGitServiceType } from "../../shared/lib/git/service.js";
import { makeIssue } from "../../shared/lib/testing/factories.js";

// Boundary mock: git/service wraps the `git` CLI subprocess (external-process boundary); tests provide canned status/diff responses so review session lifecycle can be exercised without a real repository.
vi.mock("../../shared/lib/git/service.js", () => ({
  createGitService: vi.fn(),
}));

type GitService = ReturnType<typeof createGitServiceType>;
type ServiceModule = typeof import("./service.js");
type SseReplayModule = typeof import("./sse-replay.js");
type SessionsModule = typeof import("./sessions.js");
type GitModule = typeof import("../../shared/lib/git/service.js");
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

let createReviewSession: ServiceModule["createReviewSession"];
let streamActiveSessionToSSE: SseReplayModule["streamActiveSessionToSSE"];
let addEvent: SessionsModule["addEvent"];
let cancelSession: SessionsModule["cancelSession"];
let createSession: SessionsModule["createSession"];
let deleteSession: SessionsModule["deleteSession"];
let getSession: SessionsModule["getSession"];
let getActiveSessionForProject: SessionsModule["getActiveSessionForProject"];
let buildScopeKey: SessionsModule["buildScopeKey"];
let markComplete: SessionsModule["markComplete"];
let markReady: SessionsModule["markReady"];
let createGitService: GitModule["createGitService"];
let originalDiffgazerHome: string | undefined;
let tempHome: string;
let projectRoot: string;

const createdSessionIds = new Set<string>();
const sessionsWithRunners = new Set<string>();

function trackSession(reviewId: string): void {
  createdSessionIds.add(reviewId);
}

function trackSessionWithRunner(reviewId: string): void {
  createdSessionIds.add(reviewId);
  sessionsWithRunners.add(reviewId);
}

async function cleanupTrackedSessions(): Promise<void> {
  for (const id of createdSessionIds) {
    getSession(id)?.controller.abort("test_cleanup");
  }
  // Wait until every session with a detached runReviewSession has observed
  // the abort and called markComplete. Polls observable state instead of a
  // fixed setImmediate count coupled to the impl's microtask layout. Sessions
  // created via createSession directly (no runner) need no wait.
  await vi.waitFor(() => {
    for (const id of sessionsWithRunners) {
      const session = getSession(id);
      if (session && !session.isComplete) {
        throw new Error(`runner for ${id} not yet complete`);
      }
    }
  });
  for (const id of createdSessionIds) {
    deleteSession(id);
  }
  createdSessionIds.clear();
  sessionsWithRunners.clear();
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
    getStatus: async () => ok({
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

function makeAIClient(result: ReviewResult = {
  summary: "Model found one correctness issue.",
  issues: [makeIssue({ title: "Subtraction used in addition helper", file: "src/app.ts" })],
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

beforeAll(async () => {
  originalDiffgazerHome = process.env.DIFFGAZER_HOME;
  tempHome = mkdtempSync(join(tmpdir(), "diffgazer-review-service-home-"));
  process.env.DIFFGAZER_HOME = tempHome;
  writeFileSync(
    join(tempHome, "config.json"),
    JSON.stringify({ settings: { defaultLenses: ["correctness"], agentExecution: "sequential" } }),
  );

  const service = await import("./service.js");
  const sseReplay = await import("./sse-replay.js");
  const sessions = await import("./sessions.js");
  const git = await import("../../shared/lib/git/service.js");
  createReviewSession = service.createReviewSession;
  streamActiveSessionToSSE = sseReplay.streamActiveSessionToSSE;
  addEvent = sessions.addEvent;
  cancelSession = sessions.cancelSession;
  createSession = sessions.createSession;
  deleteSession = sessions.deleteSession;
  getSession = sessions.getSession;
  getActiveSessionForProject = sessions.getActiveSessionForProject;
  buildScopeKey = sessions.buildScopeKey;
  markComplete = sessions.markComplete;
  markReady = sessions.markReady;
  createGitService = git.createGitService;
});

beforeEach(() => {
  vi.resetAllMocks();
  projectRoot = makeProjectRoot();
  vi.mocked(createGitService).mockReturnValue(makeGitService());
});

afterEach(async () => {
  await cleanupTrackedSessions();
  rmSync(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
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

describe("createReviewSession", () => {
  it("returns a UUID-format reviewId and creates an active session", async () => {
    const result = await createReviewSession(makeAIClient(), {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reviewId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    trackSessionWithRunner(result.value.reviewId);
    const session = getSession(result.value.reviewId);
    expect(session).toBeDefined();
    expect(session!.isReady).toBe(true);
    expect(session!.mode).toBe("unstaged");
  });

  it("returns the existing session when a matching ready session exists", async () => {
    const existing = createSession("existing-dedup", { projectPath: projectRoot, headCommit: "abc123", statusHash: "hash123", mode: "unstaged" });
    trackSession(existing.reviewId);
    markReady(existing.reviewId);

    const result = await createReviewSession(makeAIClient(), {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reviewId).toBe("existing-dedup");
  });

  it("returns an error when getHeadCommit fails", async () => {
    vi.mocked(createGitService).mockReturnValue(
      makeGitService({ headCommitError: "HEAD unavailable" }),
    );

    const result = await createReviewSession(makeAIClient(), {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("Failed to inspect repository state");
    expect(result.error.message).toContain("HEAD unavailable");
  });

  it("makes a scoped review discoverable by active-session lookup using the same scope", async () => {
    const result = await createReviewSession(makeAIClient(), {
      mode: "unstaged",
      profile: "strict",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);

    const lookup = {
      headCommit: "abc123",
      statusHash: "hash123",
      mode: "unstaged" as const,
    };

    // A mode-only lookup (empty scope key) must NOT find the scoped session.
    expect(getActiveSessionForProject(projectRoot, lookup)).toBeUndefined();

    // The matching scope key resolves the session created through the API.
    const scopeKey = buildScopeKey({ profile: "strict" });
    expect(getActiveSessionForProject(projectRoot, { ...lookup, scopeKey })?.reviewId).toBe(
      result.value.reviewId,
    );
  });

  it("cancels stale sessions before creating a new one", async () => {
    const stale = createSession("stale-review", { projectPath: projectRoot, headCommit: "old-head", statusHash: "old-hash", mode: "unstaged" });
    trackSession(stale.reviewId);
    markReady(stale.reviewId);

    const result = await createReviewSession(makeAIClient(), {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    expect(stale.isComplete).toBe(true);
    expect(stale.controller.signal.aborted).toBe(true);
  });
});

describe("streamActiveSessionToSSE", () => {
  it("replays buffered events to the SSE stream", async () => {
    const stream = makeMockStream();
    const session = createSession("replay-session", { projectPath: projectRoot, headCommit: "abc123", statusHash: "hash123", mode: "unstaged" });
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
    const session = createSession("live-session", { projectPath: projectRoot, headCommit: "abc123", statusHash: "hash123", mode: "unstaged" });
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
    const session = createSession("stale-session", { projectPath: projectRoot, headCommit: "abc123", statusHash: "hash123", mode: "unstaged" });
    trackSession(session.reviewId);
    deleteSession(session.reviewId);

    await streamActiveSessionToSSE(stream, session);

    expect(parsedEvents(stream)).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.SESSION_STALE } },
    ]);
  });

  it("stops without writing when the client aborts", async () => {
    const stream = makeMockStream();
    const session = createSession("abort-session", { projectPath: projectRoot, headCommit: "abc123", statusHash: "hash123", mode: "unstaged" });
    const controller = new AbortController();
    trackSession(session.reviewId);

    const replay = streamActiveSessionToSSE(stream, session, controller.signal);
    controller.abort();

    await replay;

    expect(stream.events).toEqual([]);
  });

  it("writes a terminal event delivered via addEvent without depending on a timer", async () => {
    const stream = makeMockStream();
    const session = createSession("real-flow", { projectPath: projectRoot, headCommit: "abc123", statusHash: "hash123", mode: "unstaged" });
    trackSession(session.reviewId);

    const replay = streamActiveSessionToSSE(stream, session);
    // Let the function reach its subscribe/onComplete registration.
    await Promise.resolve();
    addEvent(session.reviewId, {
      type: "complete",
      result: { issues: [], summary: "Clean" },
      reviewId: session.reviewId,
      durationMs: 200,
    });
    markComplete(session.reviewId);

    await replay;

    expect(parsedEvents(stream)).toMatchObject([
      { type: "complete", reviewId: session.reviewId },
    ]);
  });

  it("resolves promptly when the session completes without emitting a terminal event", async () => {
    const stream = makeMockStream();
    const session = createSession("silent-complete", { projectPath: projectRoot, headCommit: "abc123", statusHash: "hash123", mode: "unstaged" });
    trackSession(session.reviewId);

    const replay = streamActiveSessionToSSE(stream, session);
    await Promise.resolve();
    markComplete(session.reviewId);

    await replay;
    // No terminal event in events[]; consumer-visible behavior is silent close.
    expect(stream.events).toEqual([]);
  });

  it("emits the stale error from cancelSession via the subscriber path", async () => {
    const stream = makeMockStream();
    const session = createSession("cancel-stream", { projectPath: projectRoot, headCommit: "abc123", statusHash: "hash123", mode: "unstaged" });
    trackSession(session.reviewId);

    const replay = streamActiveSessionToSSE(stream, session);
    await Promise.resolve();
    cancelSession(session.reviewId);

    await replay;

    expect(parsedEvents(stream)).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.SESSION_STALE } },
    ]);
  });
});

describe("POST-to-stream integration", () => {
  it("creates a review session, streams events, and ends with a terminal complete", async () => {
    const aiClient = makeAIClient();
    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);

    const session = getSession(result.value.reviewId);
    expect(session).toBeDefined();

    const stream = makeMockStream();

    await vi.waitFor(() => {
      if (!session!.isComplete) throw new Error("session not complete yet");
    });

    await streamActiveSessionToSSE(stream, session!);

    const events = parsedEvents(stream);
    const types = events.map((e) => e.type);

    expect(types).toContain("step_start");
    expect(types).toContain("review_started");
    expect(types[types.length - 1]).toBe("complete");

    const completeEvent = events.find((e) => e.type === "complete");
    expect(completeEvent).toBeDefined();
    if (completeEvent?.type === "complete") {
      expect(completeEvent.result.issues.length).toBeGreaterThanOrEqual(0);
      expect(completeEvent.reviewId).toBe(result.value.reviewId);
    }
  });

  it("streams a terminal error when the diff is empty", async () => {
    vi.mocked(createGitService).mockReturnValue(makeGitService({ diff: "" }));

    const aiClient = makeAIClient();
    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);

    const session = getSession(result.value.reviewId);
    expect(session).toBeDefined();

    await vi.waitFor(() => {
      if (!session!.isComplete) throw new Error("session not complete yet");
    });

    const stream = makeMockStream();
    await streamActiveSessionToSSE(stream, session!);

    const events = parsedEvents(stream);
    const lastEvent = events[events.length - 1];

    expect(lastEvent?.type).toBe("error");
  });
});
