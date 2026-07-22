import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { err, ok } from "@diffgazer/core/result";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import type { ReviewMode, ReviewResult } from "@diffgazer/core/schemas/review";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import type {
  AIExecutionFingerprint,
  InitializedAIClient,
} from "../../shared/lib/ai/client/initialize.js";
import type { createGitService as createGitServiceType } from "../../shared/lib/git/service.js";
import { makeIssue } from "../../shared/lib/testing/factories.js";
import { requireValue } from "../../testing/assertions.js";
import { parseDiff } from "./engine/diff/parser.js";
import type { SSEWriter } from "./stream/sse.js";

// Boundary mock: git/service wraps the `git` CLI subprocess (external-process boundary); tests provide canned status/diff responses so review session lifecycle can be exercised without a real repository.
vi.mock("../../shared/lib/git/service.js", () => ({
  createGitService: vi.fn(),
}));

type GitService = ReturnType<typeof createGitServiceType>;
type ServiceModule = typeof import("./service.js");
type SseReplayModule = typeof import("./stream/replay.js");
type SessionsModule = typeof import("./stream/store.js");
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
const DEFAULT_EXECUTION_FINGERPRINT: AIExecutionFingerprint = {
  provider: "openrouter",
  model: "test-model",
};
const DEFAULT_REVIEW_RESULT: ReviewResult = {
  issues: [makeIssue({ title: "Subtraction used in addition helper", file: "file-1" })],
};

let createReviewSession: ServiceModule["createReviewSession"];
let buildReviewInputHash: ServiceModule["buildReviewInputHash"];
let streamActiveSessionToSSE: SseReplayModule["streamActiveSessionToSSE"];
let addEvent: SessionsModule["addEvent"];
let cancelSession: SessionsModule["cancelSession"];
let cancelSessionForUser: SessionsModule["cancelSessionForUser"];
let createSession: SessionsModule["createSession"];
let deleteSession: SessionsModule["deleteSession"];
let getSession: SessionsModule["getSession"];
let getActiveSessionForProject: SessionsModule["getActiveSessionForProject"];
let buildReviewConfigKey: SessionsModule["buildReviewConfigKey"];
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
  writeFileSync(
    join(root, "src/app.ts"),
    "export function add(a: number, b: number) {\n  return a + b;\n}\n",
  );
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

function makeGitService(
  options: {
    diff?: string;
    headCommit?: string;
    headCommitError?: string;
    statusHash?: string;
  } = {},
): GitService {
  const {
    diff = REVIEW_DIFF,
    headCommit = "abc123",
    headCommitError,
    statusHash = "hash123",
  } = options;

  return {
    getStatus: async () =>
      ok({
        isGitRepo: true,
        branch: "main",
        remoteBranch: null,
        ahead: 0,
        behind: 0,
        files: { staged: [], unstaged: [], untracked: [] },
        hasChanges: false,
        conflicted: [],
      }),
    getDiff: async () => ok(diff),
    isGitInstalled: async () => true,
    getHeadCommit: async () =>
      headCommitError ? err({ message: headCommitError }) : ok(headCommit),
    getStatusHash: async () => ({ kind: "full" as const, hash: statusHash }),
  };
}

function makeAIClient(
  result: ReviewResult = DEFAULT_REVIEW_RESULT,
  executionFingerprint: AIExecutionFingerprint = DEFAULT_EXECUTION_FINGERPRINT,
): InitializedAIClient {
  const generate: InitializedAIClient["generate"] = async <T extends z.ZodType>(
    _prompt: string,
    schema: T,
    _options?: { signal?: AbortSignal },
  ) => ok(schema.parse(result));

  return {
    provider: executionFingerprint.provider,
    executionFingerprint,
    generate,
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
  const sseReplay = await import("./stream/replay.js");
  const sessions = await import("./stream/store.js");
  const git = await import("../../shared/lib/git/service.js");
  createReviewSession = service.createReviewSession;
  buildReviewInputHash = service.buildReviewInputHash;
  streamActiveSessionToSSE = sseReplay.streamActiveSessionToSSE;
  addEvent = sessions.addEvent;
  cancelSession = sessions.cancelSession;
  cancelSessionForUser = sessions.cancelSessionForUser;
  createSession = sessions.createSession;
  deleteSession = sessions.deleteSession;
  getSession = sessions.getSession;
  getActiveSessionForProject = sessions.getActiveSessionForProject;
  buildReviewConfigKey = sessions.buildReviewConfigKey;
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
    expect(result.value.session).toBe(session);
    expect(session?.isReady).toBe(true);
    expect(session?.mode).toBe("unstaged");
    expect(
      getActiveSessionForProject(projectRoot, {
        headCommit: "abc123",
        statusHash: "hash123",
        statusHashKind: "full",
        mode: "unstaged",
      }),
    ).toBe(result.value.session);
  });

  it("does not reuse an existing session when reviewConfigKey differs", async () => {
    const existing = createSession("existing-config", {
      projectPath: projectRoot,
      headCommit: "abc123",
      statusHash: "hash123",
      statusHashKind: "full" as const,
      mode: "unstaged",
      reviewConfigKey: buildReviewConfigKey({
        lenses: ["security"],
        minSeverity: "high",
      }),
    });
    trackSession(existing.reviewId);
    markReady(existing.reviewId);

    const result = await createReviewSession(makeAIClient(), {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    expect(result.value.reviewId).not.toBe("existing-config");
    expect(existing.isComplete).toBe(true);
    const terminal = existing.events.find((event) => event.type === "error");
    expect(terminal).toBeDefined();
    if (terminal?.type === "error") {
      expect(terminal.error.message).toContain("superseded by a review");
      expect(terminal.error.message).not.toBe(
        "Review session cancelled because repository state changed.",
      );
    }
  });

  it("returns the existing session when review config and execution fingerprint match", async () => {
    const reviewConfigKey = buildReviewConfigKey({
      lenses: ["correctness"],
      minSeverity: "low",
      executionFingerprint: DEFAULT_EXECUTION_FINGERPRINT,
    });
    const existing = createSession("existing-dedup", {
      projectPath: projectRoot,
      headCommit: "abc123",
      statusHash: "hash123",
      statusHashKind: "full" as const,
      mode: "unstaged",
      reviewConfigKey,
      reviewInputHash: buildReviewInputHash({
        headCommit: "abc123",
        reviewConfigKey,
        parsed: parseDiff(REVIEW_DIFF),
      }),
    });
    trackSession(existing.reviewId);
    markReady(existing.reviewId);

    const result = await createReviewSession(makeAIClient(), {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reviewId).toBe("existing-dedup");
    expect(result.value.session).toBe(existing);
    expect(
      getActiveSessionForProject(projectRoot, {
        headCommit: "abc123",
        statusHash: "hash123",
        statusHashKind: "full",
        mode: "unstaged",
        scopeKey: "",
        reviewConfigKey,
      }),
    ).toBe(result.value.session);
  });

  it.each([
    {
      changedSelection: "provider",
      existingFingerprint: { provider: "openrouter", model: "shared-model" },
      nextFingerprint: { provider: "gemini", model: "shared-model" },
    },
    {
      changedSelection: "model",
      existingFingerprint: { provider: "openrouter", model: "model-a" },
      nextFingerprint: { provider: "openrouter", model: "model-b" },
    },
  ] satisfies Array<{
    changedSelection: string;
    existingFingerprint: AIExecutionFingerprint;
    nextFingerprint: AIExecutionFingerprint;
  }>)("starts a new session and supersedes the active one when $changedSelection changes", async ({
    existingFingerprint,
    nextFingerprint,
  }) => {
    const existing = createSession(`existing-${existingFingerprint.model}`, {
      projectPath: projectRoot,
      headCommit: "abc123",
      statusHash: "hash123",
      statusHashKind: "full" as const,
      mode: "unstaged",
      reviewConfigKey: buildReviewConfigKey({
        lenses: ["correctness"],
        minSeverity: "low",
        executionFingerprint: existingFingerprint,
      }),
    });
    trackSession(existing.reviewId);
    markReady(existing.reviewId);

    const result = await createReviewSession(makeAIClient(DEFAULT_REVIEW_RESULT, nextFingerprint), {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    expect(result.value.reviewId).not.toBe(existing.reviewId);
    expect(result.value.session.reviewConfigKey).toBe(
      buildReviewConfigKey({
        lenses: ["correctness"],
        minSeverity: "low",
        executionFingerprint: nextFingerprint,
      }),
    );
    expect(existing.isComplete).toBe(true);
    expect(existing.events).toContainEqual(
      expect.objectContaining({
        type: "error",
        error: expect.objectContaining({ message: expect.stringContaining("superseded") }),
      }),
    );
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

  it("makes a scoped review discoverable by a mode-only active-session lookup", async () => {
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
      statusHashKind: "full" as const,
      mode: "unstaged" as const,
    };

    // A mode-only lookup (no scope key) resolves the scoped session so a reload
    // during a scoped review can resume it.
    expect(getActiveSessionForProject(projectRoot, lookup)?.reviewId).toBe(result.value.reviewId);

    // The matching scope key also resolves the session created through the API.
    const scopeKey = buildScopeKey({ profile: "strict" });
    expect(getActiveSessionForProject(projectRoot, { ...lookup, scopeKey })?.reviewId).toBe(
      result.value.reviewId,
    );
  });

  it("cancels stale sessions before creating a new one", async () => {
    const stale = createSession("stale-review", {
      projectPath: projectRoot,
      headCommit: "old-head",
      statusHash: "old-hash",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
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

  it("captures the diff before publishing a cancellable session", async () => {
    type GitDiffResult = Awaited<ReturnType<GitService["getDiff"]>>;
    const diff = createDeferred<GitDiffResult>();
    const getDiff = vi.fn(
      async (
        _mode?: ReviewMode,
        _pathspecs?: readonly string[],
        _signal?: AbortSignal,
      ): Promise<GitDiffResult> => diff.promise,
    );
    const gitService = { ...makeGitService(), getDiff };
    vi.mocked(createGitService).mockReturnValue(gitService);
    const aiClient = makeAIClient();
    const generate = vi.spyOn(aiClient, "generate");

    const creating = createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });
    await vi.waitFor(() => expect(getDiff).toHaveBeenCalledOnce());
    expect(
      getActiveSessionForProject(projectRoot, {
        headCommit: "abc123",
        statusHash: "hash123",
        statusHashKind: "full",
        mode: "unstaged",
      }),
    ).toBeUndefined();

    diff.resolve(ok(REVIEW_DIFF));
    const result = await creating;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    expect(createGitService).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce());
  });

  it("does not start model execution after cancellation during context construction", async () => {
    type StatusHashResult = Awaited<ReturnType<GitService["getStatusHash"]>>;
    const statusHash = createDeferred<StatusHashResult>();
    const getStatusHash = vi.fn<GitService["getStatusHash"]>(() => statusHash.promise);
    const contextGitService = { ...makeGitService(), getStatusHash };
    vi.mocked(createGitService)
      .mockReturnValueOnce(makeGitService())
      .mockReturnValueOnce(contextGitService)
      .mockReturnValue(makeGitService());
    const aiClient = makeAIClient();
    const generate = vi.spyOn(aiClient, "generate");

    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    await vi.waitFor(() => expect(getStatusHash).toHaveBeenCalledOnce());

    cancelSessionForUser(result.value.reviewId);
    statusHash.resolve({ kind: "full", hash: "context-hash" });
    await vi.waitFor(() => {
      expect(existsSync(join(projectRoot, ".diffgazer/context.manifest.json"))).toBe(true);
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(generate).not.toHaveBeenCalled();
  });
});

describe("streamActiveSessionToSSE", () => {
  it("replays buffered events to the SSE stream", async () => {
    const stream = makeMockStream();
    const session = createSession("replay-session", {
      projectPath: projectRoot,
      headCommit: "abc123",
      statusHash: "hash123",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    trackSession(session.reviewId);
    const events: FullReviewStreamEvent[] = [
      { type: "step_start", step: "diff", timestamp: new Date().toISOString() },
      {
        type: "complete",
        result: { issues: [] },
        reviewId: session.reviewId,
        durationMs: 100,
      },
    ];
    session.events.push(...events);
    session.isComplete = true;

    await streamActiveSessionToSSE(stream, session);

    expect(parsedEvents(stream)).toEqual(events);
  });

  it("streams live events until a terminal event arrives", async () => {
    const stream = makeMockStream();
    const session = createSession("live-session", {
      projectPath: projectRoot,
      headCommit: "abc123",
      statusHash: "hash123",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    trackSession(session.reviewId);

    const replay = streamActiveSessionToSSE(stream, session);
    addEvent(session.reviewId, {
      type: "complete",
      result: { issues: [] },
      reviewId: session.reviewId,
      durationMs: 50,
    });

    await replay;

    expect(parsedEvents(stream)).toMatchObject([{ type: "complete", reviewId: session.reviewId }]);
  });

  it("writes a stale error when the session cannot be subscribed", async () => {
    const stream = makeMockStream();
    const session = createSession("stale-session", {
      projectPath: projectRoot,
      headCommit: "abc123",
      statusHash: "hash123",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    trackSession(session.reviewId);
    deleteSession(session.reviewId);

    await streamActiveSessionToSSE(stream, session);

    expect(parsedEvents(stream)).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.SESSION_STALE } },
    ]);
  });

  it("stops without writing when the client aborts", async () => {
    const stream = makeMockStream();
    const session = createSession("abort-session", {
      projectPath: projectRoot,
      headCommit: "abc123",
      statusHash: "hash123",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    const controller = new AbortController();
    trackSession(session.reviewId);

    const replay = streamActiveSessionToSSE(stream, session, controller.signal);
    controller.abort();

    await replay;

    expect(stream.events).toEqual([]);
  });

  it("writes a terminal event delivered via addEvent without depending on a timer", async () => {
    const stream = makeMockStream();
    const session = createSession("real-flow", {
      projectPath: projectRoot,
      headCommit: "abc123",
      statusHash: "hash123",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    trackSession(session.reviewId);

    const replay = streamActiveSessionToSSE(stream, session);
    // Let the function reach its subscribe/onComplete registration.
    await Promise.resolve();
    addEvent(session.reviewId, {
      type: "complete",
      result: { issues: [] },
      reviewId: session.reviewId,
      durationMs: 200,
    });
    markComplete(session.reviewId);

    await replay;

    expect(parsedEvents(stream)).toMatchObject([{ type: "complete", reviewId: session.reviewId }]);
  });

  it("resolves promptly when the session completes without emitting a terminal event", async () => {
    const stream = makeMockStream();
    const session = createSession("silent-complete", {
      projectPath: projectRoot,
      headCommit: "abc123",
      statusHash: "hash123",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
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
    const session = createSession("cancel-stream", {
      projectPath: projectRoot,
      headCommit: "abc123",
      statusHash: "hash123",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
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
    const activeSession = requireValue(session, "review session");

    const stream = makeMockStream();

    await vi.waitFor(() => {
      if (!activeSession.isComplete) throw new Error("session not complete yet");
    });

    await streamActiveSessionToSSE(stream, activeSession);

    const events = parsedEvents(stream);
    const types = events.map((e) => e.type);

    expect(types).toContain("step_start");
    expect(types).toContain("review_started");
    expect(types[types.length - 1]).toBe("complete");

    const completeEvent = events.find((e) => e.type === "complete");
    expect(completeEvent).toBeDefined();
    if (completeEvent?.type === "complete") {
      expect(completeEvent.reviewId).toBe(result.value.reviewId);
    }
  });

  it("persists and emits one nonnegative duration when the wall clock moves backward", async () => {
    let wallClock = 1_000_000;
    const dateNow = vi.spyOn(Date, "now").mockImplementation(() => {
      wallClock -= 1_000;
      return wallClock;
    });

    try {
      const result = await createReviewSession(makeAIClient(), {
        mode: "unstaged",
        projectPath: projectRoot,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      trackSessionWithRunner(result.value.reviewId);
      const session = requireValue(getSession(result.value.reviewId), "review session");
      await vi.waitFor(() => {
        if (!session.isComplete) throw new Error("session not complete yet");
      });

      const complete = session.events.find((event) => event.type === "complete");
      expect(complete?.type).toBe("complete");
      if (complete?.type !== "complete") return;
      const { getReview } = await import("./storage/reviews.js");
      const saved = await getReview(result.value.reviewId);

      expect(saved.ok, saved.ok ? undefined : JSON.stringify(saved.error)).toBe(true);
      if (!saved.ok) return;
      expect(saved.value.metadata.durationMs).toBeGreaterThanOrEqual(0);
      expect(saved.value.metadata.durationMs).toBe(complete.durationMs);
    } finally {
      dateNow.mockRestore();
    }
  });

  it("keeps the session identity and executed configuration on the creation snapshot", async () => {
    const { getStore } = await import("../../shared/lib/config/store.js");
    const store = getStore();
    const originalSettings = store.getSettings();
    const diffStarted = createDeferred<void>();
    const releaseDiff = createDeferred<void>();
    const gitService = makeGitService();
    gitService.getDiff = vi.fn(async () => {
      diffStarted.resolve();
      await releaseDiff.promise;
      return ok(REVIEW_DIFF);
    });
    vi.mocked(createGitService).mockReturnValue(gitService);
    const lowIssue = makeIssue({ file: "file-1", severity: "low", title: "Snapshot issue" });

    try {
      const configured = await store.updateSettings({
        defaultLenses: ["correctness"],
        defaultProfile: null,
        severityThreshold: "low",
        agentExecution: "sequential",
      });
      expect(configured.ok).toBe(true);

      const creating = createReviewSession(makeAIClient({ issues: [lowIssue] }), {
        mode: "unstaged",
        projectPath: projectRoot,
      });
      await diffStarted.promise;
      const changed = await store.updateSettings({
        defaultLenses: ["security"],
        defaultProfile: "strict",
        severityThreshold: "blocker",
        agentExecution: "parallel",
      });
      expect(changed.ok).toBe(true);
      releaseDiff.resolve();

      const result = await creating;
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      trackSessionWithRunner(result.value.reviewId);
      expect(result.value.session.reviewConfigKey).toBe(
        buildReviewConfigKey({
          lenses: ["correctness"],
          minSeverity: "low",
          executionFingerprint: DEFAULT_EXECUTION_FINGERPRINT,
        }),
      );

      const session = requireValue(getSession(result.value.reviewId), "review session");
      await vi.waitFor(() => {
        if (!session.isComplete) throw new Error("session not complete yet");
      });
      expect(session.events.at(-1), JSON.stringify(session.events)).toMatchObject({
        type: "complete",
      });
      const { getReview } = await import("./storage/reviews.js");
      const saved = await getReview(result.value.reviewId);

      expect(saved.ok, saved.ok ? undefined : JSON.stringify(saved.error)).toBe(true);
      if (!saved.ok) return;
      expect(saved.value.metadata.lenses).toEqual(["correctness"]);
      expect(saved.value.metadata.profile).toBeNull();
      expect(saved.value.result.issues).toEqual([
        expect.objectContaining({ severity: "low", title: "Snapshot issue" }),
      ]);
    } finally {
      releaseDiff.resolve();
      await store.updateSettings(originalSettings);
    }
  });

  it("persists the diff with the branch and HEAD captured before deferred model work", async () => {
    let branch = "snapshot-branch";
    let headCommit = "snapshot-head";
    const gitService = {
      ...makeGitService({ diff: REVIEW_DIFF }),
      getStatus: vi.fn(async () =>
        ok({
          isGitRepo: true,
          branch,
          remoteBranch: null,
          ahead: 0,
          behind: 0,
          files: { staged: [], unstaged: [], untracked: [] },
          hasChanges: true,
          conflicted: [],
        }),
      ),
      getHeadCommit: vi.fn(async () => ok(headCommit)),
    } satisfies GitService;
    vi.mocked(createGitService).mockReturnValue(gitService);
    const modelStarted = createDeferred<void>();
    const modelRelease = createDeferred<void>();
    const aiClient = makeAIClient();
    const generate = aiClient.generate;
    aiClient.generate = async (...args) => {
      modelStarted.resolve();
      await modelRelease.promise;
      return generate(...args);
    };

    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    await modelStarted.promise;
    const headReadsBeforeModel = gitService.getHeadCommit.mock.calls.length;
    const statusReadsBeforeModel = gitService.getStatus.mock.calls.length;
    branch = "later-branch";
    headCommit = "later-head";
    modelRelease.resolve();

    const session = requireValue(getSession(result.value.reviewId), "review session");
    await vi.waitFor(() => {
      if (!session.isComplete) throw new Error("session not complete yet");
    });
    const { getReview } = await import("./storage/reviews.js");
    const saved = await getReview(result.value.reviewId);

    expect(saved.ok, saved.ok ? undefined : JSON.stringify(saved.error)).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.metadata.branch).toBe("snapshot-branch");
    expect(saved.value.gitContext).toMatchObject({
      branch: "snapshot-branch",
      commit: "snapshot-head",
    });
    expect(saved.value.diff).toBeDefined();
    if (!saved.value.diff) return;
    expect(saved.value.diff.files[0]?.rawDiff).toContain("return a - b");
    expect(gitService.getHeadCommit).toHaveBeenCalledTimes(headReadsBeforeModel);
    expect(gitService.getStatus).toHaveBeenCalledTimes(statusReadsBeforeModel);
  });

  it("binds A-B-A sessions and prompts to the exact captured real-Git diff", async () => {
    const runGit = (...args: string[]) =>
      execFileSync("git", args, { cwd: projectRoot, encoding: "utf8", stdio: "pipe" });
    runGit("init", "--quiet", "--initial-branch=main");
    runGit("config", "user.name", "Diffgazer Test");
    runGit("config", "user.email", "diffgazer@example.invalid");
    runGit("add", ".");
    runGit("commit", "--quiet", "-m", "fixture");

    const actualGit = await vi.importActual<GitModule>("../../shared/lib/git/service.js");
    const gitService = actualGit.createGitService({ cwd: projectRoot });
    const getDiff = vi.spyOn(gitService, "getDiff");
    vi.mocked(createGitService).mockReturnValue(gitService);

    const bStarted = createDeferred<void>();
    const releaseB = createDeferred<void>();
    const prompts: string[] = [];
    const aiClient = makeAIClient();
    aiClient.generate = async <T extends z.ZodType>(prompt: string, schema: T) => {
      prompts.push(prompt);
      if (prompt.includes("return a + b + 2")) {
        bStarted.resolve();
        await releaseB.promise;
      }
      return ok(schema.parse(DEFAULT_REVIEW_RESULT));
    };
    const writeGeneration = (offset: 1 | 2) => {
      writeFileSync(
        join(projectRoot, "src/app.ts"),
        `export function add(a: number, b: number) {\n  return a + b + ${offset};\n}\n`,
      );
    };

    try {
      writeGeneration(1);
      const firstA = await createReviewSession(aiClient, {
        mode: "unstaged",
        projectPath: projectRoot,
      });
      expect(firstA.ok).toBe(true);
      if (!firstA.ok) return;
      trackSessionWithRunner(firstA.value.reviewId);
      await streamActiveSessionToSSE(makeMockStream(), firstA.value.session);

      writeGeneration(2);
      const b = await createReviewSession(aiClient, {
        mode: "unstaged",
        projectPath: projectRoot,
      });
      expect(b.ok).toBe(true);
      if (!b.ok) return;
      trackSessionWithRunner(b.value.reviewId);
      await bStarted.promise;

      writeGeneration(1);
      const secondA = await createReviewSession(aiClient, {
        mode: "unstaged",
        projectPath: projectRoot,
      });
      expect(secondA.ok).toBe(true);
      if (!secondA.ok) return;
      trackSessionWithRunner(secondA.value.reviewId);

      expect(secondA.value.reviewId).not.toBe(b.value.reviewId);
      expect(secondA.value.session.reviewInputHash).toBe(firstA.value.session.reviewInputHash);
      expect(secondA.value.session.reviewInputHash).not.toBe(b.value.session.reviewInputHash);
      expect(b.value.session.isComplete).toBe(true);
      expect(b.value.session.controller.signal.aborted).toBe(true);
      expect(getDiff).toHaveBeenCalledTimes(3);

      await streamActiveSessionToSSE(makeMockStream(), secondA.value.session);
      expect(prompts.filter((prompt) => prompt.includes("return a + b + 1"))).toHaveLength(2);
      expect(prompts.filter((prompt) => prompt.includes("return a + b + 2"))).toHaveLength(1);
    } finally {
      releaseB.resolve();
    }
  }, 30_000);

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
    const activeSession = requireValue(session, "review session");

    await vi.waitFor(() => {
      if (!activeSession.isComplete) throw new Error("session not complete yet");
    });

    const stream = makeMockStream();
    await streamActiveSessionToSSE(stream, activeSession);

    const events = parsedEvents(stream);
    const lastEvent = events[events.length - 1];

    expect(lastEvent?.type).toBe("error");
  });
});
