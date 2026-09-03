import { PROJECT_ROOT_HEADER, SHUTDOWN_TOKEN_HEADER } from "@diffgazer/core/api/protocol";
import type { Result } from "@diffgazer/core/result";
import { err, ok } from "@diffgazer/core/result";
import { describeReviewStartError, isCredentialSetupError } from "@diffgazer/core/review";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import {
  CreateReviewResponseSchema,
  type EvidenceKey,
  MAX_REVIEW_FILES,
  ReviewErrorCode,
} from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { STRUCTURED_OUTPUT_FAILURE_GUIDANCE } from "../../../shared/lib/ai/admission/service.js";
import type { InitializedAIClient } from "../../../shared/lib/ai/client/initialize.js";
import type { StatusHashResult } from "../../../shared/lib/git/service.js";
import {
  CREATE_REVIEW_BODY_LIMIT_KB,
  DEFAULT_BODY_LIMIT_KB,
} from "../../../shared/middlewares/body-limit.js";
import { MAX_REVIEW_PATH_LENGTH } from "../schemas.js";
import {
  buildMockAuthorization,
  configureSetup,
  createReviewApp,
  installGitServiceMock,
  installProviderWorkProbe,
  installSuccessfulReviewCreationMock,
  loadConfigStore,
  MOCK_CONFIGURATION_ID,
  MOCK_EXECUTION_FINGERPRINT,
  REVIEW_A,
  REVIEW_B,
  ROUTE_BOUNDARY_TIMEOUT_MS,
  ROUTER_REVIEW_DIFF,
  requestOptions,
  SETTINGS_TOKEN,
  setupReviewRouterHarness,
  trustProject,
} from "../testing/router-harness.js";

const harness = setupReviewRouterHarness();

// Mounted here rather than in the shared harness: the settings router is a
// sibling feature, and only a test file may reach across that boundary.
async function createReviewSettingsApp(): Promise<Hono> {
  const [{ reviewRouter }, { settingsRouter }] = await Promise.all([
    import("../router.js"),
    import("../../settings/router.js"),
  ]);
  await (await loadConfigStore()).ready();
  return new Hono().route("/api/review", reviewRouter).route("/api/settings", settingsRouter);
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
  vi.doMock("../../../shared/lib/git/service.js", () => ({
    createGitService: () => gitService,
  }));
  return { gitService, headCommit };
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
    typeof import("../../../shared/lib/ai/admission/lease-registry.js").ExecutionLeaseRegistry
  > | null = null;
  let limits: EvidenceKey["limits"] | null = null;
  let issuedLeaseId: string | null = null;

  const authorizeReviewExecution = vi.fn(async () => {
    const { ExecutionLeaseRegistry } = await import(
      "../../../shared/lib/ai/admission/lease-registry.js"
    );
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
    vi.doMock("../service.js", () => ({ createReviewSession }));
    await configureSetup(harness.projectA, "none");
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
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
    vi.doMock("../service.js", () => ({ createReviewSession }));
    await configureSetup(harness.projectA, "failed");
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
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
    vi.doMock("../../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../../shared/lib/ai/admission/service.js")>();
      return {
        ...actual,
        authorizeReviewExecution: vi.fn(async () => ok(await buildMockAuthorization())),
      };
    });
    vi.doMock("../service.js", () => ({
      createReviewSession: vi.fn(async () =>
        ok({ reviewId: REVIEW_A, session, outcome: "no-diff" }),
      ),
    }));
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
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
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(CreateReviewResponseSchema.parse(body)).toEqual(expected);
  });

  it("releases the admitted reservation when session creation fails before a session exists", async () => {
    const { activeLeaseCount, canAdmitAgain, authorizeReviewExecution } =
      installRealLeaseAuthorization();
    const createReviewSession = vi.fn(async () =>
      err({ code: ReviewErrorCode.GENERATION_FAILED, message: "Failed to inspect repository" }),
    );
    vi.doMock("../../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../../shared/lib/ai/admission/service.js")>();
      return { ...actual, authorizeReviewExecution };
    });
    vi.doMock("../service.js", () => ({ createReviewSession }));
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: { [PROJECT_ROOT_HEADER]: harness.projectA, "Content-Type": "application/json" },
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
    vi.doMock("../../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../../shared/lib/ai/admission/service.js")>();
      return { ...actual, authorizeReviewExecution };
    });
    vi.doMock("../service.js", () => ({ createReviewSession }));
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: { [PROJECT_ROOT_HEADER]: harness.projectA, "Content-Type": "application/json" },
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
    vi.doMock("../../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../../shared/lib/ai/admission/service.js")>();
      return { ...actual, authorizeReviewExecution };
    });
    vi.doMock("../service.js", () => ({ createReviewSession }));
    await configureSetup(harness.projectA);
    const app = await createReviewApp();
    const request = () =>
      app.request("/api/review/reviews", {
        method: "POST",
        headers: { [PROJECT_ROOT_HEADER]: harness.projectA, "Content-Type": "application/json" },
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
    vi.doMock("../../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../../shared/lib/ai/admission/service.js")>();
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
    vi.doMock("../service.js", () => ({ createReviewSession }));
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
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
    vi.doMock("../../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../../shared/lib/ai/admission/service.js")>();
      return { ...actual, authorizeReviewExecution };
    });
    vi.doMock("../service.js", () => ({ createReviewSession }));
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const responsePromise = app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
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
      await configureSetup(harness.projectA);
      const providerWork = installProviderWorkProbe();
      const { gitService, headCommit } = installDeferredGitServiceMock();
      const app = await createReviewSettingsApp();

      const reviewRequest = app.request("/api/review/reviews", {
        method: "POST",
        headers: {
          [PROJECT_ROOT_HEADER]: harness.projectA,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "unstaged" }),
      });
      await vi.waitFor(() => expect(gitService.getHeadCommit).toHaveBeenCalledOnce());

      const trustResponse = await app.request("/api/settings/trust", {
        method: revocation === "delete" ? "DELETE" : "POST",
        headers: {
          [PROJECT_ROOT_HEADER]: harness.projectA,
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
    await trustProject(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      ...requestOptions(harness.projectA),
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "unstaged" }),
    });

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("SETUP_REQUIRED");
  });

  it("returns 429 with Retry-After when the route-level creation limit is exceeded", async () => {
    const app = await createReviewApp();

    let response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "unstaged" }),
    });

    for (let i = 0; i < 10; i++) {
      response = await app.request("/api/review/reviews", {
        method: "POST",
        headers: {
          [PROJECT_ROOT_HEADER]: harness.projectA,
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
          [PROJECT_ROOT_HEADER]: harness.projectA,
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
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
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
    vi.doMock("../../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../../shared/lib/ai/admission/service.js")>();
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
    vi.doMock("../service.js", () => ({ createReviewSession }));
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
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
    vi.doMock("../../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../../shared/lib/ai/admission/service.js")>();
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
    vi.doMock("../service.js", () => ({ createReviewSession }));
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
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
    vi.doMock("../../../shared/lib/ai/admission/service.js", async (importOriginal) => {
      const actual =
        await importOriginal<typeof import("../../../shared/lib/ai/admission/service.js")>();
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
    vi.doMock("../service.js", () => ({ createReviewSession }));
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
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
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
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
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
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
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "garbage" }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a non-array files field", async () => {
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
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
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
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
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
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
  it("rejects a files array one entry past the cap", async () => {
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "files",
        files: Array.from({ length: MAX_REVIEW_FILES + 1 }, (_, i) => `file-${i}.ts`),
      }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a file path one character past the cap", async () => {
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "files",
        files: ["a".repeat(MAX_REVIEW_PATH_LENGTH + 1)],
      }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    {
      name: "accepts files arrays within limits",
      files: ["src/index.ts", "src/app.tsx"],
      // The route hands the session canonical, sorted paths.
      canonicalFiles: ["src/app.tsx", "src/index.ts"],
    },
    {
      name: "accepts embedded dots inside a relative file path segment",
      files: ["src/foo..bar.ts"],
      canonicalFiles: ["src/foo..bar.ts"],
    },
  ])("$name", async ({ files, canonicalFiles }) => {
    const { createReviewSession } = installSuccessfulReviewCreationMock();
    await configureSetup(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "files", files }),
    });

    expect(response.status).toBe(200);
    expect(createReviewSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ files: canonicalFiles }),
    );
  });

  it("accepts the schema's worst JSON-escaped files payload under the review cap", async () => {
    const { createReviewSession } = installSuccessfulReviewCreationMock();
    await configureSetup(harness.projectA);
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
        [PROJECT_ROOT_HEADER]: harness.projectA,
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
    await configureSetup(harness.projectA);
    const app = await createReviewApp();
    const capBytes = CREATE_REVIEW_BODY_LIMIT_KB * 1024;
    const exactBody = jsonBodyWithByteLength(capBytes);

    expect(new TextEncoder().encode(exactBody)).toHaveLength(capBytes);

    const exactResponse = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
        "Content-Type": "application/json",
      },
      body: exactBody,
    });
    const overflowResponse = await app.request("/api/review/reviews", {
      method: "POST",
      headers: {
        [PROJECT_ROOT_HEADER]: harness.projectA,
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
    await trustProject(harness.projectA);
    const app = await createReviewApp();

    const response = await app.request(`/api/review/sessions/${REVIEW_A}`, {
      ...requestOptions(harness.projectA),
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cancelled: true, reason: "not-found" });
  });

  it("returns cancelled:true with reason not-found for a session owned by another project", async () => {
    await trustProject(harness.projectA);
    const { createSession } = await import("../stream/store.js");
    createSession(REVIEW_B, {
      projectPath: harness.projectB,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    const app = await createReviewApp();

    const response = await app.request(`/api/review/sessions/${REVIEW_B}`, {
      ...requestOptions(harness.projectA),
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cancelled: true, reason: "not-found" });
  });

  it("returns cancelled:true with reason already-complete for a terminal session", async () => {
    await trustProject(harness.projectA);
    const { createSession, markComplete } = await import("../stream/store.js");
    createSession(REVIEW_A, {
      projectPath: harness.projectA,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    markComplete(REVIEW_A);
    const app = await createReviewApp();

    const response = await app.request(`/api/review/sessions/${REVIEW_A}`, {
      ...requestOptions(harness.projectA),
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cancelled: true, reason: "already-complete" });
  });

  it("reports an in-progress commit without publishing CANCELLED", async () => {
    await trustProject(harness.projectA);
    const received: FullReviewStreamEvent[] = [];
    const { createSession, markCommitting, subscribe } = await import("../stream/store.js");
    createSession(REVIEW_A, {
      projectPath: harness.projectA,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    subscribe(REVIEW_A, (event) => received.push(event));
    expect(markCommitting(REVIEW_A)).toBe(true);
    const app = await createReviewApp();

    const response = await app.request(`/api/review/sessions/${REVIEW_A}`, {
      ...requestOptions(harness.projectA),
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
    await trustProject(harness.projectA);
    const received: FullReviewStreamEvent[] = [];
    const { createSession, markReady, subscribe } = await import("../stream/store.js");
    createSession(REVIEW_A, {
      projectPath: harness.projectA,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full" as const,
      mode: "unstaged",
    });
    markReady(REVIEW_A);
    subscribe(REVIEW_A, (event) => received.push(event));
    const app = await createReviewApp();

    const response = await app.request(`/api/review/sessions/${REVIEW_A}`, {
      ...requestOptions(harness.projectA),
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cancelled: true, reason: "cancelled" });
    expect(received).toMatchObject([{ type: "error", error: { code: ReviewErrorCode.CANCELLED } }]);
  });

  it("answers cancelled only after the partial write the cancel started has landed", async () => {
    await trustProject(harness.projectA);
    const received: FullReviewStreamEvent[] = [];
    let persisted = false;
    const { createSession, markReady, subscribe } = await import("../stream/store.js");
    createSession(REVIEW_A, {
      projectPath: harness.projectA,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full" as const,
      mode: "unstaged",
      persistPartial: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        persisted = true;
      },
    });
    markReady(REVIEW_A);
    subscribe(REVIEW_A, (event) => received.push(event));
    const app = await createReviewApp();

    const response = await app.request(`/api/review/sessions/${REVIEW_A}`, {
      ...requestOptions(harness.projectA),
      method: "DELETE",
    });

    expect(persisted).toBe(true);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cancelled: true, reason: "cancelled" });
    expect(received).toMatchObject([{ type: "error", error: { code: ReviewErrorCode.CANCELLED } }]);
  });
});

describe("GET /api/review/reviews/:id/stream", () => {
  it("returns 404 for an unknown review stream id", async () => {
    await trustProject(harness.projectA);
    installGitServiceMock();
    const app = await createReviewApp();

    const response = await app.request(
      `/api/review/reviews/${REVIEW_A}/stream`,
      requestOptions(harness.projectA),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("SESSION_NOT_FOUND");
  });

  it("returns 404 when a session belongs to another project", async () => {
    await trustProject(harness.projectA);
    installGitServiceMock();
    const { createSession, markReady } = await import("../stream/store.js");
    createSession(REVIEW_B, {
      projectPath: harness.projectB,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_B);
    const app = await createReviewApp();

    const response = await app.request(
      `/api/review/reviews/${REVIEW_B}/stream`,
      requestOptions(harness.projectA),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("SESSION_NOT_FOUND");
  });

  it("keeps a drifted live session running and attaches to it", async () => {
    await trustProject(harness.projectA);
    const gitService = installGitServiceMock();
    gitService.getStatusHash.mockResolvedValue({ kind: "full", hash: "changed" });
    const { createSession, getSession, markReady } = await import("../stream/store.js");
    const session = createSession(REVIEW_A, {
      projectPath: harness.projectA,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_A);
    const app = await createReviewApp();

    const response = await app.request(
      `/api/review/reviews/${REVIEW_A}/stream`,
      requestOptions(harness.projectA),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(getSession(REVIEW_A)?.isComplete).toBe(false);
    expect(session.controller.signal.aborted).toBe(false);

    // Drift still gates dedupe: the changed worktree is no longer this
    // session's identity, so a new review must not be folded onto it.
    const activeResponse = await app.request(
      "/api/review/sessions/active",
      requestOptions(harness.projectA),
    );
    await expect(activeResponse.json()).resolves.toEqual({ session: null });
  });

  it("replays stored SSE events for a fresh session", async () => {
    await trustProject(harness.projectA);
    installGitServiceMock();
    const { addEvent, createSession, markReady } = await import("../stream/store.js");
    createSession(REVIEW_A, {
      projectPath: harness.projectA,
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
      requestOptions(harness.projectA),
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
    await trustProject(harness.projectA);
    const gitService = installGitServiceMock();
    const app = await createReviewApp();

    const [unstagedResponse, stagedResponse] = await Promise.all([
      app.request("/api/review/sessions/active?mode=unstaged", requestOptions(harness.projectA)),
      app.request("/api/review/sessions/active?mode=staged", requestOptions(harness.projectA)),
    ]);

    expect(unstagedResponse.status).toBe(200);
    expect(stagedResponse.status).toBe(200);
    await expect(unstagedResponse.json()).resolves.toEqual({ session: null });
    await expect(stagedResponse.json()).resolves.toEqual({ session: null });
    expect(gitService.getHeadCommit).not.toHaveBeenCalled();
    expect(gitService.getStatusHash).not.toHaveBeenCalled();
  });

  it("returns 500 when repository state cannot be inspected", async () => {
    await trustProject(harness.projectA);
    const gitService = installGitServiceMock();
    gitService.getHeadCommit.mockResolvedValue(err({ message: "git failed" }));
    const { createSession, markReady } = await import("../stream/store.js");
    createSession(REVIEW_A, {
      projectPath: harness.projectA,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_A);
    const app = await createReviewApp();

    const response = await app.request(
      "/api/review/sessions/active",
      requestOptions(harness.projectA),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("returns the current project's active session and not another project's", async () => {
    await trustProject(harness.projectA);
    const gitService = installGitServiceMock();
    const { createSession, markReady } = await import("../stream/store.js");
    createSession(REVIEW_B, {
      projectPath: harness.projectB,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_B);
    createSession(REVIEW_A, {
      projectPath: harness.projectA,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_A);
    const app = await createReviewApp();

    const response = await app.request(
      "/api/review/sessions/active",
      requestOptions(harness.projectA),
    );
    const body = (await response.json()) as { session: { reviewId: string } | null };

    expect(response.status).toBe(200);
    expect(body.session?.reviewId).toBe(REVIEW_A);
    expect(gitService.getHeadCommit).toHaveBeenCalledOnce();
    expect(gitService.getStatusHash).toHaveBeenCalledOnce();
  });

  it("returns null for a stale candidate without cancelling it", async () => {
    await trustProject(harness.projectA);
    const gitService = installGitServiceMock();
    gitService.getStatusHash.mockResolvedValue({ kind: "full", hash: "changed" });
    const { createSession, getSession, markReady } = await import("../stream/store.js");
    const candidate = createSession(REVIEW_A, {
      projectPath: harness.projectA,
      headCommit: "abc123",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
    });
    markReady(REVIEW_A);
    const app = await createReviewApp();

    const response = await app.request(
      "/api/review/sessions/active",
      requestOptions(harness.projectA),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ session: null });
    expect(gitService.getHeadCommit).toHaveBeenCalledOnce();
    expect(gitService.getStatusHash).toHaveBeenCalledOnce();
    expect(getSession(REVIEW_A)).toBe(candidate);
    expect(candidate.isComplete).toBe(false);
    expect(candidate.controller.signal.aborted).toBe(false);
  });
});
