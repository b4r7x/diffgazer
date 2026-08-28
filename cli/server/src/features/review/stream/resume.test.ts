import { err, ok } from "@diffgazer/core/result";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StatusHashResult } from "../../../shared/lib/git/service.js";

// Boundary mock: resumeStreamById re-reads repo state through createGitService to
// decide freshness; the tests drive getHeadCommit/getStatusHash directly so the
// reconnect path can be exercised without a real working tree.
const gitService = {
  getHeadCommit: vi.fn(),
  getStatusHash: vi.fn(),
  getDiff: vi.fn(),
  getStatus: vi.fn(),
  isGitInstalled: vi.fn(),
};
const repoAccess = vi.hoisted(() => ({ has: vi.fn(() => true) }));
vi.mock("../../../shared/lib/git/service.js", () => ({
  createGitService: () => gitService,
}));

// Boundary mock: request project-root resolution reads request/env/cwd state; tests pin it to the session project.
vi.mock("../../../shared/lib/http/request.js", () => ({
  getProjectRoot: () => PROJECT_PATH,
}));

vi.mock("../../../shared/middlewares/trust-guard.js", () => ({
  hasRepoReadAccess: () => repoAccess.has(),
}));

// Boundary mock: log writes process output; freshness assertions do not depend on emitted logs.
vi.mock("../../../shared/lib/log.js", () => ({ log: vi.fn() }));

import { authorizeReviewExecution } from "../../../shared/lib/ai/admission/service.js";
import { revokeProjectSessions } from "../../../shared/lib/session-registry.js";
import { resolveGitDiff } from "../diff.js";
import { buildReviewInputHash } from "../service.js";
import { resumeStreamById } from "./resume.js";
import {
  addEvent,
  createSession,
  deleteSessionForTests,
  getSession,
  markComplete,
  markReady,
} from "./store.js";

vi.mock("../../../shared/lib/ai/admission/service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../shared/lib/ai/admission/service.js")>()),
  authorizeReviewExecution: vi.fn(),
}));

const PROJECT_PATH = "/project";
const REVIEW_ID = "550e8400-e29b-41d4-a716-446655440000";
const REVIEW_DIFF = [
  "diff --git a/a.ts b/a.ts",
  "index 1234567..89abcde 100644",
  "--- a/a.ts",
  "+++ b/a.ts",
  "@@ -1 +1 @@",
  "-old",
  "+const a = 1;",
].join("\n");
const REVIEW_CONFIG_KEY = "l:correctness";

function setStatusHash(result: StatusHashResult): void {
  gitService.getStatusHash.mockResolvedValue(result);
}

function completeEvent(): FullReviewStreamEvent {
  return {
    type: "complete",
    result: { issues: [] },
    reviewId: REVIEW_ID,
  };
}

// The drift notice is a `chunk`, the one non-terminal event with free text; the
// only other chunk a session can carry is the event-cap warning.
function driftNotices(reviewId: string): FullReviewStreamEvent[] {
  const events = getSession(reviewId)?.events ?? [];
  return events.filter((event) => event.type === "chunk" && event.content.includes("repository"));
}

function createApp(): Hono {
  return new Hono().get("/reviews/:id/stream", resumeStreamById);
}

async function resume(): Promise<Response> {
  return createApp().request(`/reviews/${REVIEW_ID}/stream`);
}

beforeEach(() => {
  repoAccess.has.mockReturnValue(true);
  gitService.getHeadCommit.mockResolvedValue(ok("abc123"));
  gitService.getDiff.mockResolvedValue(ok(REVIEW_DIFF));
  setStatusHash({ kind: "full", hash: "stored-hash" });
});

afterEach(() => {
  deleteSessionForTests(REVIEW_ID);
  vi.clearAllMocks();
});

describe("resumeStreamById freshness gating", () => {
  it("keeps an in-flight session streaming when reconnect status is degraded (status-only)", async () => {
    createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "stored-hash",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_ID);
    // A transient diff failure during reconnect downgrades the hash to status-only.
    setStatusHash({ kind: "status-only", hash: "other" });

    const response = await resume();

    // SSE stream (200), not a SESSION_STALE 409, and the session was not cancelled.
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(getSession(REVIEW_ID)?.isComplete).toBe(false);
  });

  it("keeps a status-only session streaming when the reconnect read is a healthy full hash", async () => {
    const session = createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "status-only-hash",
      statusHashKind: "status-only",
      mode: "unstaged",
    });
    markReady(REVIEW_ID);
    setStatusHash({ kind: "full", hash: "full-hash" });

    const response = await resume();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(getSession(REVIEW_ID)?.isComplete).toBe(false);
    expect(session.controller.signal.aborted).toBe(false);
  });

  it("keeps an in-flight session streaming when reconnect status is unavailable", async () => {
    createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "stored-hash",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_ID);
    setStatusHash({ kind: "unavailable" });

    const response = await resume();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
  });

  it("keeps an in-flight session streaming when the reconnect head-commit read fails", async () => {
    const session = createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "stored-hash",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_ID);
    // A head-commit read failure means freshness cannot be verified, distinct from
    // a genuinely changed hash, even though the status hash also changed here.
    gitService.getHeadCommit.mockResolvedValue(err({ message: "git failed" }));
    setStatusHash({ kind: "full", hash: "changed-hash" });

    const response = await resume();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(getSession(REVIEW_ID)?.isComplete).toBe(false);
    expect(session.controller.signal.aborted).toBe(false);
  });

  it("replays a completed session within retention even when the status hash changed", async () => {
    createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "stored-hash",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_ID);
    addEvent(REVIEW_ID, completeEvent());
    markComplete(REVIEW_ID);
    // A new commit after completion produces a different full hash; the completed
    // session must still replay its terminal log instead of 409-ing.
    gitService.getHeadCommit.mockResolvedValue(ok("def456"));
    setStatusHash({ kind: "full", hash: "changed-hash" });

    const response = await resume();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("event: complete");
    expect(body).not.toContain("SESSION_STALE");
    // The freshness gate (and its git reads) is skipped entirely for complete
    // sessions, and reconnect keeps replaying the retained terminal log.
    expect(gitService.getStatusHash).not.toHaveBeenCalled();
    expect(getSession(REVIEW_ID)?.isComplete).toBe(true);
  });

  it("replays completion that lands while reconnect freshness is pending", async () => {
    createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "stored-hash",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_ID);
    const headCommit = createDeferred<ReturnType<typeof ok<string>>>();
    gitService.getHeadCommit.mockReturnValue(headCommit.promise);
    setStatusHash({ kind: "full", hash: "changed-hash" });

    const responsePromise = resume();
    await vi.waitFor(() => expect(gitService.getStatusHash).toHaveBeenCalledOnce());
    addEvent(REVIEW_ID, completeEvent());
    markComplete(REVIEW_ID);
    headCommit.resolve(ok("def456"));

    const response = await responsePromise;
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("event: complete");
    expect(body).not.toContain("SESSION_STALE");
    expect(getSession(REVIEW_ID)?.isComplete).toBe(true);
  });

  it("does not replay retained events after trust is revoked during freshness", async () => {
    createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "stored-hash",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_ID);
    addEvent(REVIEW_ID, {
      type: "review_started",
      reviewId: REVIEW_ID,
      filesTotal: 1,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    const headCommit = createDeferred<ReturnType<typeof ok<string>>>();
    gitService.getHeadCommit.mockReturnValue(headCommit.promise);

    const responsePromise = resume();
    await vi.waitFor(() => expect(gitService.getStatusHash).toHaveBeenCalledOnce());
    repoAccess.has.mockReturnValue(false);
    revokeProjectSessions(PROJECT_PATH);
    headCommit.resolve(ok("abc123"));

    const response = await responsePromise;
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe(ErrorCode.TRUST_REQUIRED);
    expect(JSON.stringify(body)).not.toContain("review_started");
  });

  it("rejects a changed execution fingerprint before replaying a completed session", async () => {
    createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "stored-hash",
      statusHashKind: "full",
      mode: "unstaged",
      admittedExecutionFingerprint: "f".repeat(64),
    });
    markReady(REVIEW_ID);
    addEvent(REVIEW_ID, completeEvent());
    markComplete(REVIEW_ID);

    const response = await createApp().request(
      `/reviews/${REVIEW_ID}/stream?executionFingerprint=${"a".repeat(64)}`,
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("SESSION_STALE");
    expect(JSON.stringify(body)).not.toContain("event: complete");
  });

  it("attaches to a live session whose status hash changed and notes the drift", async () => {
    const session = createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "stored-hash",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_ID);
    setStatusHash({ kind: "full", hash: "changed-hash" });

    const response = await resume();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(getSession(REVIEW_ID)?.isComplete).toBe(false);
    expect(session.controller.signal.aborted).toBe(false);
    expect(driftNotices(REVIEW_ID)).toHaveLength(1);
  });

  it("notes the drift once across repeated reconnects", async () => {
    createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "stored-hash",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_ID);
    setStatusHash({ kind: "full", hash: "changed-hash" });

    await resume();
    await resume();

    expect(driftNotices(REVIEW_ID)).toHaveLength(1);
  });

  it("keeps streaming when only out-of-scope worktree files changed", async () => {
    const parsedResult = await resolveGitDiff({
      gitService,
      mode: "unstaged",
      emit: async () => undefined,
      reviewId: REVIEW_ID,
    });
    expect(parsedResult.ok).toBe(true);
    if (!parsedResult.ok) return;
    const reviewInputHash = buildReviewInputHash({
      headCommit: "abc123",
      reviewConfigKey: REVIEW_CONFIG_KEY,
      parsed: parsedResult.value,
    });
    const session = createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "stored-hash",
      statusHashKind: "full",
      mode: "unstaged",
      reviewConfigKey: REVIEW_CONFIG_KEY,
      reviewInputHash,
    });
    markReady(REVIEW_ID);
    setStatusHash({ kind: "full", hash: "changed-hash" });

    const response = await resume();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(getSession(REVIEW_ID)?.isComplete).toBe(false);
    expect(session.controller.signal.aborted).toBe(false);
  });

  it("attaches to a live scoped session whose review input hash changed", async () => {
    const parsedResult = await resolveGitDiff({
      gitService,
      mode: "unstaged",
      emit: async () => undefined,
      reviewId: REVIEW_ID,
    });
    expect(parsedResult.ok).toBe(true);
    if (!parsedResult.ok) return;
    const reviewInputHash = buildReviewInputHash({
      headCommit: "abc123",
      reviewConfigKey: REVIEW_CONFIG_KEY,
      parsed: parsedResult.value,
    });
    createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "stored-hash",
      statusHashKind: "full",
      mode: "unstaged",
      reviewConfigKey: REVIEW_CONFIG_KEY,
      reviewInputHash,
    });
    markReady(REVIEW_ID);
    gitService.getDiff.mockResolvedValue(
      ok(
        [
          "diff --git a/a.ts b/a.ts",
          "index 1234567..89abcde 100644",
          "--- a/a.ts",
          "+++ b/a.ts",
          "@@ -1 +1 @@",
          "-old",
          "+const a = 2;",
        ].join("\n"),
      ),
    );

    const response = await resume();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(getSession(REVIEW_ID)?.isComplete).toBe(false);
    expect(driftNotices(REVIEW_ID)).toHaveLength(1);
  });
});

describe("resumeStreamById completed execution replay", () => {
  async function resumeWithFingerprint(fingerprint: string): Promise<Response> {
    return createApp().request(`/reviews/${REVIEW_ID}/stream?executionFingerprint=${fingerprint}`);
  }

  it("never reauthorizes execution through cached credentials during resume", async () => {
    const admittedFingerprint = "admitted-fingerprint-abc123";
    createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "stored-hash",
      statusHashKind: "full",
      mode: "unstaged",
      admittedExecutionFingerprint: admittedFingerprint,
    });
    markReady(REVIEW_ID);
    addEvent(REVIEW_ID, completeEvent());
    markComplete(REVIEW_ID);

    await resumeWithFingerprint(admittedFingerprint);

    expect(authorizeReviewExecution).not.toHaveBeenCalled();
  });
});
