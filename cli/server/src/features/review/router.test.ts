import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROJECT_ROOT_HEADER, SHUTDOWN_TOKEN_HEADER } from "@diffgazer/core/api/protocol";
import type { Result } from "@diffgazer/core/result";
import { err, ok } from "@diffgazer/core/result";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import { CreateReviewResponseSchema, ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StatusHashResult } from "../../shared/lib/git/service.js";
import { canonicalizeProjectRoot } from "../../shared/lib/paths.js";
import { makeIssue } from "../../shared/lib/testing/factories.js";
import {
  CREATE_REVIEW_BODY_LIMIT_KB,
  DEFAULT_BODY_LIMIT_KB,
} from "../../shared/middlewares/body-limit.js";
import { requireValue } from "../../testing/assertions.js";
import { MAX_REVIEW_FILES, MAX_REVIEW_PATH_LENGTH } from "./schemas.js";

const REVIEW_A = "550e8400-e29b-41d4-a716-446655440000";
const REVIEW_B = "660e8400-e29b-41d4-a716-446655440001";
const REVIEW_C = "770e8400-e29b-41d4-a716-446655440002";
const REVIEW_D = "880e8400-e29b-41d4-a716-446655440003";
const ROUTE_BOUNDARY_TIMEOUT_MS = 10_000;
const SETTINGS_TOKEN = "review-router-settings-token";
const ROUTER_REVIEW_DIFF = [
  "diff --git a/src/app.ts b/src/app.ts",
  "index 1111111..2222222 100644",
  "--- a/src/app.ts",
  "+++ b/src/app.ts",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  "",
].join("\n");

let tempHome: string;
let projectA: string;
let projectB: string;

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "diffgazer-review-router-home-"));
  projectA = canonicalizeProjectRoot(await mkdtemp(join(tmpdir(), "diffgazer-review-router-a-")));
  projectB = canonicalizeProjectRoot(await mkdtemp(join(tmpdir(), "diffgazer-review-router-b-")));
  await mkdir(join(projectA, ".git"));
  await mkdir(join(projectB, ".git"));
  process.env.DIFFGAZER_HOME = tempHome;
  process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT = "1";
  process.env.DIFFGAZER_SHUTDOWN_TOKEN = SETTINGS_TOKEN;
  vi.resetModules();
});

afterEach(async () => {
  delete process.env.DIFFGAZER_HOME;
  delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
  delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
  vi.doUnmock("../../shared/lib/ai/client/initialize.js");
  vi.doUnmock("../../shared/lib/git/service.js");
  vi.doUnmock("./service.js");
  await rm(tempHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
  await rm(projectA, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
  await rm(projectB, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
});

async function createReviewApp(): Promise<Hono> {
  const { reviewRouter } = await import("./router.js");
  return new Hono().route("/api/review", reviewRouter);
}

async function createReviewSettingsApp(): Promise<Hono> {
  const [{ reviewRouter }, { settingsRouter }] = await Promise.all([
    import("./router.js"),
    import("../settings/router.js"),
  ]);
  return new Hono().route("/api/review", reviewRouter).route("/api/settings", settingsRouter);
}

async function trustProject(projectRoot: string): Promise<void> {
  const { getStore } = await import("../../shared/lib/config/store.js");
  const canonicalRoot = canonicalizeProjectRoot(projectRoot);
  const project = getStore().ensureProjectFile(canonicalRoot);
  await getStore().saveTrust({
    projectId: requireValue(project.projectId, "project id"),
    repoRoot: canonicalRoot,
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
      issues: [makeIssue({ id: `${reviewId}-issue` })],
    },
  });
  expect(result.ok).toBe(true);
}

function requestOptions(projectRoot: string): RequestInit {
  return { headers: { [PROJECT_ROOT_HEADER]: projectRoot } };
}

async function writeContextSnapshot(
  contextDir: string,
  root: string,
  markdown: string,
): Promise<void> {
  const graph = {
    generatedAt: "2025-01-01",
    root,
    packages: [],
    edges: [],
    fileTree: [],
    changedFiles: [],
  };
  const meta = {
    generatedAt: "2025-01-01",
    root,
    statusHash: "status",
    statusHashKind: "full",
    charCount: markdown.length,
  };
  const generation = "router-fixture";
  const markdownFile = `context.${generation}.md`;
  const graphFile = `context.${generation}.json`;
  const metaFile = `context.${generation}.meta.json`;
  const graphContent = JSON.stringify(graph);
  const metaContent = JSON.stringify(meta);
  const sha256 = (content: string) => createHash("sha256").update(content).digest("hex");
  await writeFile(join(contextDir, markdownFile), markdown, "utf-8");
  await writeFile(join(contextDir, graphFile), graphContent, "utf-8");
  await writeFile(join(contextDir, metaFile), metaContent, "utf-8");
  await writeFile(
    join(contextDir, "context.manifest.json"),
    JSON.stringify({
      version: 1,
      generation,
      artifacts: {
        markdown: { file: markdownFile, sha256: sha256(markdown) },
        graph: { file: graphFile, sha256: sha256(graphContent) },
        meta: { file: metaFile, sha256: sha256(metaContent) },
      },
    }),
    "utf-8",
  );
}

function installGitServiceMock() {
  const gitService = {
    getDiff: vi.fn(async () => ok(ROUTER_REVIEW_DIFF)),
    getHeadCommit: vi.fn<() => Promise<Result<string, { message: string }>>>(async () =>
      ok("abc123"),
    ),
    getStatus: vi.fn(async () => ok({ branch: "main" })),
    getStatusHash: vi.fn<() => Promise<StatusHashResult>>(async () => ({
      kind: "full",
      hash: "status",
    })),
  };
  // Boundary mock: createGitService wraps git CLI subprocess calls.
  vi.doMock("../../shared/lib/git/service.js", () => ({
    createGitService: () => gitService,
  }));
  return gitService;
}

function installDeferredGitServiceMock() {
  const headCommit = createDeferred<Result<string, { message: string }>>();
  const gitService = {
    getDiff: vi.fn(async () => ok(ROUTER_REVIEW_DIFF)),
    getHeadCommit: vi.fn(() => headCommit.promise),
    getStatus: vi.fn(async () => ok({ branch: "main" })),
    getStatusHash: vi.fn<() => Promise<StatusHashResult>>(async () => ({
      kind: "full",
      hash: "status",
    })),
  };
  vi.doMock("../../shared/lib/git/service.js", () => ({
    createGitService: () => gitService,
  }));
  return { gitService, headCommit };
}

function installProviderWorkProbe() {
  const generate = vi.fn();
  vi.doMock("../../shared/lib/ai/client/initialize.js", () => ({
    initializeAIClient: () =>
      ok({
        provider: "gemini",
        executionFingerprint: { provider: "gemini", model: "gemini-2.0-flash" },
        generate,
      }),
  }));
  return generate;
}

function createCompleteEvent(reviewId: string): FullReviewStreamEvent {
  return {
    type: "complete",
    result: { issues: [] },
    reviewId,
    durationMs: 1,
  };
}

function installSuccessfulReviewCreationMock() {
  const session = {
    reviewId: REVIEW_A,
    mode: "files" as const,
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    headCommit: "abc123",
    statusHash: "status",
  };
  const createReviewSession = vi.fn(async () => ok({ reviewId: REVIEW_A, session }));

  vi.doMock("../../shared/lib/ai/client/initialize.js", () => ({
    initializeAIClient: () => ok({ provider: "gemini" }),
  }));
  vi.doMock("./service.js", () => ({ createReviewSession }));

  return createReviewSession;
}

function jsonBodyWithByteLength(byteLength: number): string {
  const prefix = '{"mode":"unstaged","padding":"';
  const suffix = '"}';
  return `${prefix}${"x".repeat(byteLength - prefix.length - suffix.length)}${suffix}`;
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

  it("does not read reviews from another project", async () => {
    await trustProject(projectA);
    await saveReview(REVIEW_B, projectB);
    const app = await createReviewApp();

    const readResponse = await app.request(
      `/api/review/reviews/${REVIEW_B}`,
      requestOptions(projectA),
    );
    expect(readResponse.status).toBe(404);

    const { getReview } = await import("./storage/reviews.js");
    const stored = await getReview(REVIEW_B);
    expect(stored.ok).toBe(true);
  });

  it("omits the persisted diff from review detail responses", async () => {
    await trustProject(projectA);
    await saveReview(REVIEW_A, projectA);
    const app = await createReviewApp();

    const response = await app.request(`/api/review/reviews/${REVIEW_A}`, requestOptions(projectA));
    const body = (await response.json()) as { review: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.review).not.toHaveProperty("diff");

    const { getReview } = await import("./storage/reviews.js");
    const stored = await getReview(REVIEW_A);
    expect(stored.ok).toBe(true);
    if (stored.ok) expect(stored.value.diff).toBeDefined();
  });

  it.each([
    ["DELETE", `/api/review/reviews/${REVIEW_A}`],
    ["POST", `/api/review/reviews/${REVIEW_A}/drilldown`],
  ])("does not mount the retired %s %s endpoint", async (method, path) => {
    const app = await createReviewApp();

    const response = await app.request(path, {
      ...requestOptions(projectA),
      method,
      headers: {
        ...requestOptions(projectA).headers,
        "content-type": "application/json",
      },
      body: method === "POST" ? JSON.stringify({ issueId: "issue-1" }) : undefined,
    });

    expect(response.status).toBe(404);
  });
});

describe("GET /api/review/reviews pagination", () => {
  it("continues without duplicates after a newer insert and deletion of the cursor review", async () => {
    await trustProject(projectA);
    await saveReview(REVIEW_A, projectA);
    await saveReview(REVIEW_B, projectA);
    await saveReview(REVIEW_C, projectA);
    const app = await createReviewApp();

    const firstResponse = await app.request(
      "/api/review/reviews?limit=2",
      requestOptions(projectA),
    );
    const first = (await firstResponse.json()) as {
      reviews: Array<{ id: string }>;
      nextCursor: string | null;
    };

    expect(firstResponse.status).toBe(200);
    expect(first.reviews.map((review) => review.id)).toEqual([REVIEW_C, REVIEW_B]);
    expect(first.nextCursor).toMatch(/^dg1_[A-Za-z0-9_-]+$/);
    expect(first.nextCursor).not.toBe(REVIEW_B);

    await saveReview(REVIEW_D, projectA);
    await unlink(join(tempHome, "triage-reviews", `${REVIEW_B}.json`));
    const secondResponse = await app.request(
      `/api/review/reviews?limit=2&cursor=${first.nextCursor}`,
      requestOptions(projectA),
    );
    const second = (await secondResponse.json()) as {
      reviews: Array<{ id: string }>;
      nextCursor: string | null;
    };

    expect(secondResponse.status).toBe(200);
    expect(second.reviews.map((review) => review.id)).toEqual([REVIEW_A]);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.reviews, ...second.reviews].map((review) => review.id))).toEqual(
      new Set([REVIEW_A, REVIEW_B, REVIEW_C]),
    );

    const refreshedResponse = await app.request(
      "/api/review/reviews?limit=2",
      requestOptions(projectA),
    );
    const refreshed = (await refreshedResponse.json()) as { reviews: Array<{ id: string }> };
    expect(refreshed.reviews.map((review) => review.id)).toEqual([REVIEW_D, REVIEW_C]);
  });

  it("rejects malformed cursors and out-of-range limits", async () => {
    await trustProject(projectA);
    const app = await createReviewApp();

    const [legacyCursorResponse, malformedCursorResponse, semanticCursorResponse, limitResponse] =
      await Promise.all([
        app.request(`/api/review/reviews?cursor=${REVIEW_A}`, requestOptions(projectA)),
        app.request("/api/review/reviews?cursor=not-a-uuid", requestOptions(projectA)),
        app.request("/api/review/reviews?cursor=dg1_bm90LWpzb24", requestOptions(projectA)),
        app.request("/api/review/reviews?limit=101", requestOptions(projectA)),
      ]);

    expect(legacyCursorResponse.status).toBe(400);
    expect(malformedCursorResponse.status).toBe(400);
    expect(semanticCursorResponse.status).toBe(400);
    expect(limitResponse.status).toBe(400);
  });
});

describe("POST /api/review/reviews", () => {
  it("returns the active session metadata for the created review", async () => {
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const session = {
      reviewId: REVIEW_A,
      mode: "staged",
      startedAt,
      headCommit: "abc123",
      statusHash: "status",
    };
    vi.doMock("../../shared/lib/ai/client/initialize.js", () => ({
      initializeAIClient: () => ok({ provider: "gemini" }),
    }));
    vi.doMock("./service.js", () => ({
      createReviewSession: vi.fn(async () => ok({ reviewId: REVIEW_A, session })),
    }));
    await configureSetup(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "staged" }),
    });

    const body = await response.json();
    const expected = {
      reviewId: REVIEW_A,
      session: {
        reviewId: REVIEW_A,
        mode: "staged",
        startedAt: startedAt.toISOString(),
        headCommit: "abc123",
        statusHash: "status",
      },
    };

    expect(response.status).toBe(200);
    expect(CreateReviewResponseSchema.parse(body)).toEqual(expected);
  });

  it("preserves a keyring read failure in the review creation response", async () => {
    const createReviewSession = vi.fn();
    vi.doMock("../../shared/lib/ai/client/initialize.js", () => ({
      initializeAIClient: () =>
        err({ code: "KEYRING_READ_FAILED", message: "Could not read the OS keyring" }),
    }));
    vi.doMock("./service.js", () => ({ createReviewSession }));
    await configureSetup(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "unstaged" }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "KEYRING_READ_FAILED",
        message: "Could not read the OS keyring",
      },
    });
    expect(createReviewSession).not.toHaveBeenCalled();
  });

  it("waits for asynchronous client initialization before creating a review", async () => {
    const client = createDeferred<Result<{ provider: "gemini" }, { message: string }>>();
    const initializeAIClient = vi.fn(() => client.promise);
    const session = {
      reviewId: REVIEW_A,
      mode: "unstaged" as const,
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      headCommit: "abc123",
      statusHash: "status",
    };
    const createReviewSession = vi.fn(async () => ok({ reviewId: REVIEW_A, session }));
    vi.doMock("../../shared/lib/ai/client/initialize.js", () => ({ initializeAIClient }));
    vi.doMock("./service.js", () => ({ createReviewSession }));
    await configureSetup(projectA);
    const app = await createReviewApp();

    const responsePromise = app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "unstaged" }),
    });

    await vi.waitFor(() => expect(initializeAIClient).toHaveBeenCalledOnce());
    expect(createReviewSession).not.toHaveBeenCalled();

    client.resolve(ok({ provider: "gemini" }));
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(createReviewSession).toHaveBeenCalledOnce();
  });

  it.each(["downgrade", "delete"] as const)(
    "does not start provider work when trust %s completes during Git inspection",
    async (revocation) => {
      await configureSetup(projectA);
      const providerWork = installProviderWorkProbe();
      const { gitService, headCommit } = installDeferredGitServiceMock();
      const app = await createReviewSettingsApp();

      const reviewRequest = app.request("/api/review/reviews", {
        method: "POST",
        headers: {
          [PROJECT_ROOT_HEADER]: projectA,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "unstaged" }),
      });
      await vi.waitFor(() => expect(gitService.getHeadCommit).toHaveBeenCalledOnce());

      const trustResponse = await app.request("/api/settings/trust", {
        method: revocation === "delete" ? "DELETE" : "POST",
        headers: {
          [PROJECT_ROOT_HEADER]: projectA,
          [SHUTDOWN_TOKEN_HEADER]: SETTINGS_TOKEN,
          ...(revocation === "downgrade" ? { "Content-Type": "application/json" } : {}),
        },
        ...(revocation === "downgrade"
          ? {
              body: JSON.stringify({
                capabilities: { readFiles: false },
                trustMode: "persistent",
              }),
            }
          : {}),
      });
      expect(trustResponse.status).toBe(200);

      headCommit.resolve(ok("abc123"));
      const reviewResponse = await reviewRequest;
      expect(reviewResponse.status).toBe(403);
      await expect(reviewResponse.json()).resolves.toMatchObject({
        error: { code: ErrorCode.TRUST_REQUIRED },
      });
      expect(providerWork).not.toHaveBeenCalled();
    },
    ROUTE_BOUNDARY_TIMEOUT_MS,
  );

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

  it("keeps the creation window and Retry-After bounded across wall-clock jumps", async () => {
    const wallClock = vi.spyOn(Date, "now").mockReturnValue(10_000);
    const app = await createReviewApp();
    const request = () =>
      app.request("/api/review/reviews", {
        method: "POST",
        headers: {
          [PROJECT_ROOT_HEADER]: projectA,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "unstaged" }),
      });

    for (let i = 0; i < 10; i++) await request();

    wallClock.mockReturnValue(Number.MAX_SAFE_INTEGER);
    const forwardJump = await request();
    expect(forwardJump.status).toBe(429);
    expect(Number(forwardJump.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(Number(forwardJump.headers.get("Retry-After"))).toBeLessThanOrEqual(60);

    wallClock.mockReturnValue(-Number.MAX_SAFE_INTEGER);
    const backwardJump = await request();
    expect(backwardJump.status).toBe(429);
    expect(Number(backwardJump.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(Number(backwardJump.headers.get("Retry-After"))).toBeLessThanOrEqual(60);

    wallClock.mockRestore();
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
    const createReviewSession = installSuccessfulReviewCreationMock();
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

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: "Content-Type must be application/json",
      },
    });
    expect(createReviewSession).not.toHaveBeenCalled();
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

  it("accepts the schema's worst JSON-escaped files payload under the review cap", async () => {
    const createReviewSession = installSuccessfulReviewCreationMock();
    await configureSetup(projectA);
    const app = await createReviewApp();
    const escapedPath = "\u0001".repeat(MAX_REVIEW_PATH_LENGTH);
    const files = Array.from({ length: MAX_REVIEW_FILES }, () => escapedPath);
    const body = JSON.stringify({ mode: "files", files });

    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(DEFAULT_BODY_LIMIT_KB * 1024);
    expect(new TextEncoder().encode(body).byteLength).toBeLessThan(
      CREATE_REVIEW_BODY_LIMIT_KB * 1024,
    );

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body,
    });

    expect(response.status).toBe(200);
    expect(createReviewSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ files: [escapedPath] }),
    );
  });

  it("accepts an exact-cap JSON body and rejects one byte over", async () => {
    installSuccessfulReviewCreationMock();
    await configureSetup(projectA);
    const app = await createReviewApp();
    const capBytes = CREATE_REVIEW_BODY_LIMIT_KB * 1024;
    const exactBody = jsonBodyWithByteLength(capBytes);

    expect(new TextEncoder().encode(exactBody)).toHaveLength(capBytes);

    const exactResponse = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: exactBody,
    });
    const overflowResponse = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: `${exactBody}x`,
    });

    expect(exactResponse.status).toBe(200);
    expect(overflowResponse.status).toBe(413);
    await expect(overflowResponse.json()).resolves.toMatchObject({
      error: { code: "PAYLOAD_TOO_LARGE" },
    });
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

  it("reports an in-progress commit without publishing CANCELLED", async () => {
    await trustProject(projectA);
    const received: FullReviewStreamEvent[] = [];
    const { createSession, markCommitting, subscribe } = await import("./stream/store.js");
    createSession(REVIEW_A, {
      projectPath: projectA,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    subscribe(REVIEW_A, (event) => received.push(event));
    expect(markCommitting(REVIEW_A)).toBe(true);
    const app = await createReviewApp();

    const response = await app.request(`/api/review/sessions/${REVIEW_A}`, {
      ...requestOptions(projectA),
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      cancelled: true,
      reason: "already-committed",
    });
    expect(received).toEqual([]);
  });

  it("returns cancelled:true and notifies subscribers with CANCELLED for an active session", async () => {
    await trustProject(projectA);
    const received: FullReviewStreamEvent[] = [];
    const { createSession, markReady, subscribe } = await import("./stream/store.js");
    createSession(REVIEW_A, {
      projectPath: projectA,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    markReady(REVIEW_A);
    subscribe(REVIEW_A, (event) => received.push(event));
    const app = await createReviewApp();

    const response = await app.request(`/api/review/sessions/${REVIEW_A}`, {
      ...requestOptions(projectA),
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cancelled: true, reason: "cancelled" });
    expect(received).toMatchObject([{ type: "error", error: { code: ReviewErrorCode.CANCELLED } }]);
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
    addEvent(REVIEW_A, createCompleteEvent(REVIEW_A));
    const app = await createReviewApp();

    const response = await app.request(
      `/api/review/reviews/${REVIEW_A}/stream`,
      requestOptions(projectA),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("event: complete");
    expect(body).not.toContain('"summary"');
  });
});

describe("GET /api/review/sessions/active", () => {
  it("returns null for concurrent empty mode lookups without reading Git identity", async () => {
    await trustProject(projectA);
    const gitService = installGitServiceMock();
    const app = await createReviewApp();

    const [unstagedResponse, stagedResponse] = await Promise.all([
      app.request("/api/review/sessions/active?mode=unstaged", requestOptions(projectA)),
      app.request("/api/review/sessions/active?mode=staged", requestOptions(projectA)),
    ]);

    expect(unstagedResponse.status).toBe(200);
    expect(stagedResponse.status).toBe(200);
    await expect(unstagedResponse.json()).resolves.toEqual({ session: null });
    await expect(stagedResponse.json()).resolves.toEqual({ session: null });
    expect(gitService.getHeadCommit).not.toHaveBeenCalled();
    expect(gitService.getStatusHash).not.toHaveBeenCalled();
  });

  it("returns 500 when repository state cannot be inspected", async () => {
    await trustProject(projectA);
    const gitService = installGitServiceMock();
    gitService.getHeadCommit.mockResolvedValue(err({ message: "git failed" }));
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

    const response = await app.request("/api/review/sessions/active", requestOptions(projectA));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("returns the current project's active session and not another project's", async () => {
    await trustProject(projectA);
    const gitService = installGitServiceMock();
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
    expect(gitService.getHeadCommit).toHaveBeenCalledOnce();
    expect(gitService.getStatusHash).toHaveBeenCalledOnce();
  });

  it("returns null for a stale candidate without cancelling it", async () => {
    await trustProject(projectA);
    const gitService = installGitServiceMock();
    gitService.getStatusHash.mockResolvedValue({ kind: "full", hash: "changed" });
    const { createSession, getSession, markReady } = await import("./stream/store.js");
    const candidate = createSession(REVIEW_A, {
      projectPath: projectA,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_A);
    const app = await createReviewApp();

    const response = await app.request("/api/review/sessions/active", requestOptions(projectA));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ session: null });
    expect(gitService.getHeadCommit).toHaveBeenCalledOnce();
    expect(gitService.getStatusHash).toHaveBeenCalledOnce();
    expect(getSession(REVIEW_A)).toBe(candidate);
    expect(candidate.isComplete).toBe(false);
    expect(candidate.controller.signal.aborted).toBe(false);
  });
});

describe("GET /api/review/context read-path security", () => {
  it("serves a cached snapshot whose stored root matches the project", async () => {
    await configureSetup(projectA);
    const contextDir = join(projectA, ".diffgazer");
    await mkdir(contextDir, { recursive: true });
    await writeContextSnapshot(contextDir, projectA, "# current project context");
    const app = await createReviewApp();

    const response = await app.request("/api/review/context", requestOptions(projectA));
    const body = (await response.json()) as { text: string; markdown: string };

    expect(response.status).toBe(200);
    expect(body.markdown).toContain("# current project context");
    expect(body.text).toContain("current project context");
    expect(body.text).not.toContain("# current project context");
  });

  it("returns 404 for a snapshot whose stored root belongs to a different checkout", async () => {
    await configureSetup(projectA);
    const contextDir = join(projectA, ".diffgazer");
    await mkdir(contextDir, { recursive: true });
    await writeContextSnapshot(contextDir, projectB, "# foreign checkout context");
    const app = await createReviewApp();

    const response = await app.request("/api/review/context", requestOptions(projectA));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it.skipIf(process.platform === "win32")(
    "does not serve context files through a symlinked .diffgazer directory",
    async () => {
      const outsideRoot = await mkdtemp(join(tmpdir(), "diffgazer-review-router-outside-"));
      try {
        // Symlink `.diffgazer` before setup so trust is written through the link
        // and repo-access passes, leaving the context guard as the only refusal.
        await symlink(outsideRoot, join(projectA, ".diffgazer"));
        await configureSetup(projectA);
        await writeContextSnapshot(outsideRoot, projectA, "SECRET_EXTERNAL_CONTEXT_MARKER");
        const app = await createReviewApp();

        const response = await app.request("/api/review/context", requestOptions(projectA));
        const text = await response.text();

        expect(response.status).toBe(404);
        expect(text).not.toContain("SECRET_EXTERNAL_CONTEXT_MARKER");
      } finally {
        await rm(outsideRoot, { recursive: true, force: true });
      }
    },
  );
});

describe("POST /api/review/context/refresh", () => {
  it("rebuilds the cached snapshot from the changed package marker when forced", async () => {
    await configureSetup(projectA);
    installGitServiceMock();
    await writeFile(
      join(projectA, "package.json"),
      JSON.stringify({ name: "first", version: "1.0.0" }),
      "utf-8",
    );
    const app = await createReviewApp();

    const seed = await app.request("/api/review/context/refresh", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const seeded = (await seed.json()) as { markdown: string };
    expect(seed.status).toBe(200);
    expect(seeded.markdown).toContain("- Name: first");

    await writeFile(
      join(projectA, "package.json"),
      JSON.stringify({ name: "second", version: "1.0.0" }),
      "utf-8",
    );

    const response = await app.request("/api/review/context/refresh", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ force: true }),
    });
    const body = (await response.json()) as { markdown: string };

    expect(response.status).toBe(200);
    expect(body.markdown).toContain("- Name: second");
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
});
