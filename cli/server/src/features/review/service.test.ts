import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { err, ok } from "@diffgazer/core/result";
import {
  type HostedApiProductId,
  LEGACY_V1_HAS_API_KEY_PROPERTY,
} from "@diffgazer/core/schemas/config";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import type { ExecutionLimits, ReviewMode, ReviewResult } from "@diffgazer/core/schemas/review";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { requireValue } from "@diffgazer/core/testing/assertions";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { ExecutionLeaseRegistry } from "../../shared/lib/ai/admission/lease-registry.js";
import type { AdmittedExecutionPlan } from "../../shared/lib/ai/admission/service.js";
import { createBudgetLedger } from "../../shared/lib/ai/budget/ledger.js";
import { buildExecutionResult } from "../../shared/lib/ai/client/generate.js";
import type { InitializedAIClient } from "../../shared/lib/ai/client/initialize.js";
import { MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE } from "../../shared/lib/ai/diagnostics.js";
import { promptAttemptEstimate } from "../../shared/lib/ai/providers/execution-receipt.js";
import type { Adapter } from "../../shared/lib/ai/types.js";
import { hashAdmissionEvidenceKeySync } from "../../shared/lib/config/admission-evidence.js";
import type { createGitService as createGitServiceType } from "../../shared/lib/git/service.js";
import { assertTempHome } from "../../shared/lib/testing/temp-home.js";
import { parseDiff } from "./engine/diff/parser.js";
import type { SSEWriter } from "./stream/sse.js";
import { drainReviewWrites } from "./testing/storage-drain.js";

// Boundary mock: git/service wraps the `git` CLI subprocess (external-process boundary); tests provide canned status/diff responses so review session lifecycle can be exercised without a real repository.
vi.mock("../../shared/lib/git/service.js", () => ({
  createGitService: vi.fn(),
}));

type GitService = ReturnType<typeof createGitServiceType>;
type ServiceModule = typeof import("./service.js");
type ConformanceEvidenceModule = typeof import("./conformance-evidence.js");
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
/** The provider/model pair these tests vary to build distinct admitted plans. */
interface ExecutionFingerprint {
  readonly provider: HostedApiProductId;
  readonly model: string;
}

const DEFAULT_EXECUTION_FINGERPRINT: ExecutionFingerprint = {
  provider: "openrouter",
  model: "openai/gpt-4.1",
};
const SERVICE_LIMITS: ExecutionLimits = Object.freeze({
  maxInputTokens: 40_000,
  maxResponseBytes: 8_000_000,
  wallTimeMs: 300_000,
  maxRetries: 1,
  maxConcurrency: 2,
  maxCostUsd: 5,
});
const DEFAULT_REVIEW_RESULT: ReviewResult = {
  issues: [makeIssue({ title: "Subtraction used in addition helper", file: "file-1" })],
};

let createReviewSession: ServiceModule["createReviewSession"];
let buildReviewInputHash: ServiceModule["buildReviewInputHash"];
let recordPassedConformanceEvidence: ConformanceEvidenceModule["recordPassedConformanceEvidence"];
let streamActiveSessionToSSE: SseReplayModule["streamActiveSessionToSSE"];
let cancelSessionForUser: SessionsModule["cancelSessionForUser"];
let createSession: SessionsModule["createSession"];
let deleteSessionForTests: SessionsModule["deleteSessionForTests"];
let getSession: SessionsModule["getSession"];
let getActiveSessionForProject: SessionsModule["getActiveSessionForProject"];
let buildReviewConfigKey: SessionsModule["buildReviewConfigKey"];
let buildScopeKey: SessionsModule["buildScopeKey"];
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
    deleteSessionForTests(id);
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
    diffError?: string;
    headCommit?: string;
    headCommitError?: string;
    statusHash?: string;
  } = {},
): GitService {
  const {
    diff = REVIEW_DIFF,
    diffError,
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
    getDiff: async () => (diffError ? err({ message: diffError }) : ok(diff)),
    isGitInstalled: async () => true,
    getHeadCommit: async () =>
      headCommitError ? err({ message: headCommitError }) : ok(headCommit),
    getStatusHash: async () => ({ kind: "full" as const, hash: statusHash }),
  };
}

function serviceAdmittedPlan(
  executionFingerprint: ExecutionFingerprint = DEFAULT_EXECUTION_FINGERPRINT,
): AdmittedExecutionPlan {
  const productId = executionFingerprint.provider;
  const product = PRODUCT_REGISTRY[productId];
  if (product.kind !== "runnable") {
    throw new Error(`Test admitted plan requires a runnable product: ${productId}`);
  }
  const endpoint = product.configuration.endpoints[0]?.endpoint ?? "https://openrouter.ai/api/v1";
  return Object.freeze({
    configurationId: "openrouter-primary",
    configurationRevision: 2,
    executionFingerprint: `admitted-${executionFingerprint.provider}-${executionFingerprint.model}`,
    evidenceKey: Object.freeze({
      authentication: null,
      credentialReferenceIdentity: "d".repeat(64),
      installationId: null,
      productId,
      transportFamily: product.transportFamily,
      normalizedEndpoint: endpoint,
      region: null,
      workspaceAccountReference: null,
      modelId: executionFingerprint.model,
      runtime: { identity: "diffgazer-server", version: "1.0.0" },
      structuredOutputSchemaSha256: "e".repeat(64),
      noticeVersion: product.notice.noticeVersion,
      limits: SERVICE_LIMITS,
    }),
    productId,
    transportFamily: product.transportFamily,
    limits: SERVICE_LIMITS,
  });
}

function serviceReviewConfigKey(
  executionFingerprint: ExecutionFingerprint = DEFAULT_EXECUTION_FINGERPRINT,
  lenses: string[] = ["correctness"],
  minSeverity = "low",
) {
  const plan = serviceAdmittedPlan(executionFingerprint);
  return buildReviewConfigKey({
    lenses,
    minSeverity,
    admittedExecutionFingerprint: plan.executionFingerprint,
    configurationId: plan.configurationId,
    configurationRevision: plan.configurationRevision,
  });
}

interface DispatchIdentity {
  executionFingerprint: string;
  modelId: string;
}

function makeAIClient(
  result: ReviewResult = DEFAULT_REVIEW_RESULT,
  executionFingerprint: ExecutionFingerprint = DEFAULT_EXECUTION_FINGERPRINT,
  dispatchLog?: DispatchIdentity[],
): InitializedAIClient {
  const plan = serviceAdmittedPlan(executionFingerprint);
  const ledger = createBudgetLedger(plan.limits);
  const estimate = promptAttemptEstimate(
    { prompt: "review prompt", systemPrompt: "review system prompt" },
    plan.limits,
  );
  const budgetReservation = ledger.reserveAttempt(estimate);
  if (!budgetReservation.ok) {
    throw new Error("budget reservation failed in test setup");
  }
  const leaseRegistry = new ExecutionLeaseRegistry();
  const lease = leaseRegistry.tryAcquire({
    configurationId: plan.configurationId,
    configurationRevision: plan.configurationRevision,
    executionFingerprint: plan.executionFingerprint,
    limits: plan.limits,
  });
  if (!lease.ok) {
    throw new Error("lease acquisition failed in test setup");
  }
  const release = vi.fn(() => {
    ledger.releaseReservation(budgetReservation.value);
    lease.value.release();
  });
  const generate: InitializedAIClient["generate"] = async <T extends z.ZodType>(
    _prompt: string,
    schema: T,
    _options?: { signal?: AbortSignal },
  ) => {
    dispatchLog?.push({
      executionFingerprint: plan.executionFingerprint,
      modelId: plan.evidenceKey.modelId,
    });
    return ok(schema.parse(result));
  };

  return {
    provider: executionFingerprint.provider,
    authorization: Object.freeze({
      plan,
      adapter: {
        productId: plan.productId,
        transportFamily: plan.transportFamily,
        execute: vi.fn(),
      } satisfies Adapter,
      evidenceState: "proven" as const,
      budgetLedger: ledger,
      budgetReservation: budgetReservation.value,
      lease: lease.value,
      resolveCredential: async () => "service-secret",
      workspaceAccountId: null,
      release,
    }),
    terminalExecutions: [],
    terminalDiagnostics: [],
    generate,
  };
}

/** A client whose only lens ends the review by exhausting the per-review budget. */
function makeBudgetExhaustedAIClient(): InitializedAIClient {
  const base = makeAIClient();
  const authorization = requireValue(base.authorization, "test client authorization");
  const diagnostic = {
    code: "budget-exhausted",
    safeMessage: "Review budget exhausted at maxInputTokens (40000).",
    retryable: false,
    remediation: "Reduce review scope or increase configured limits.",
    correlationId: "budget-correlation",
  };
  return {
    ...base,
    terminalExecutions: [
      buildExecutionResult(authorization.plan, "budget-exhausted", {
        startedAt: "2026-07-31T10:00:00.000Z",
        finishedAt: "2026-07-31T10:00:01.000Z",
      }),
    ],
    terminalDiagnostics: [diagnostic],
    generate: async () =>
      err({ code: "STREAM_ERROR", message: diagnostic.safeMessage, diagnostic }),
  };
}

function makeConformanceAIClient(options: {
  evidenceState: "proven" | "unproven";
  /**
   * The single lens fails structured output with this decisive adapter
   * diagnostic. Only the diagnostic code says whether the corrective re-ask ran
   * and failed; `attemptCount` counts blind retries too, so it proves nothing.
   */
  structuredOutputFailure?: {
    diagnosticCode: string;
    attemptCount: number;
    outcome?: "schema-failed" | "transport-failed";
  };
}): InitializedAIClient {
  const base = makeAIClient();
  const authorization = requireValue(base.authorization, "test client authorization");
  const withEvidenceState = {
    ...base,
    authorization: Object.freeze({ ...authorization, evidenceState: options.evidenceState }),
  };
  const failure = options.structuredOutputFailure;
  if (!failure) return withEvidenceState;
  const diagnostic = {
    code: failure.diagnosticCode,
    safeMessage: "The model's answer failed review schema validation.",
    retryable: false,
    remediation: "none",
    correlationId: "conformance-correlation",
  };
  return {
    ...withEvidenceState,
    terminalExecutions: [
      buildExecutionResult(authorization.plan, failure.outcome ?? "schema-failed", {
        startedAt: "2026-07-31T10:00:00.000Z",
        finishedAt: "2026-07-31T10:00:01.000Z",
        attemptCount: failure.attemptCount,
      }),
    ],
    terminalDiagnostics: [diagnostic],
    generate: async () =>
      err({ code: "STREAM_ERROR", message: diagnostic.safeMessage, diagnostic }),
  };
}

beforeAll(async () => {
  originalDiffgazerHome = process.env.DIFFGAZER_HOME;
  tempHome = mkdtempSync(join(tmpdir(), "diffgazer-review-service-home-"));
  assertTempHome(tempHome);
  process.env.DIFFGAZER_HOME = tempHome;
  writeFileSync(
    join(tempHome, "config.json"),
    JSON.stringify({
      schemaVersion: 2,
      settings: { defaultLenses: ["correctness"], agentExecution: "sequential" },
      selectedConfigurationId: null,
      configurations: [],
    }),
  );

  const service = await import("./service.js");
  const conformanceEvidence = await import("./conformance-evidence.js");
  const sseReplay = await import("./stream/replay.js");
  const sessions = await import("./stream/store.js");
  const git = await import("../../shared/lib/git/service.js");
  createReviewSession = service.createReviewSession;
  buildReviewInputHash = service.buildReviewInputHash;
  recordPassedConformanceEvidence = conformanceEvidence.recordPassedConformanceEvidence;
  streamActiveSessionToSSE = sseReplay.streamActiveSessionToSSE;
  cancelSessionForUser = sessions.cancelSessionForUser;
  createSession = sessions.createSession;
  deleteSessionForTests = sessions.deleteSessionForTests;
  getSession = sessions.getSession;
  getActiveSessionForProject = sessions.getActiveSessionForProject;
  buildReviewConfigKey = sessions.buildReviewConfigKey;
  buildScopeKey = sessions.buildScopeKey;
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

// Settle the config store and the fire-and-forget review migration writes, then remove the
// temp home, and only then restore DIFFGAZER_HOME: `paths.ts` re-reads the variable per
// call, so restoring it while a document-lock acquisition or a review write is still
// pending re-points that work at the real ~/.diffgazer.
afterAll(async () => {
  try {
    const { getStore } = await import("../../shared/lib/config/store.js");
    await getStore().ready();
    await drainReviewWrites(tempHome);
    rmSync(tempHome, { recursive: true, force: true });
  } finally {
    if (originalDiffgazerHome === undefined) {
      delete process.env.DIFFGAZER_HOME;
    } else {
      process.env.DIFFGAZER_HOME = originalDiffgazerHome;
    }
  }
});

describe("createReviewSession", () => {
  it("rejects a cached-ready V1 replacement before git or review work", async () => {
    const { getStore } = await import("../../shared/lib/config/store.js");
    const store = getStore();
    await expect(store.ready()).resolves.toEqual({ ok: true, value: undefined });
    const gitService = makeGitService();
    const headCommit = vi.spyOn(gitService, "getHeadCommit");
    const statusHash = vi.spyOn(gitService, "getStatusHash");
    vi.mocked(createGitService).mockReturnValue(gitService);
    const configPath = join(tempHome, "config.json");
    const v2Bytes = Buffer.from(
      `${JSON.stringify({
        schemaVersion: 2,
        settings: { defaultLenses: ["correctness"], agentExecution: "sequential" },
        selectedConfigurationId: null,
        configurations: [],
      })}\n`,
    );
    writeFileSync(
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
    writeFileSync(join(tempHome, "secrets.json"), '{"providers":{"gemini":"hidden"}}\n', {
      mode: 0o600,
    });
    writeFileSync(
      join(tempHome, "secrets.json.recovery"),
      `${JSON.stringify({
        version: 2,
        previousConfig: { existed: true, base64: v2Bytes.toString("base64") },
        previousSecrets: { existed: false, base64: null },
      })}\n`,
      { mode: 0o600 },
    );
    const aiClient = makeAIClient();
    const generate = vi.spyOn(aiClient, "generate");

    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "SECRETS_MIGRATION_FAILED",
        message: "Legacy configuration requires manual migration",
      },
    });
    expect(createGitService).not.toHaveBeenCalled();
    expect(headCommit).not.toHaveBeenCalled();
    expect(statusHash).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();

    writeFileSync(configPath, v2Bytes, { mode: 0o600 });
    rmSync(join(tempHome, "secrets.json"), { force: true });
    rmSync(join(tempHome, "secrets.json.recovery"), { force: true });
    await expect(store.ready()).resolves.toEqual({ ok: true, value: undefined });
  });

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
    expect(result.value.outcome).toBe("running");
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

  it("reports the no-diff outcome on a clean tree while still buffering the stream failure", async () => {
    vi.mocked(createGitService).mockReturnValue(makeGitService({ diff: "" }));

    const result = await createReviewSession(makeAIClient(), {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSession(result.value.reviewId);
    expect(result.value.outcome).toBe("no-diff");

    // The client that resumes this review must still read the failure from the
    // replayed stream, so the response reports the outcome in addition to the
    // buffered event, never instead of it.
    await vi.waitFor(() => {
      const session = requireValue(getSession(result.value.reviewId), "created session");
      expect(session.events).toContainEqual(
        expect.objectContaining({
          type: "error",
          error: expect.objectContaining({ code: ReviewErrorCode.NO_DIFF }),
        }),
      );
    });
  });

  it("reports the failed outcome when git refuses the diff while still buffering the stream failure", async () => {
    vi.mocked(createGitService).mockReturnValue(
      makeGitService({ diffError: "fatal: bad revision" }),
    );

    const result = await createReviewSession(makeAIClient(), {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSession(result.value.reviewId);
    expect(result.value.outcome).toBe("failed");

    await vi.waitFor(() => {
      const session = requireValue(getSession(result.value.reviewId), "created session");
      expect(session.events).toContainEqual(
        expect.objectContaining({
          type: "error",
          error: expect.objectContaining({ code: ReviewErrorCode.GENERATION_FAILED }),
        }),
      );
    });
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
    const reviewConfigKey = serviceReviewConfigKey();
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
      existingFingerprint: { provider: "openrouter" as const, model: "openai/gpt-4.1" },
      nextFingerprint: { provider: "gemini" as const, model: "gemini-2.0-flash" },
    },
    {
      changedSelection: "model",
      existingFingerprint: { provider: "openrouter" as const, model: "openai/gpt-4.1" },
      nextFingerprint: { provider: "openrouter" as const, model: "openai/gpt-4.1-mini" },
    },
  ] satisfies Array<{
    changedSelection: string;
    existingFingerprint: ExecutionFingerprint;
    nextFingerprint: ExecutionFingerprint;
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
      reviewConfigKey: serviceReviewConfigKey(existingFingerprint),
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
    expect(result.value.session.reviewConfigKey).toBe(serviceReviewConfigKey(nextFingerprint));
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

  it("emits step_error('report') before the error event on a terminal abort", async () => {
    const result = await createReviewSession(makeBudgetExhaustedAIClient(), {
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

    const reportErrorIndex = session.events.findIndex(
      (event) => event.type === "step_error" && event.step === "report",
    );
    const errorIndex = session.events.findIndex((event) => event.type === "error");

    expect(reportErrorIndex).toBeGreaterThanOrEqual(0);
    expect(reportErrorIndex).toBeLessThan(errorIndex);
    expect(session.events[errorIndex]).toMatchObject({
      type: "error",
      error: { code: "BUDGET_EXHAUSTED" },
    });
  });

  it("saves the findings a superseding start cancels mid-run", async () => {
    const stalledLens = createDeferred<void>();
    let dispatches = 0;
    const stalling: InitializedAIClient = {
      ...makeAIClient(),
      generate: async <T extends z.ZodType>(_prompt: string, schema: T) => {
        dispatches += 1;
        if (dispatches === 1) return ok(schema.parse(DEFAULT_REVIEW_RESULT));
        await stalledLens.promise;
        return ok(schema.parse({ issues: [] }));
      },
    };

    try {
      const superseded = await createReviewSession(stalling, {
        mode: "unstaged",
        projectPath: projectRoot,
        lenses: ["correctness", "security"],
      });

      expect(superseded.ok).toBe(true);
      if (!superseded.ok) return;
      const supersededId = superseded.value.reviewId;
      trackSessionWithRunner(supersededId);
      const session = requireValue(getSession(supersededId), "superseded session");
      await vi.waitFor(() => {
        if (!session.events.some((event) => event.type === "issue_found")) {
          throw new Error("no issue streamed yet");
        }
      });

      const superseding = await createReviewSession(makeAIClient(), {
        mode: "unstaged",
        projectPath: projectRoot,
        lenses: ["correctness"],
      });

      expect(superseding.ok).toBe(true);
      if (!superseding.ok) return;
      trackSessionWithRunner(superseding.value.reviewId);
      expect(session.isComplete).toBe(true);

      const { getReviewDetail } = await import("./storage/reviews.js");
      const saved = await vi.waitFor(async () => {
        const detail = await getReviewDetail(supersededId);
        if (!detail.ok) throw new Error("partial review not written yet");
        return detail.value.review;
      });

      expect(saved.metadata.terminalOutcome).toBe("cancelled");
      expect(saved.result.issues).toEqual([
        expect.objectContaining({ title: "Subtraction used in addition helper" }),
      ]);
    } finally {
      stalledLens.resolve();
    }
  });

  it("deduplicates and orders the findings it saves for an interrupted run", async () => {
    const stalledLens = createDeferred<void>();
    const sharedFinding = {
      title: "Shared finding",
      file: "file-1",
      line_start: 2,
      line_end: 2,
      category: "correctness" as const,
      severity: "high" as const,
    };
    let dispatches = 0;
    const stalling: InitializedAIClient = {
      ...makeAIClient(),
      generate: async <T extends z.ZodType>(_prompt: string, schema: T) => {
        dispatches += 1;
        if (dispatches === 1) {
          return ok(schema.parse({ issues: [makeIssue({ ...sharedFinding, id: "issue-dup-a" })] }));
        }
        if (dispatches === 2) {
          return ok(
            schema.parse({
              issues: [
                makeIssue({ ...sharedFinding, id: "issue-dup-b" }),
                makeIssue({
                  id: "issue-blocker",
                  severity: "blocker",
                  title: "Blocking finding",
                  file: "file-1",
                  line_start: 3,
                  line_end: 3,
                }),
              ],
            }),
          );
        }
        await stalledLens.promise;
        return ok(schema.parse({ issues: [] }));
      },
    };

    try {
      const superseded = await createReviewSession(stalling, {
        mode: "unstaged",
        projectPath: projectRoot,
        lenses: ["correctness", "security", "performance"],
      });

      expect(superseded.ok).toBe(true);
      if (!superseded.ok) return;
      const supersededId = superseded.value.reviewId;
      trackSessionWithRunner(supersededId);
      const session = requireValue(getSession(supersededId), "superseded session");
      await vi.waitFor(() => {
        const streamed = session.events.filter((event) => event.type === "issue_found");
        if (streamed.length < 3) throw new Error("duplicate findings not streamed yet");
      });

      const superseding = await createReviewSession(makeAIClient(), {
        mode: "unstaged",
        projectPath: projectRoot,
        lenses: ["correctness"],
      });

      expect(superseding.ok).toBe(true);
      if (!superseding.ok) return;
      trackSessionWithRunner(superseding.value.reviewId);

      const { getReviewDetail } = await import("./storage/reviews.js");
      const saved = await vi.waitFor(async () => {
        const detail = await getReviewDetail(supersededId);
        if (!detail.ok) throw new Error("partial review not written yet");
        return detail.value.review;
      });

      expect(saved.result.issues.map((issue) => issue.title)).toEqual([
        "Blocking finding",
        "Shared finding",
      ]);
    } finally {
      stalledLens.resolve();
    }
  });

  it("persists a nonnegative duration when the wall clock moves backward", async () => {
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

      expect(session.events.find((event) => event.type === "complete")).toBeDefined();
      const { getReviewDetail } = await import("./storage/reviews.js");
      const saved = await getReviewDetail(result.value.reviewId);

      expect(saved.ok, saved.ok ? undefined : JSON.stringify(saved.error)).toBe(true);
      if (!saved.ok) return;
      expect(saved.value.review.metadata.durationMs).toBeGreaterThanOrEqual(0);
    } finally {
      dateNow.mockRestore();
    }
  });

  it("keeps the session identity and executed configuration on the creation snapshot", async () => {
    const { getStore } = await import("../../shared/lib/config/store.js");
    const store = getStore();
    const originalSettingsResult = await store.readSettings();
    if (!originalSettingsResult.ok) throw new Error(originalSettingsResult.error.message);
    const originalSettings = originalSettingsResult.value;
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
      expect(result.value.session.reviewConfigKey).toBe(serviceReviewConfigKey());

      const session = requireValue(getSession(result.value.reviewId), "review session");
      await vi.waitFor(() => {
        if (!session.isComplete) throw new Error("session not complete yet");
      });
      expect(session.events.at(-1), JSON.stringify(session.events)).toMatchObject({
        type: "complete",
      });
      const { getReviewDetail } = await import("./storage/reviews.js");
      const saved = await getReviewDetail(result.value.reviewId);

      expect(saved.ok, saved.ok ? undefined : JSON.stringify(saved.error)).toBe(true);
      if (!saved.ok) return;
      expect(saved.value.review.metadata.lenses).toEqual(["correctness"]);
      expect(saved.value.review.metadata.profile).toBeNull();
      expect(saved.value.review.result.issues).toEqual([
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
    const { getReviewDetail } = await import("./storage/reviews.js");
    const saved = await getReviewDetail(result.value.reviewId);

    expect(saved.ok, saved.ok ? undefined : JSON.stringify(saved.error)).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.review.metadata.branch).toBe("snapshot-branch");
    expect(saved.value.review.gitContext).toMatchObject({
      branch: "snapshot-branch",
      commit: "snapshot-head",
    });
    expect(saved.value.review.diff).toBeDefined();
    if (!saved.value.review.diff) return;
    expect(saved.value.review.diff.files[0]?.rawDiff).toContain("return a - b");
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

  it("sanitizes a path-bearing git failure before streaming the terminal error", async () => {
    const getDiff = vi.fn(async () =>
      err({ message: "fatal: unable to read /Users/someone/repo/.git/index" }),
    );
    vi.mocked(createGitService).mockReturnValue({ ...makeGitService(), getDiff });

    const aiClient = makeAIClient();
    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);

    const session = getSession(result.value.reviewId);
    const activeSession = requireValue(session, "review session");

    await vi.waitFor(() => {
      if (!activeSession.isComplete) throw new Error("session not complete yet");
    });

    const stream = makeMockStream();
    await streamActiveSessionToSSE(stream, activeSession);

    const events = parsedEvents(stream);
    const lastEvent = events[events.length - 1];

    expect(lastEvent?.type).toBe("error");
    expect(JSON.stringify(events)).not.toContain("/Users/");
  });
});

describe("admitted configuration execution", () => {
  it("uses one exact admitted configuration and model tuple for every lens invocation", async () => {
    const dispatches: DispatchIdentity[] = [];
    const aiClient = makeAIClient(DEFAULT_REVIEW_RESULT, DEFAULT_EXECUTION_FINGERPRINT, dispatches);
    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
      lenses: ["correctness", "security"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    await vi.waitFor(() => {
      if (!getSession(result.value.reviewId)?.isComplete) {
        throw new Error("session not complete yet");
      }
    });

    expect(dispatches.length).toBeGreaterThanOrEqual(2);
    const admitted = serviceAdmittedPlan();
    expect(new Set(dispatches.map((dispatch) => JSON.stringify(dispatch))).size).toBe(1);
    for (const dispatch of dispatches) {
      expect(dispatch).toEqual({
        executionFingerprint: admitted.executionFingerprint,
        modelId: admitted.evidenceKey.modelId,
      });
    }
  });

  it("does not reuse session state when the admitted execution fingerprint changes", async () => {
    const existingFingerprint = {
      provider: "openrouter" as const,
      model: "openai/gpt-4.1",
    };
    const nextFingerprint = {
      provider: "openrouter" as const,
      model: "openai/gpt-4.1-mini",
    };
    const existing = createSession("existing-admitted-fingerprint", {
      projectPath: projectRoot,
      headCommit: "abc123",
      statusHash: "hash123",
      statusHashKind: "full",
      mode: "unstaged",
      reviewConfigKey: serviceReviewConfigKey(existingFingerprint),
      configurationId: "openrouter-primary",
      configurationRevision: 2,
      admittedExecutionFingerprint: serviceAdmittedPlan(existingFingerprint).executionFingerprint,
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
    expect(result.value.session.admittedExecutionFingerprint).toBe(
      serviceAdmittedPlan(nextFingerprint).executionFingerprint,
    );
    expect(existing.isComplete).toBe(true);
  });

  it("releases the admitted lease and budget on a completed terminal path", async () => {
    const aiClient = makeAIClient();
    const release = aiClient.authorization?.release;
    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    await vi.waitFor(() => {
      if (!getSession(result.value.reviewId)?.isComplete) {
        throw new Error("session not complete yet");
      }
    });

    expect(release).toHaveBeenCalledTimes(1);
  });

  it("records passed evidence when an unproven review completes", async () => {
    const { getStore } = await import("../../shared/lib/config/store.js");
    const recordEvidence = vi.spyOn(getStore(), "recordConfigurationEvidence");
    const aiClient = makeConformanceAIClient({ evidenceState: "unproven" });

    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    await vi.waitFor(() => {
      if (!getSession(result.value.reviewId)?.isComplete) {
        throw new Error("session not complete yet");
      }
    });

    const [configurationId, evidence] = requireValue(
      recordEvidence.mock.calls[0],
      "recorded conformance evidence",
    );
    expect(configurationId).toBe(serviceAdmittedPlan().configurationId);
    expect(evidence).toMatchObject({ status: "passed", expiresAt: null });
    expect(evidence.evidenceKeyHash).toBe(
      hashAdmissionEvidenceKeySync(serviceAdmittedPlan().evidenceKey),
    );
    // The store holds no such configuration, so the record call fails: the
    // review still completes, which is the warn-only contract.
    expect(getSession(result.value.reviewId)?.isComplete).toBe(true);
    recordEvidence.mockRestore();
  });

  it("files passed evidence on the first structured success and does not rewrite it at completion", async () => {
    const { getStore } = await import("../../shared/lib/config/store.js");
    // The store holds no such configuration, so a real write would fail — and a
    // failed write is exactly what re-arms the completion-time fallback. This
    // case is about the write that lands.
    const recordEvidence = vi
      .spyOn(getStore(), "recordConfigurationEvidence")
      .mockResolvedValue(ok(true));
    const aiClient = makeConformanceAIClient({ evidenceState: "unproven" });
    const authorization = requireValue(aiClient.authorization, "test client authorization");

    await recordPassedConformanceEvidence(authorization);

    const [configurationId, evidence] = requireValue(
      recordEvidence.mock.calls[0],
      "recorded conformance evidence",
    );
    expect(configurationId).toBe(serviceAdmittedPlan().configurationId);
    expect(evidence).toMatchObject({ status: "passed", expiresAt: null });
    expect(evidence.evidenceKeyHash).toBe(
      hashAdmissionEvidenceKeySync(serviceAdmittedPlan().evidenceKey),
    );

    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    await vi.waitFor(() => {
      if (!getSession(result.value.reviewId)?.isComplete) {
        throw new Error("session not complete yet");
      }
    });

    expect(recordEvidence).toHaveBeenCalledOnce();
    recordEvidence.mockRestore();
  });

  it("files passed evidence at completion when the first structured success could not write it", async () => {
    const { getStore } = await import("../../shared/lib/config/store.js");
    const { configurationActionFailure } = await import("../../shared/lib/config/types.js");
    const recordEvidence = vi
      .spyOn(getStore(), "recordConfigurationEvidence")
      .mockResolvedValueOnce(err(configurationActionFailure("PERSIST_FAILED", "disk unavailable")))
      .mockResolvedValue(ok(true));
    const aiClient = makeConformanceAIClient({ evidenceState: "unproven" });
    const authorization = requireValue(aiClient.authorization, "test client authorization");

    await recordPassedConformanceEvidence(authorization);
    expect(recordEvidence).toHaveBeenCalledOnce();

    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    await vi.waitFor(() => {
      if (!getSession(result.value.reviewId)?.isComplete) {
        throw new Error("session not complete yet");
      }
    });

    // The early write never landed, so the completion-time recorder is still the
    // fallback it is meant to be instead of a suppressed no-op.
    expect(recordEvidence).toHaveBeenCalledTimes(2);
    const [, evidence] = requireValue(
      recordEvidence.mock.calls[1],
      "recorded conformance evidence",
    );
    expect(evidence).toMatchObject({ status: "passed" });
    recordEvidence.mockRestore();
  });

  it("files no passed evidence for a tuple admission already proved", async () => {
    const { getStore } = await import("../../shared/lib/config/store.js");
    const recordEvidence = vi.spyOn(getStore(), "recordConfigurationEvidence");
    const aiClient = makeConformanceAIClient({ evidenceState: "proven" });

    await recordPassedConformanceEvidence(
      requireValue(aiClient.authorization, "test client authorization"),
    );

    expect(recordEvidence).not.toHaveBeenCalled();
    recordEvidence.mockRestore();
  });

  it("records failed evidence for malformed output the corrective retry could not fix", async () => {
    const { getStore } = await import("../../shared/lib/config/store.js");
    const recordEvidence = vi.spyOn(getStore(), "recordConfigurationEvidence");
    const aiClient = makeConformanceAIClient({
      evidenceState: "unproven",
      structuredOutputFailure: {
        diagnosticCode: MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE,
        attemptCount: 2,
      },
    });

    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    await vi.waitFor(() => {
      if (!getSession(result.value.reviewId)?.isComplete) {
        throw new Error("session not complete yet");
      }
    });

    const [, evidence] = requireValue(
      recordEvidence.mock.calls[0],
      "recorded conformance evidence",
    );
    expect(evidence).toMatchObject({ status: "failed", expiresAt: null });
    recordEvidence.mockRestore();
  });

  it.each([
    { diagnosticCode: "reasoning-budget-consumed", attemptCount: 1 },
    { diagnosticCode: "output-truncated", attemptCount: 1 },
  ])("records no evidence for the $diagnosticCode geometry failure", async ({
    diagnosticCode,
    attemptCount,
  }) => {
    const { getStore } = await import("../../shared/lib/config/store.js");
    const recordEvidence = vi.spyOn(getStore(), "recordConfigurationEvidence");
    const aiClient = makeConformanceAIClient({
      evidenceState: "unproven",
      structuredOutputFailure: { diagnosticCode, attemptCount },
    });

    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    await vi.waitFor(() => {
      if (!getSession(result.value.reviewId)?.isComplete) {
        throw new Error("session not complete yet");
      }
    });

    expect(recordEvidence).not.toHaveBeenCalled();
    recordEvidence.mockRestore();
  });

  it("records no failed evidence for an upstream finish-error run, even after the blind retry", async () => {
    const { getStore } = await import("../../shared/lib/config/store.js");
    const recordEvidence = vi.spyOn(getStore(), "recordConfigurationEvidence");
    const aiClient = makeConformanceAIClient({
      evidenceState: "unproven",
      structuredOutputFailure: {
        diagnosticCode: "provider-generation-error",
        attemptCount: 2,
        outcome: "transport-failed",
      },
    });

    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    await vi.waitFor(() => {
      if (!getSession(result.value.reviewId)?.isComplete) {
        throw new Error("session not complete yet");
      }
    });

    expect(recordEvidence).not.toHaveBeenCalled();
    recordEvidence.mockRestore();
  });

  // attemptCount 2 is the blind-retry case: a retry that carried no correction
  // (an upstream mid-generation death, an empty answer) spends the same retry
  // budget, so only the adapter's code may arm the memo.
  it.each([
    { attemptCount: 1 },
    { attemptCount: 2 },
  ])("records no evidence when the corrective retry never ran (attemptCount $attemptCount)", async ({
    attemptCount,
  }) => {
    const { getStore } = await import("../../shared/lib/config/store.js");
    const recordEvidence = vi.spyOn(getStore(), "recordConfigurationEvidence");
    const aiClient = makeConformanceAIClient({
      evidenceState: "unproven",
      structuredOutputFailure: { diagnosticCode: "malformed-review-output", attemptCount },
    });

    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    await vi.waitFor(() => {
      if (!getSession(result.value.reviewId)?.isComplete) {
        throw new Error("session not complete yet");
      }
    });

    expect(recordEvidence).not.toHaveBeenCalled();
    recordEvidence.mockRestore();
  });

  it("does not rewrite evidence for a tuple admission already proved", async () => {
    const { getStore } = await import("../../shared/lib/config/store.js");
    const recordEvidence = vi.spyOn(getStore(), "recordConfigurationEvidence");
    const aiClient = makeConformanceAIClient({ evidenceState: "proven" });

    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    await vi.waitFor(() => {
      if (!getSession(result.value.reviewId)?.isComplete) {
        throw new Error("session not complete yet");
      }
    });

    expect(recordEvidence).not.toHaveBeenCalled();
    recordEvidence.mockRestore();
  });

  it("releases the admitted lease and budget when the diff is empty", async () => {
    vi.mocked(createGitService).mockReturnValue(makeGitService({ diff: "" }));
    const aiClient = makeAIClient();
    const release = aiClient.authorization?.release;
    const result = await createReviewSession(aiClient, {
      mode: "unstaged",
      projectPath: projectRoot,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    trackSessionWithRunner(result.value.reviewId);
    await vi.waitFor(() => {
      if (!getSession(result.value.reviewId)?.isComplete) {
        throw new Error("session not complete yet");
      }
    });

    expect(release).toHaveBeenCalledTimes(1);
  });
});
