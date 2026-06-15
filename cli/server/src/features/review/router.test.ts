import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROJECT_ROOT_HEADER } from "@diffgazer/core/api/protocol";
import type { Result } from "@diffgazer/core/result";
import { err, ok } from "@diffgazer/core/result";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StatusHashResult } from "../../shared/lib/git/service.js";
import { makeIssue } from "../../shared/lib/testing/factories.js";
import { requireValue } from "../../testing/assertions.js";

const REVIEW_A = "550e8400-e29b-41d4-a716-446655440000";
const REVIEW_B = "660e8400-e29b-41d4-a716-446655440001";
const ROUTE_BOUNDARY_TIMEOUT_MS = 10_000;

let tempHome: string;
let projectA: string;
let projectB: string;

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "diffgazer-review-router-home-"));
  projectA = await mkdtemp(join(tmpdir(), "diffgazer-review-router-a-"));
  projectB = await mkdtemp(join(tmpdir(), "diffgazer-review-router-b-"));
  await mkdir(join(projectA, ".git"));
  await mkdir(join(projectB, ".git"));
  process.env.DIFFGAZER_HOME = tempHome;
  process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT = "1";
  vi.resetModules();
});

afterEach(async () => {
  delete process.env.DIFFGAZER_HOME;
  delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
  vi.doUnmock("../../shared/lib/git/service.js");
  await rm(tempHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
  await rm(projectA, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
  await rm(projectB, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
});

async function createReviewApp(): Promise<Hono> {
  const { reviewRouter } = await import("./router.js");
  return new Hono().route("/api/review", reviewRouter);
}

async function trustProject(projectRoot: string): Promise<void> {
  const { getStore } = await import("../../shared/lib/config/store.js");
  const project = getStore().ensureProjectFile(projectRoot);
  await getStore().saveTrust({
    projectId: requireValue(project.projectId, "project id"),
    repoRoot: projectRoot,
    trustedAt: "2024-01-01T00:00:00.000Z",
    capabilities: { readFiles: true, runCommands: false },
    trustMode: "persistent",
  });
}

async function saveReview(reviewId: string, projectPath: string): Promise<void> {
  const { saveReview: saveStoredReview } = await import("./storage/reviews.js");
  const result = await saveStoredReview({
    reviewId,
    projectPath,
    mode: "unstaged",
    branch: "main",
    commit: "abc123",
    lenses: ["correctness"],
    diff: {
      totalStats: { filesChanged: 1, additions: 1, deletions: 0, totalSizeBytes: 100 },
      files: [],
    },
    result: {
      summary: "summary",
      issues: [makeIssue({ id: `${reviewId}-issue` })],
    },
  });
  expect(result.ok).toBe(true);
}

function requestOptions(projectRoot: string): RequestInit {
  return { headers: { [PROJECT_ROOT_HEADER]: projectRoot } };
}

function installGitServiceMock() {
  const gitService = {
    getHeadCommit: vi.fn<() => Promise<Result<string, { message: string }>>>(async () =>
      ok("abc123"),
    ),
    getStatusHash: vi.fn<() => Promise<StatusHashResult>>(async () => ({
      kind: "full",
      hash: "status",
    })),
  };
  // Boundary mock: subprocess — review routes read repository freshness through
  // createGitService, whose implementation wraps git CLI subprocess calls.
  vi.doMock("../../shared/lib/git/service.js", () => ({
    createGitService: () => gitService,
  }));
  return gitService;
}

function createCompleteEvent(reviewId: string, summary: string): FullReviewStreamEvent {
  return {
    type: "complete",
    result: { issues: [], summary },
    reviewId,
    durationMs: 1,
  };
}

describe("review router project boundaries", () => {
  it(
    "lists reviews when the query project matches the trusted request project",
    async () => {
      await trustProject(projectA);
      await saveReview(REVIEW_A, projectA);
      await saveReview(REVIEW_B, projectB);
      const app = await createReviewApp();

      const response = await app.request(
        `/api/review/reviews?projectPath=${encodeURIComponent(projectA)}`,
        requestOptions(projectA),
      );
      const body = (await response.json()) as { reviews: Array<{ id: string }> };

      expect(response.status).toBe(200);
      expect(body.reviews.map((review) => review.id)).toEqual([REVIEW_A]);
    },
    ROUTE_BOUNDARY_TIMEOUT_MS,
  );

  it("rejects a review list query for a different project", async () => {
    await trustProject(projectA);
    await saveReview(REVIEW_A, projectA);
    await saveReview(REVIEW_B, projectB);
    const app = await createReviewApp();

    const response = await app.request(
      `/api/review/reviews?projectPath=${encodeURIComponent(projectB)}`,
      requestOptions(projectA),
    );

    expect(response.status).toBe(400);
  });

  it("does not read or delete reviews from another project", async () => {
    await trustProject(projectA);
    await saveReview(REVIEW_B, projectB);
    const app = await createReviewApp();

    const readResponse = await app.request(
      `/api/review/reviews/${REVIEW_B}`,
      requestOptions(projectA),
    );
    expect(readResponse.status).toBe(404);

    const deleteResponse = await app.request(`/api/review/reviews/${REVIEW_B}`, {
      ...requestOptions(projectA),
      method: "DELETE",
    });
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({ existed: false });

    const { getReview } = await import("./storage/reviews.js");
    const stored = await getReview(REVIEW_B);
    expect(stored.ok).toBe(true);
  });

  it("keeps review deletion idempotent when a review does not exist", async () => {
    await trustProject(projectA);
    const app = await createReviewApp();

    const response = await app.request(`/api/review/reviews/${REVIEW_A}`, {
      ...requestOptions(projectA),
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ existed: false });
  });
});

describe("POST /api/review/reviews", () => {
  it("requires setup before accepting requests", async () => {
    await trustProject(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      ...requestOptions(projectA),
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "unstaged" }),
    });

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("SETUP_REQUIRED");
  });

  // This test verifies the 503 error response format (JSON, not SSE) because
  // setup is not configured. It does not reach the actual POST handler logic.
  it("does not return SSE content type", async () => {
    await trustProject(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      ...requestOptions(projectA),
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "unstaged" }),
    });

    expect(response.headers.get("content-type")).not.toContain("text/event-stream");
  });

  it("returns 429 with Retry-After when the route-level creation limit is exceeded", async () => {
    const app = await createReviewApp();

    let response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "unstaged" }),
    });

    for (let i = 0; i < 10; i++) {
      response = await app.request("/api/review/reviews", {
        method: "POST",
        headers: {
          [PROJECT_ROOT_HEADER]: projectA,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "unstaged" }),
      });
    }

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});

async function configureSetup(projectRoot: string): Promise<void> {
  const { getStore } = await import("../../shared/lib/config/store.js");
  await getStore().updateSettings({ secretsStorage: "file" });
  await getStore().saveProviderCredentials({
    provider: "gemini",
    apiKey: "test-key-not-real",
    model: "gemini-2.0-flash",
  });
  await trustProject(projectRoot);
}

describe("POST /api/review/reviews validation", () => {
  it("rejects an invalid mode value", async () => {
    await configureSetup(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "garbage" }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a non-array files field", async () => {
    await configureSetup(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: "not-an-array" }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    ["../escape.ts"],
    ["/abs/path.ts"],
    ["C:\\win.ts"],
  ])("rejects non-repo-relative files entry %s", async (badPath) => {
    await configureSetup(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "files", files: [badPath] }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a non-JSON content type", async () => {
    await configureSetup(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "text/plain",
      },
      body: "not json",
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

describe("POST /api/review/reviews files[] input limits", () => {
  it("rejects files arrays exceeding 200 items", async () => {
    await configureSetup(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "files",
        files: Array.from({ length: 201 }, (_, i) => `file-${i}.ts`),
      }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects file paths exceeding 500 characters", async () => {
    await configureSetup(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "files",
        files: ["a".repeat(501)],
      }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("accepts files arrays within limits", async () => {
    await configureSetup(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "files",
        files: ["src/index.ts", "src/app.tsx"],
      }),
    });

    expect(response.status).not.toBe(400);
  });

  it("accepts embedded dots inside a relative file path segment", async () => {
    await configureSetup(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "files",
        files: ["src/foo..bar.ts"],
      }),
    });

    expect(response.status).not.toBe(400);
  });
});

describe("DELETE /api/review/sessions/:id cancel contract", () => {
  it("returns cancelled:true with reason not-found for an unknown session", async () => {
    await trustProject(projectA);
    const app = await createReviewApp();

    const response = await app.request(`/api/review/sessions/${REVIEW_A}`, {
      ...requestOptions(projectA),
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cancelled: true, reason: "not-found" });
  });

  it("returns cancelled:true with reason not-found for a session owned by another project", async () => {
    await trustProject(projectA);
    const { createSession } = await import("./stream/store.js");
    createSession(REVIEW_B, {
      projectPath: projectB,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    const app = await createReviewApp();

    const response = await app.request(`/api/review/sessions/${REVIEW_B}`, {
      ...requestOptions(projectA),
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cancelled: true, reason: "not-found" });
  });

  it("returns cancelled:true with reason already-complete for a terminal session", async () => {
    await trustProject(projectA);
    const { createSession, markComplete } = await import("./stream/store.js");
    createSession(REVIEW_A, {
      projectPath: projectA,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    markComplete(REVIEW_A);
    const app = await createReviewApp();

    const response = await app.request(`/api/review/sessions/${REVIEW_A}`, {
      ...requestOptions(projectA),
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cancelled: true, reason: "already-complete" });
  });

  it("returns cancelled:true with reason cancelled for an active session", async () => {
    await trustProject(projectA);
    const { createSession } = await import("./stream/store.js");
    createSession(REVIEW_A, {
      projectPath: projectA,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    const app = await createReviewApp();

    const response = await app.request(`/api/review/sessions/${REVIEW_A}`, {
      ...requestOptions(projectA),
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cancelled: true, reason: "cancelled" });
  });
});

describe("GET /api/review/reviews/:id/stream", () => {
  it("returns 404 for an unknown review stream id", async () => {
    await trustProject(projectA);
    installGitServiceMock();
    const app = await createReviewApp();

    const response = await app.request(
      `/api/review/reviews/${REVIEW_A}/stream`,
      requestOptions(projectA),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("SESSION_NOT_FOUND");
  });

  it("returns 404 when a session belongs to another project", async () => {
    await trustProject(projectA);
    installGitServiceMock();
    const { createSession, markReady } = await import("./stream/store.js");
    createSession(REVIEW_B, {
      projectPath: projectB,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_B);
    const app = await createReviewApp();

    const response = await app.request(
      `/api/review/reviews/${REVIEW_B}/stream`,
      requestOptions(projectA),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("SESSION_NOT_FOUND");
  });

  it("returns 409 for a stale session and cancels it", async () => {
    await trustProject(projectA);
    const gitService = installGitServiceMock();
    gitService.getStatusHash.mockResolvedValue({ kind: "full", hash: "changed" });
    const { createSession, markReady } = await import("./stream/store.js");
    createSession(REVIEW_A, {
      projectPath: projectA,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_A);
    const app = await createReviewApp();

    const response = await app.request(
      `/api/review/reviews/${REVIEW_A}/stream`,
      requestOptions(projectA),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("SESSION_STALE");

    const activeResponse = await app.request(
      "/api/review/sessions/active",
      requestOptions(projectA),
    );
    await expect(activeResponse.json()).resolves.toEqual({ session: null });
  });

  it("replays stored SSE events for a fresh session", async () => {
    await trustProject(projectA);
    installGitServiceMock();
    const { addEvent, createSession, markReady } = await import("./stream/store.js");
    createSession(REVIEW_A, {
      projectPath: projectA,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_A);
    addEvent(REVIEW_A, createCompleteEvent(REVIEW_A, "Replay summary"));
    const app = await createReviewApp();

    const response = await app.request(
      `/api/review/reviews/${REVIEW_A}/stream`,
      requestOptions(projectA),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("event: complete");
    expect(body).toContain("Replay summary");
  });
});

describe("GET /api/review/sessions/active", () => {
  it("returns 500 when repository state cannot be inspected", async () => {
    await trustProject(projectA);
    const gitService = installGitServiceMock();
    gitService.getHeadCommit.mockResolvedValue(err({ message: "git failed" }));
    const app = await createReviewApp();

    const response = await app.request("/api/review/sessions/active", requestOptions(projectA));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("returns the current project's active session and not another project's", async () => {
    await trustProject(projectA);
    installGitServiceMock();
    const { createSession, markReady } = await import("./stream/store.js");
    createSession(REVIEW_B, {
      projectPath: projectB,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_B);
    createSession(REVIEW_A, {
      projectPath: projectA,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_A);
    const app = await createReviewApp();

    const response = await app.request("/api/review/sessions/active", requestOptions(projectA));
    const body = (await response.json()) as { session: { reviewId: string } | null };

    expect(response.status).toBe(200);
    expect(body.session?.reviewId).toBe(REVIEW_A);
  });
});

describe("review router param validation", () => {
  it("rejects a non-UUID review id on GET", async () => {
    await trustProject(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews/not-a-uuid", requestOptions(projectA));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a non-UUID review id on DELETE", async () => {
    await trustProject(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews/not-a-uuid", {
      ...requestOptions(projectA),
      method: "DELETE",
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
