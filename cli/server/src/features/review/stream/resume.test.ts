import { ok } from "@diffgazer/core/result";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
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
// Boundary mock: git service wraps subprocess/git state reads; tests drive reconnect freshness without a real working tree.
vi.mock("../../../shared/lib/git/service.js", () => ({
  createGitService: () => gitService,
}));

// Boundary mock: request project-root resolution reads request/env/cwd state; tests pin it to the session project.
vi.mock("../../../shared/lib/http/request.js", () => ({
  getProjectRoot: () => PROJECT_PATH,
}));

// Boundary mock: log writes process output; freshness assertions do not depend on emitted logs.
vi.mock("../../../shared/lib/log.js", () => ({ log: vi.fn() }));

import { resumeStreamById } from "./resume.js";
import {
  addEvent,
  createSession,
  deleteSession,
  getSession,
  markComplete,
  markReady,
} from "./store.js";

const PROJECT_PATH = "/project";
const REVIEW_ID = "550e8400-e29b-41d4-a716-446655440000";

function setStatusHash(result: StatusHashResult): void {
  gitService.getStatusHash.mockResolvedValue(result);
}

function completeEvent(): FullReviewStreamEvent {
  return {
    type: "complete",
    result: { issues: [], summary: "Clean" },
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
  gitService.getHeadCommit.mockResolvedValue(ok("abc123"));
  setStatusHash({ kind: "full", hash: "stored-hash" });
});

afterEach(() => {
  deleteSession(REVIEW_ID);
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
