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
};
const repoAccess = vi.hoisted(() => ({ has: vi.fn(() => true) }));
// Boundary mock: git service wraps subprocess/git state reads; tests drive reconnect freshness without a real working tree.
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
import { buildExecutionResult } from "../../../shared/lib/ai/client/generate.js";
import { revokeProjectSessions } from "../../../shared/lib/session-registry.js";
import {
  bindSessionExecution,
  clearSessionExecution,
  deriveSessionTerminalOutcome,
  FAILED_TERMINAL_OUTCOMES,
  getBoundSessionExecution,
  resumeStreamById,
} from "./resume.js";
import {
  addEvent,
  createSession,
  deleteSession,
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

function setStatusHash(result: StatusHashResult): void {
  gitService.getStatusHash.mockResolvedValue(result);
}

function completeEvent(): FullReviewStreamEvent {
  return {
    type: "complete",
    result: { issues: [] },
    reviewId: REVIEW_ID,
    durationMs: 1,
  };
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
  setStatusHash({ kind: "full", hash: "stored-hash" });
});

afterEach(() => {
  deleteSession(REVIEW_ID);
  clearSessionExecution(REVIEW_ID);
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

  it("409s a non-complete session when the status hash genuinely changed", async () => {
    createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "stored-hash",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_ID);
    setStatusHash({ kind: "full", hash: "changed-hash" });

    const response = await resume();
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("SESSION_STALE");
    expect(getSession(REVIEW_ID)?.isComplete).toBe(true);
  });
});

describe("resumeStreamById immutable completed execution replay", () => {
  const PLAN_LIMITS = {
    maxInputTokens: 20_000,
    maxOutputTokens: 4_000,
    maxResponseBytes: 1_048_576,
    wallTimeMs: 120_000,
    maxRetries: 2,
    maxConcurrency: 1,
    maxCostUsd: 0.5,
  } as const;

  function admittedPlan(executionFingerprint = "admitted-fingerprint-abc123") {
    return Object.freeze({
      configurationId: "gemini-primary",
      configurationRevision: 3,
      executionFingerprint,
      evidenceKey: Object.freeze({
        authentication: null,
        credentialReferenceIdentity: "c".repeat(64),
        installationId: null,
        productId: "gemini" as const,
        transportFamily: "hosted-api" as const,
        normalizedEndpoint: "https://generativelanguage.googleapis.com/v1beta",
        region: null,
        workspaceAccountReference: null,
        modelId: "gemini-test-model",
        runtime: { identity: "diffgazer-server", version: "1.0.0" },
        structuredOutputSchemaSha256: "a".repeat(64),
        noticeVersion: 1,
        limits: PLAN_LIMITS,
      }),
      productId: "gemini" as const,
      transportFamily: "hosted-api" as const,
      limits: PLAN_LIMITS,
    });
  }

  function bindCompletedExecution() {
    const execution = buildExecutionResult(admittedPlan(), "completed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:05.000Z",
      usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 },
      issues: [],
    });
    bindSessionExecution(REVIEW_ID, execution);
    return execution;
  }

  async function resumeWithFingerprint(fingerprint: string): Promise<Response> {
    return createApp().request(`/reviews/${REVIEW_ID}/stream?executionFingerprint=${fingerprint}`);
  }

  it("preserves the exact bound receipt and usage for a completed session replay", async () => {
    const execution = bindCompletedExecution();
    createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "stored-hash",
      statusHashKind: "full",
      mode: "unstaged",
      admittedExecutionFingerprint: execution.receipt.executionFingerprint,
    });
    markReady(REVIEW_ID);
    addEvent(REVIEW_ID, completeEvent());
    markComplete(REVIEW_ID);

    const response = await resumeWithFingerprint(execution.receipt.executionFingerprint);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("event: complete");
    const session = getSession(REVIEW_ID);
    expect(session).toBeDefined();
    if (!session) return;
    expect(deriveSessionTerminalOutcome(session)).toBe("completed");
    expect(getBoundSessionExecution(REVIEW_ID)?.receipt).toEqual(execution.receipt);
    expect(getBoundSessionExecution(REVIEW_ID)?.receipt.usage).toEqual({
      inputTokens: 100,
      outputTokens: 40,
      totalTokens: 140,
    });
  });

  it.each(
    FAILED_TERMINAL_OUTCOMES,
  )("rejects replaying %s terminal outcomes as completed findings", async (outcome) => {
    const execution = buildExecutionResult(admittedPlan(), outcome, {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:05.000Z",
    });
    bindSessionExecution(REVIEW_ID, execution);
    createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "stored-hash",
      statusHashKind: "full",
      mode: "unstaged",
      admittedExecutionFingerprint: execution.receipt.executionFingerprint,
    });
    markReady(REVIEW_ID);
    addEvent(REVIEW_ID, {
      type: "complete",
      result: {
        issues: [
          {
            id: "partial-1",
            severity: "high",
            category: "correctness",
            title: "Should not replay",
            file: "src/a.ts",
            line_start: 1,
            line_end: 1,
            rationale: "partial",
            recommendation: "fix",
            suggested_patch: null,
            confidence: 0.9,
            symptom: "partial",
            whyItMatters: "partial",
            evidence: [],
          },
        ],
      },
      reviewId: REVIEW_ID,
      durationMs: 1,
    });
    markComplete(REVIEW_ID);

    const response = await resumeWithFingerprint(execution.receipt.executionFingerprint);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("event: complete");
    expect(body).not.toContain("Should not replay");
    expect(body).toContain('"issues":[]');
  });

  it("never reauthorizes execution through cached credentials during resume", async () => {
    const execution = bindCompletedExecution();
    createSession(REVIEW_ID, {
      projectPath: PROJECT_PATH,
      headCommit: "abc123",
      statusHash: "stored-hash",
      statusHashKind: "full",
      mode: "unstaged",
      admittedExecutionFingerprint: execution.receipt.executionFingerprint,
    });
    markReady(REVIEW_ID);
    addEvent(REVIEW_ID, completeEvent());
    markComplete(REVIEW_ID);

    await resumeWithFingerprint(execution.receipt.executionFingerprint);

    expect(authorizeReviewExecution).not.toHaveBeenCalled();
  });
});
