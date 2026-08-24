import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROJECT_ROOT_HEADER, SHUTDOWN_TOKEN_HEADER } from "@diffgazer/core/api/protocol";
import { sha256CanonicalJsonSync } from "@diffgazer/core/json";
import type { Result } from "@diffgazer/core/result";
import { err, ok } from "@diffgazer/core/result";
import { describeReviewStartError, isCredentialSetupError } from "@diffgazer/core/review";
import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "@diffgazer/core/schemas/config";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import {
  buildLensReviewResultJsonSchema,
  CreateReviewResponseSchema,
  type EvidenceKey,
  ReviewErrorCode,
} from "@diffgazer/core/schemas/review";
import { requireValue } from "@diffgazer/core/testing/assertions";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STRUCTURED_OUTPUT_FAILURE_GUIDANCE } from "../../shared/lib/ai/admission/service.js";
import type { InitializedAIClient } from "../../shared/lib/ai/client/initialize.js";
import { executionLimitsFromBudget } from "../../shared/lib/config/budget-ceiling.js";
import type { ConfigStore } from "../../shared/lib/config/store.js";
import { DEFAULT_CONFIGURATION_BUDGET } from "../../shared/lib/config/store.js";
import type { StatusHashResult } from "../../shared/lib/git/service.js";
import { canonicalizeProjectRoot } from "../../shared/lib/paths.js";
import { assertTempHome } from "../../shared/lib/testing/temp-home.js";
import {
  CREATE_REVIEW_BODY_LIMIT_KB,
  DEFAULT_BODY_LIMIT_KB,
} from "../../shared/middlewares/body-limit.js";
import { MAX_REVIEW_FILES, MAX_REVIEW_PATH_LENGTH } from "./schemas.js";

const REVIEW_A = "550e8400-e29b-41d4-a716-446655440000";
const REVIEW_B = "660e8400-e29b-41d4-a716-446655440001";
const REVIEW_C = "770e8400-e29b-41d4-a716-446655440002";
const REVIEW_D = "880e8400-e29b-41d4-a716-446655440003";
const ROUTE_BOUNDARY_TIMEOUT_MS = 10_000;
const SETTINGS_TOKEN = "review-router-settings-token";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const SETUP_OBSERVED_AT = "2024-01-01T00:00:00.000Z";
const MOCK_CONFIGURATION_ID = "gemini-primary";
const MOCK_EXECUTION_FINGERPRINT = "mock-fingerprint";
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
const loadedStores = new Set<ConfigStore>();

beforeEach(async () => {
  loadedStores.clear();
  tempHome = await mkdtemp(join(tmpdir(), "diffgazer-review-router-home-"));
  assertTempHome(tempHome);
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
  try {
    for (const store of loadedStores) await store.ready();
    await rm(tempHome, { recursive: true, force: true });
    await rm(projectA, { recursive: true, force: true });
    await rm(projectB, { recursive: true, force: true });
  } finally {
    loadedStores.clear();
    delete process.env.DIFFGAZER_HOME;
    delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
    delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    vi.doUnmock("../../shared/lib/ai/admission/service.js");
    vi.doUnmock("../../shared/lib/git/service.js");
    vi.doUnmock("./service.js");
  }
});

async function loadConfigStore(): Promise<ConfigStore> {
  const { getStore } = await import("../../shared/lib/config/store.js");
  const store = getStore();
  loadedStores.add(store);
  return store;
}

async function createReviewApp(): Promise<Hono> {
  const { reviewRouter } = await import("./router.js");
  await (await loadConfigStore()).ready();
  return new Hono().route("/api/review", reviewRouter);
}

async function createReviewSettingsApp(): Promise<Hono> {
  const [{ reviewRouter }, { settingsRouter }] = await Promise.all([
    import("./router.js"),
    import("../settings/router.js"),
  ]);
  await (await loadConfigStore()).ready();
  return new Hono().route("/api/review", reviewRouter).route("/api/settings", settingsRouter);
}

async function trustProject(projectRoot: string): Promise<void> {
  const store = await loadConfigStore();
  const canonicalRoot = canonicalizeProjectRoot(projectRoot);
  const project = store.ensureProjectFile(canonicalRoot);
  await store.saveTrust({
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
  const authorizeReviewExecution = vi.fn(async () => ok(await buildMockAuthorization()));
  vi.doMock("../../shared/lib/ai/admission/service.js", async (importOriginal) => {
    const actual =
      await importOriginal<typeof import("../../shared/lib/ai/admission/service.js")>();
    return { ...actual, authorizeReviewExecution };
  });
  return authorizeReviewExecution;
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
  const authorizeReviewExecution = vi.fn(async () => ok(await buildMockAuthorization()));

  vi.doMock("../../shared/lib/ai/admission/service.js", async (importOriginal) => {
    const actual =
      await importOriginal<typeof import("../../shared/lib/ai/admission/service.js")>();
    return { ...actual, authorizeReviewExecution };
  });
  vi.doMock("./service.js", () => ({ createReviewSession }));

  return { createReviewSession, authorizeReviewExecution };
}

async function buildMockAuthorization() {
  const { buildExpectedEvidenceKey } = await import(
    "../../shared/lib/config/admission-evidence.js"
  );
  const configurationId = MOCK_CONFIGURATION_ID;
  const home = process.env.DIFFGAZER_HOME;
  if (!home) throw new Error("DIFFGAZER_HOME is required for review router authorization");
  const credentialReferenceIdentity = sha256CanonicalJsonSync({
    kind: "file-0600",
    filePath: join(home, "credentials", `${configurationId}-1.key`),
  });
  const record = {
    schemaVersion: 2 as const,
    status: "supported" as const,
    configurationId,
    revision: 1,
    productId: "gemini" as const,
    transportFamily: "hosted-api" as const,
    input: {
      transportFamily: "hosted-api" as const,
      productId: "gemini" as const,
      endpoint: GEMINI_ENDPOINT,
    },
    selectedModelId: "gemini-2.0-flash",
    acknowledgement: {
      noticeId: "gemini-hosted-api",
      noticeVersion: 1,
      acceptedAt: SETUP_OBSERVED_AT,
    },
    evidenceReference: "evidence-gemini",
    budget: {
      inputTokens: 200_000,
      outputTokens: 40_000,
      responseBytes: 8_000_000,
      wallTimeMs: 300_000,
      retries: 0,
      concurrency: 1,
      perReview: 5,
    },
    createdAt: SETUP_OBSERVED_AT,
    updatedAt: SETUP_OBSERVED_AT,
  };
  const evidenceKey = buildExpectedEvidenceKey({
    record,
    structuredOutputSchemaSha256: routerStructuredOutputSchemaSha256(),
    runtime: { identity: "diffgazer-server", version: "1.0.0" },
    credentialReferenceIdentity,
    workspaceAccountReference: null,
  });
  const plan = {
    configurationId: record.configurationId,
    configurationRevision: record.revision,
    executionFingerprint: MOCK_EXECUTION_FINGERPRINT,
    evidenceKey,
    productId: record.productId,
    transportFamily: record.transportFamily,
    limits: evidenceKey.limits,
  };
  return {
    plan,
    adapter: {
      productId: "gemini" as const,
      transportFamily: "hosted-api" as const,
      execute: vi.fn(),
    },
    budgetReservation: { id: 1 },
    lease: {
      leaseId: "lease-1",
      configurationId: record.configurationId,
      configurationRevision: record.revision,
      executionFingerprint: MOCK_EXECUTION_FINGERPRINT,
      release: () => undefined,
    },
    resolveCredential: async () => "test-key",
    workspaceAccountId: null,
    release: () => undefined,
  };
}

/**
 * Authorization backed by a real lease authority so the route's release
 * ownership is observable: a leaked reservation keeps the single admitted slot
 * occupied and the next acquisition is denied.
 */
function installRealLeaseAuthorization() {
  const identity = {
    configurationId: MOCK_CONFIGURATION_ID,
    configurationRevision: 1,
    executionFingerprint: MOCK_EXECUTION_FINGERPRINT,
  };
  let registry: InstanceType<
    typeof import("../../shared/lib/ai/admission/service.js").ExecutionLeaseRegistry
  > | null = null;
  let limits: EvidenceKey["limits"] | null = null;
  let issuedLeaseId: string | null = null;

  const authorizeReviewExecution = vi.fn(async () => {
    const { ExecutionLeaseRegistry } = await import("../../shared/lib/ai/admission/service.js");
    const base = await buildMockAuthorization();
    registry ??= new ExecutionLeaseRegistry();
    limits ??= { ...base.plan.limits, maxConcurrency: 1 };
    const lease = registry.tryAcquire({ ...identity, limits });
    if (!lease.ok) return lease;
    issuedLeaseId = lease.value.leaseId;
    return ok({
      ...base,
      lease: lease.value,
      release: () => {
        lease.value.release();
      },
    });
  });

  return {
    identity,
    authorizeReviewExecution,
    issuedLeaseId: () => issuedLeaseId,
    activeLeaseCount: () => registry?.activeLeaseCount(identity.configurationId) ?? 0,
    canAdmitAgain: () =>
      registry !== null && limits !== null && registry.tryAcquire({ ...identity, limits }).ok,
  };
}

function createCompleteEvent(reviewId: string): FullReviewStreamEvent {
  return {
    type: "complete",
    result: { issues: [] },
    reviewId,
  };
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

    const { getReviewDetail } = await import("./storage/reviews.js");
    const stored = await getReviewDetail(REVIEW_B);
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

    const { getReviewDetail } = await import("./storage/reviews.js");
    const stored = await getReviewDetail(REVIEW_A);
    expect(stored.ok).toBe(true);
    if (stored.ok) expect(stored.value.review.diff).toBeDefined();
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

describe("blocked V1 review routes", () => {
  it.each([
    "valid",
    "corrupt",
  ] as const)("returns the fixed migration envelope before context or review work with %s recovery", async (recovery) => {
    const authorizeReviewExecution = installProviderWorkProbe();
    const createReviewSession = vi.fn();
    vi.doMock("./service.js", () => ({ createReviewSession }));
    await configureSetup(projectA);
    await writeBlockedV1ReviewState(recovery);
    const app = await createReviewApp();

    const responses = await Promise.all([
      app.request("/api/review/context", requestOptions(projectA)),
      app.request("/api/review/reviews", {
        method: "POST",
        headers: {
          [PROJECT_ROOT_HEADER]: projectA,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "unstaged" }),
      }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "SECRETS_MIGRATION_FAILED",
          message: "Legacy configuration requires manual migration",
        },
      });
    }
    expect(authorizeReviewExecution).not.toHaveBeenCalled();
    expect(createReviewSession).not.toHaveBeenCalled();
  });
});

describe("POST /api/review/reviews", () => {
  it("admits a configuration whose structured output is still unproven", async () => {
    const session = {
      reviewId: REVIEW_A,
      mode: "unstaged" as const,
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      headCommit: "abc123",
      statusHash: "status",
    };
    let admittedClient: InitializedAIClient | undefined;
    const createReviewSession = vi.fn(async (client: InitializedAIClient) => {
      admittedClient = client;
      return ok({ reviewId: REVIEW_A, session });
    });
    vi.doMock("./service.js", () => ({ createReviewSession }));
    await configureSetup(projectA, "none");
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "unstaged" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ reviewId: REVIEW_A });
    expect(admittedClient?.authorization?.evidenceState).toBe("unproven");
  });

  it("fast-fails a configuration whose exact tuple already failed structured output", async () => {
    const createReviewSession = vi.fn();
    vi.doMock("./service.js", () => ({ createReviewSession }));
    await configureSetup(projectA, "failed");
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "unstaged" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: ErrorCode.SETUP_REQUIRED,
        message: STRUCTURED_OUTPUT_FAILURE_GUIDANCE,
      },
    });
    expect(createReviewSession).not.toHaveBeenCalled();
  });

  it("returns the active session metadata and the admission outcome for the created review", async () => {
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const session = {
      reviewId: REVIEW_A,
      mode: "staged",
      startedAt,
      headCommit: "abc123",
      statusHash: "status",
    };
    vi.doMock("../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../shared/lib/ai/admission/service.js")>();
      return {
        ...actual,
        authorizeReviewExecution: vi.fn(async () => ok(await buildMockAuthorization())),
      };
    });
    vi.doMock("./service.js", () => ({
      createReviewSession: vi.fn(async () =>
        ok({ reviewId: REVIEW_A, session, outcome: "no-diff" }),
      ),
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
      outcome: "no-diff",
    };

    expect(response.status).toBe(200);
    expect(CreateReviewResponseSchema.parse(body)).toEqual(expected);
  });

  it("releases the admitted reservation when session creation fails before a session exists", async () => {
    const { activeLeaseCount, canAdmitAgain, authorizeReviewExecution } =
      installRealLeaseAuthorization();
    const createReviewSession = vi.fn(async () =>
      err({ code: ReviewErrorCode.GENERATION_FAILED, message: "Failed to inspect repository" }),
    );
    vi.doMock("../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../shared/lib/ai/admission/service.js")>();
      return { ...actual, authorizeReviewExecution };
    });
    vi.doMock("./service.js", () => ({ createReviewSession }));
    await configureSetup(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: { [PROJECT_ROOT_HEADER]: projectA, "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "unstaged" }),
    });

    expect(response.status).toBe(500);
    expect(activeLeaseCount()).toBe(0);
    // The single admitted slot is free again, so the next review is admitted.
    expect(canAdmitAgain()).toBe(true);
  });

  it("keeps the admitted reservation once the created session adopts the lease", async () => {
    const { activeLeaseCount, canAdmitAgain, authorizeReviewExecution, issuedLeaseId } =
      installRealLeaseAuthorization();
    const createReviewSession = vi.fn(async () =>
      ok({
        reviewId: REVIEW_A,
        session: {
          reviewId: REVIEW_A,
          mode: "unstaged" as const,
          startedAt: new Date("2026-01-01T00:00:00.000Z"),
          headCommit: "abc123",
          statusHash: "status",
          leaseId: issuedLeaseId(),
        },
      }),
    );
    vi.doMock("../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../shared/lib/ai/admission/service.js")>();
      return { ...actual, authorizeReviewExecution };
    });
    vi.doMock("./service.js", () => ({ createReviewSession }));
    await configureSetup(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: { [PROJECT_ROOT_HEADER]: projectA, "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "unstaged" }),
    });

    expect(response.status).toBe(200);
    expect(activeLeaseCount()).toBe(1);
    expect(canAdmitAgain()).toBe(false);
  });

  it("refuses a second review as a conflict with the running one, not a setup condition", async () => {
    const { authorizeReviewExecution, issuedLeaseId } = installRealLeaseAuthorization();
    const createReviewSession = vi.fn(async () =>
      ok({
        reviewId: REVIEW_A,
        session: {
          reviewId: REVIEW_A,
          mode: "unstaged" as const,
          startedAt: new Date("2026-01-01T00:00:00.000Z"),
          headCommit: "abc123",
          statusHash: "status",
          leaseId: issuedLeaseId(),
        },
      }),
    );
    vi.doMock("../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../shared/lib/ai/admission/service.js")>();
      return { ...actual, authorizeReviewExecution };
    });
    vi.doMock("./service.js", () => ({ createReviewSession }));
    await configureSetup(projectA);
    const app = await createReviewApp();
    const request = () =>
      app.request("/api/review/reviews", {
        method: "POST",
        headers: { [PROJECT_ROOT_HEADER]: projectA, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "unstaged" }),
      });

    expect((await request()).status).toBe(200);
    const second = await request();

    expect(second.status).toBe(409);
    const body = (await second.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe(ErrorCode.REVIEW_IN_PROGRESS);
    // What the client raises from that envelope, and what the surfaces make of
    // it: a running review must never be presented as a credential problem.
    const raised = Object.assign(new Error(body.error.message), {
      status: second.status,
      code: body.error.code,
    });
    expect(isCredentialSetupError(raised)).toBe(false);
    expect(describeReviewStartError(raised)).toEqual({
      title: "Review Already Running",
      message:
        "A review is already running for this configuration. Diffgazer runs one review at a time, so a new one cannot start until the running review finishes or is cancelled.",
      recovery: "open-active-review",
    });
  });

  it("serializes admission failures without dispatching review creation", async () => {
    const createReviewSession = vi.fn();
    vi.doMock("../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../shared/lib/ai/admission/service.js")>();
      return {
        ...actual,
        authorizeReviewExecution: vi.fn(async () =>
          err({
            code: "readiness-not-ready",
            safeMessage: "Configuration is not ready for execution",
            retryable: false,
          }),
        ),
      };
    });
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

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: ErrorCode.SETUP_REQUIRED,
        message: "Configuration is not ready for execution",
      },
    });
    expect(createReviewSession).not.toHaveBeenCalled();
  });

  it("waits for asynchronous authorization before creating a review", async () => {
    const authorization =
      createDeferred<
        Result<Awaited<ReturnType<typeof buildMockAuthorization>>, { safeMessage: string }>
      >();
    const authorizeReviewExecution = vi.fn(() => authorization.promise);
    const session = {
      reviewId: REVIEW_A,
      mode: "unstaged" as const,
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      headCommit: "abc123",
      statusHash: "status",
    };
    const createReviewSession = vi.fn(async () => ok({ reviewId: REVIEW_A, session }));
    vi.doMock("../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../shared/lib/ai/admission/service.js")>();
      return { ...actual, authorizeReviewExecution };
    });
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

    await vi.waitFor(() => expect(authorizeReviewExecution).toHaveBeenCalledOnce());
    expect(createReviewSession).not.toHaveBeenCalled();

    authorization.resolve(ok(await buildMockAuthorization()));
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
      expect(providerWork).toHaveBeenCalledOnce();
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

  it("uses authorizeReviewExecution as the sole review start call", async () => {
    const { authorizeReviewExecution } = installSuccessfulReviewCreationMock();
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

    expect(response.status).toBe(200);
    expect(authorizeReviewExecution).toHaveBeenCalledOnce();
    expect(authorizeReviewExecution).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ loadSnapshot: expect.any(Function) }),
    );
  });

  it("does not dispatch unsupported configurations", async () => {
    const createReviewSession = vi.fn();
    vi.doMock("../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../shared/lib/ai/admission/service.js")>();
      return {
        ...actual,
        authorizeReviewExecution: vi.fn(async () =>
          err({
            code: "configuration-unsupported",
            safeMessage: "Configuration is not supported",
            retryable: false,
          }),
        ),
      };
    });
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

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: ErrorCode.SETUP_REQUIRED },
    });
    expect(createReviewSession).not.toHaveBeenCalled();
  });

  it("serializes safe terminal admission outcomes for budget exhaustion", async () => {
    const createReviewSession = vi.fn();
    vi.doMock("../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../shared/lib/ai/admission/service.js")>();
      return {
        ...actual,
        authorizeReviewExecution: vi.fn(async () =>
          err({
            code: "budget-exhausted",
            safeMessage: "Review budget is exhausted",
            retryable: false,
          }),
        ),
      };
    });
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

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: ErrorCode.RATE_LIMITED,
        message: "Review budget is exhausted",
      },
    });
    expect(createReviewSession).not.toHaveBeenCalled();
  });

  it("maps manual-migration admission failures to the public store error", async () => {
    const createReviewSession = vi.fn();
    vi.doMock("../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../shared/lib/ai/admission/service.js")>();
      return {
        ...actual,
        authorizeReviewExecution: vi.fn(async () =>
          err({
            code: "configuration-migration-required",
            safeMessage: "Legacy configuration requires manual migration",
            retryable: false,
          }),
        ),
      };
    });
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

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "SECRETS_MIGRATION_FAILED",
        message: "Legacy configuration requires manual migration",
      },
    });
    expect(createReviewSession).not.toHaveBeenCalled();
  });
});

async function configureSetup(
  projectRoot: string,
  evidence: "passed" | "failed" | "none" = "passed",
): Promise<void> {
  const { createAdmissionEvidence } = await import("../../shared/lib/config/admission-evidence.js");
  const store = await loadConfigStore();

  const created = await store.runConfigurationAction({
    action: "create",
    input: {
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: GEMINI_ENDPOINT,
      credential: { kind: "literal", value: "test-key-not-real" },
    },
  });
  if (!created.ok) throw new Error(created.error.message);
  const configurationId = created.value.configuration?.configurationId;
  if (!configurationId) throw new Error("create response requires a configuration");

  await store.runConfigurationAction({
    action: "select",
    configurationId,
    modelId: "gemini-2.0-flash",
  });
  await store.runConfigurationAction({
    action: "update",
    configurationId,
    expectedRevision: 1,
    input: { transportFamily: "hosted-api", productId: "gemini", endpoint: GEMINI_ENDPOINT },
    acknowledgement: {
      status: "accepted",
      noticeId: "gemini-hosted-api",
      noticeVersion: 1,
      acceptedAt: SETUP_OBSERVED_AT,
    },
  });
  if (evidence !== "none") {
    await store.recordConfigurationEvidence(
      configurationId,
      createAdmissionEvidence({
        evidenceKey: routerEvidenceKeyFor(configurationId, "gemini-2.0-flash"),
        checkedAt: SETUP_OBSERVED_AT,
        status: evidence,
        expiresAt: null,
      }),
    );
  }

  await trustProject(projectRoot);
}

async function writeBlockedV1ReviewState(recovery: "valid" | "corrupt"): Promise<void> {
  const configPath = join(tempHome, "config.json");
  const secretsPath = join(tempHome, "secrets.json");
  const priorConfig = await readFile(configPath);
  const priorSecrets = await readFile(secretsPath);
  await writeFile(
    configPath,
    `${JSON.stringify({
      settings: { secretsStorage: "file" },
      providers: [
        {
          provider: "gemini",
          [LEGACY_V1_HAS_API_KEY_PROPERTY]: false,
          isActive: true,
          model: "gemini-2.5-flash",
        },
      ],
    })}\n`,
    { mode: 0o600 },
  );
  await writeFile(secretsPath, '{"providers":{"gemini":"review-secret-sentinel"}}\n', {
    mode: 0o600,
  });
  await writeFile(
    `${secretsPath}.recovery`,
    recovery === "valid"
      ? `${JSON.stringify({
          version: 2,
          previousConfig: { existed: true, base64: priorConfig.toString("base64") },
          previousSecrets: { existed: true, base64: priorSecrets.toString("base64") },
        })}\n`
      : "corrupt-review-recovery-sentinel",
    { mode: 0o600 },
  );
}

function routerStructuredOutputSchemaSha256(): string {
  return sha256CanonicalJsonSync(buildLensReviewResultJsonSchema());
}

function routerEvidenceKeyFor(configurationId: string, modelId: string): EvidenceKey {
  const home = process.env.DIFFGAZER_HOME;
  if (!home) throw new Error("DIFFGAZER_HOME is required for review router evidence");
  return {
    authentication: null,
    credentialReferenceIdentity: sha256CanonicalJsonSync({
      kind: "file-0600",
      filePath: join(home, "credentials", `${configurationId}-1.key`),
    }),
    installationId: null,
    productId: "gemini",
    transportFamily: "hosted-api",
    normalizedEndpoint: GEMINI_ENDPOINT,
    region: null,
    workspaceAccountReference: null,
    modelId,
    runtime: { identity: "diffgazer-server", version: "1.0.0" },
    structuredOutputSchemaSha256: routerStructuredOutputSchemaSha256(),
    noticeVersion: 1,
    limits: executionLimitsFromBudget(DEFAULT_CONFIGURATION_BUDGET),
  };
}

describe("POST /api/review/reviews validation", () => {
  it.each([
    {
      label: "profile only",
      body: { mode: "unstaged", profile: "strict" },
      expected: { profile: "strict", lenses: undefined },
    },
    {
      label: "lenses only",
      body: { mode: "unstaged", lenses: ["tests", "security", "tests"] },
      expected: { profile: undefined, lenses: ["tests", "security"] },
    },
    {
      label: "profile and lenses",
      body: { mode: "unstaged", profile: "perf", lenses: ["performance", "correctness"] },
      expected: { profile: "perf", lenses: ["performance", "correctness"] },
    },
  ])("forwards valid optional review selection for $label", async ({ body, expected }) => {
    const { createReviewSession } = installSuccessfulReviewCreationMock();
    await configureSetup(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(200);
    expect(createReviewSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining(expected),
    );
  });

  it.each([
    { profile: "unknown-profile" },
    { profile: null },
    { lenses: ["correctness", "unknown-lens"] },
    { lenses: [null] },
  ])("rejects invalid optional review selection %j before authorization", async (body) => {
    const { authorizeReviewExecution, createReviewSession } = installSuccessfulReviewCreationMock();
    await configureSetup(projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "unstaged", ...body }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: ErrorCode.VALIDATION_ERROR },
    });
    expect(authorizeReviewExecution).not.toHaveBeenCalled();
    expect(createReviewSession).not.toHaveBeenCalled();
  });

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
    const { createReviewSession } = installSuccessfulReviewCreationMock();
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
    const { createReviewSession } = installSuccessfulReviewCreationMock();
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
        // Setup writes trust through a real `.diffgazer`; relocating that state
        // behind a symlink afterwards leaves a trusted project whose context
        // now resolves outside the checkout.
        await configureSetup(projectA);
        const contextDir = join(projectA, ".diffgazer");
        await rm(outsideRoot, { recursive: true, force: true });
        await rename(contextDir, outsideRoot);
        await symlink(outsideRoot, contextDir);
        await writeContextSnapshot(outsideRoot, projectA, "SECRET_EXTERNAL_CONTEXT_MARKER");
        const app = await createReviewApp();

        const response = await app.request("/api/review/context", requestOptions(projectA));
        const text = await response.text();

        // The symlinked state directory fails project resolution outright, so the
        // request is refused before any context artifact is read.
        expect(response.status).toBe(403);
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

  it("returns 429 with Retry-After once the forced-refresh budget is spent", async () => {
    const { resetRateLimitsForTests } = await import("../../shared/middlewares/rate-limit.js");
    resetRateLimitsForTests();
    await configureSetup(projectA);
    installGitServiceMock();
    const app = await createReviewApp();

    const refresh = () =>
      app.request("/api/review/context/refresh", {
        method: "POST",
        headers: {
          [PROJECT_ROOT_HEADER]: projectA,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force: true }),
      });

    let response = await refresh();
    for (let i = 0; i < 5; i++) {
      response = await refresh();
    }

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
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
