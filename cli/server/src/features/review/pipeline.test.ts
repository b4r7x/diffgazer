import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { err, ok } from "@diffgazer/core/result";
import type { HostedApiProductId, SettingsConfig } from "@diffgazer/core/schemas/config";
import type { FullReviewStreamEvent, LensStat } from "@diffgazer/core/schemas/events";
import {
  type EvidenceKey,
  type ExecutionLimits,
  LENS_IDS,
  type LensId,
  ReviewErrorCode,
} from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdmittedExecutionPlan } from "../../shared/lib/ai/admission/service.js";
import {
  ExecutionLeaseRegistry,
  STRUCTURED_OUTPUT_FAILURE_GUIDANCE,
  toClientSafeAdmittedPlanJson,
} from "../../shared/lib/ai/admission/service.js";
import { createBudgetLedger } from "../../shared/lib/ai/budget/ledger.js";
import { buildExecutionResult } from "../../shared/lib/ai/client/generate.js";
import { promptAttemptEstimate } from "../../shared/lib/ai/providers/execution-receipt.js";
import type { Adapter } from "../../shared/lib/ai/types.js";
import { makeFileDiff, makeParsedDiff } from "./testing/factories.js";
import { createReviewExecutionContext, type ReviewOutcome } from "./types.js";

const saveReview = vi.fn();
const orchestrateReview = vi.fn();
// Boundary mock: filesystem storage - saveReview is the durable-write boundary finalizeReview gates the report step on.
vi.mock("./storage/reviews.js", () => ({
  saveReview: (...args: unknown[]) => saveReview(...args),
}));
vi.mock("./engine/orchestrate.js", () => ({
  orchestrateReview: (...args: unknown[]) => orchestrateReview(...args),
}));

import { executeReview, finalizeReview, resolveReviewDefaults } from "./pipeline.js";
import {
  addEvent,
  cancelSessionForUser,
  cleanupStaleSessions,
  createSession,
  deleteSessionForTests,
  getSession,
} from "./stream/store.js";

function makePipelineFile(filePath: string, additions = 1, deletions = 0) {
  return makeFileDiff({
    filePath,
    rawDiff: "",
    stats: { additions, deletions, sizeBytes: 100 },
  });
}

const makePipelineIssue = (
  id: string,
  file: string,
  severity: "blocker" | "high" | "medium" | "low" | "nit",
) =>
  makeIssue({
    id,
    file,
    severity,
    title: `Issue ${id}`,
    rationale: "test",
    recommendation: "fix",
    symptom: "broken",
    whyItMatters: "matters",
    line_start: 1,
    line_end: 5,
  });

describe("resolveReviewDefaults", () => {
  const baseSettings: SettingsConfig = {
    theme: "auto",
    secretsStorage: null,
    defaultLenses: ["correctness", "security"],
    defaultProfile: null,
    severityThreshold: "low",
    agentExecution: "sequential",
    providerConsent: null,
  };

  it("uses validated settings defaults when explicit lenses are empty", () => {
    const settings: SettingsConfig = {
      theme: "auto",
      defaultLenses: ["security"],
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: null,
      agentExecution: "sequential",
      providerConsent: null,
    };

    expect(resolveReviewDefaults({ lensIds: [], settings }).activeLenses).toEqual(["security"]);
  });

  it("applies defaultProfile from settings when no explicit profile is provided", () => {
    const defaults = resolveReviewDefaults({
      settings: { ...baseSettings, defaultProfile: "strict" },
    });

    expect(defaults.effectiveProfileId).toBe("strict");
    expect(defaults.activeLenses).toEqual(["correctness", "security", "tests"]);
  });

  it("applies severityThreshold from settings when the profile filter is looser", () => {
    const defaults = resolveReviewDefaults({
      settings: { ...baseSettings, defaultProfile: "perf", severityThreshold: "high" },
    });

    expect(defaults.severityFilter).toEqual({ minSeverity: "high" });
  });

  it("deduplicates default lenses before review orchestration", () => {
    const defaults = resolveReviewDefaults({
      settings: {
        ...baseSettings,
        defaultLenses: ["correctness", "correctness", "correctness"],
      },
    });

    expect(defaults.activeLenses).toEqual(["correctness"]);
  });

  it("deduplicates explicit lenses in first-seen order and keeps at most the closed lens set", () => {
    const defaults = resolveReviewDefaults({
      lensIds: [
        "tests",
        "security",
        "correctness",
        "tests",
        "performance",
        "simplicity",
        "security",
      ],
      settings: baseSettings,
    });

    expect(defaults.activeLenses).toEqual([
      "tests",
      "security",
      "correctness",
      "performance",
      "simplicity",
    ]);
    expect(defaults.activeLenses).toHaveLength(LENS_IDS.length);
  });

  it("captures execution concurrency with the resolved defaults", () => {
    const defaults = resolveReviewDefaults({
      settings: { ...baseSettings, agentExecution: "parallel" },
    });

    expect(defaults.concurrency).toBe(defaults.activeLenses.length);
  });
});

describe("executeReview", () => {
  afterEach(() => {
    orchestrateReview.mockReset();
  });

  it("preserves a classified orchestration error instead of collapsing it to AI_ERROR", async () => {
    orchestrateReview.mockResolvedValue(err({ code: "NO_DIFF", message: "No files changed" }));
    const result = await executeReview({
      aiClient: {
        provider: "openrouter",
        generate: async () => err({ code: "MODEL_ERROR", message: "not called" }),
      },
      parsed: makeParsedDiff([]),
      config: {
        activeLenses: ["correctness"],
        effectiveProfileId: undefined,
        profile: undefined,
        severityFilter: undefined,
        concurrency: 1,
        projectContext: "",
      },
      emit: async () => undefined,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "NO_DIFF", step: "review" },
    });
  });
});

const PIPELINE_LIMITS: ExecutionLimits = Object.freeze({
  maxInputTokens: 40_000,
  maxResponseBytes: 8_000_000,
  wallTimeMs: 300_000,
  maxRetries: 1,
  maxConcurrency: 2,
  maxCostUsd: 5,
});

function pipelineEvidenceKey(productId: HostedApiProductId = "gemini"): EvidenceKey {
  const product = PRODUCT_REGISTRY[productId];
  const endpoint = product.configuration.endpoints[0];
  return {
    authentication: null,
    credentialReferenceIdentity: "c".repeat(64),
    installationId: null,
    productId,
    transportFamily: product.transportFamily,
    normalizedEndpoint: endpoint?.endpoint ?? "https://example.invalid/v1",
    region: endpoint && "region" in endpoint ? (endpoint.region ?? null) : null,
    workspaceAccountReference: null,
    modelId: "gemini-test-model",
    runtime: { identity: "diffgazer-server", version: "1.0.0" },
    structuredOutputSchemaSha256: "a".repeat(64),
    noticeVersion: product.notice.noticeVersion,
    limits: PIPELINE_LIMITS,
  };
}

function pipelineAdmittedPlan(productId: HostedApiProductId = "gemini"): AdmittedExecutionPlan {
  const evidenceKey = pipelineEvidenceKey(productId);
  return Object.freeze({
    configurationId: "gemini-primary",
    configurationRevision: 3,
    executionFingerprint: "admitted-fingerprint-abc123",
    evidenceKey: Object.freeze({ ...evidenceKey, limits: PIPELINE_LIMITS }),
    productId,
    transportFamily: PRODUCT_REGISTRY[productId].transportFamily,
    limits: PIPELINE_LIMITS,
  });
}

function authorizePipelineExecution(plan: AdmittedExecutionPlan, adapter: Adapter) {
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
  return {
    authorization: Object.freeze({
      plan,
      adapter,
      evidenceState: "proven" as const,
      budgetLedger: ledger,
      budgetReservation: budgetReservation.value,
      lease: lease.value,
      resolveCredential: async () => "super-secret-token",
      workspaceAccountId: null,
      release,
    }),
    release,
    ledger,
    leaseRegistry,
  };
}

function pipelineConfig() {
  return {
    activeLenses: ["correctness"] as LensId[],
    effectiveProfileId: undefined,
    profile: undefined,
    severityFilter: undefined,
    concurrency: 1,
    projectContext: "",
  };
}

function orchestrationSuccess(issues = [makePipelineIssue("1", "a.ts", "high")]) {
  orchestrateReview.mockResolvedValue(
    ok({
      issues,
      lensStats: [],
      droppedDuplicates: 0,
      droppedBelowThreshold: 0,
    }),
  );
}

describe("admitted execution lifecycle", () => {
  afterEach(() => {
    orchestrateReview.mockReset();
  });

  it("persists the exact completed receipt outcome through execution", async () => {
    const plan = pipelineAdmittedPlan();
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrationSuccess();
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt).toMatchObject({
      outcome: "completed",
      configurationId: plan.configurationId,
      configurationRevision: plan.configurationRevision,
      modelId: plan.evidenceKey.modelId,
      limits: plan.limits,
    });
    expect(result.value.issues).toHaveLength(1);
  });

  it("persists the exact cancelled receipt outcome when execution aborts before orchestration", async () => {
    const plan = pipelineAdmittedPlan();
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
      signal: AbortSignal.abort(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.outcome).toBe("cancelled");
    expect(result.value.issues).toEqual([]);
    expect(orchestrateReview).not.toHaveBeenCalled();
  });

  it.each([
    ["transport-failed", { code: "AI_ERROR", message: "transport down" }],
    ["schema-failed", { code: "PARSE_ERROR", message: "schema mismatch" }],
  ] as const)("persists the exact %s receipt outcome for orchestration failures", async (outcome, error) => {
    const plan = pipelineAdmittedPlan();
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrateReview.mockResolvedValue(err(error));
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.outcome).toBe(outcome);
    expect(result.value.issues).toEqual([]);
  });

  it("aggregates usage across all failed dispatches while keeping the decisive receipt", async () => {
    const plan = pipelineAdmittedPlan();
    const schemaFailed = buildExecutionResult(plan, "schema-failed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:01.000Z",
      attemptCount: 2,
      usageAvailability: "reported",
      usage: { inputTokens: 7, outputTokens: 3, totalTokens: 10 },
    });
    const transportFailed = buildExecutionResult(plan, "transport-failed", {
      startedAt: "2026-07-31T10:00:02.000Z",
      finishedAt: "2026-07-31T10:00:03.000Z",
      attemptCount: 1,
      usageAvailability: "reported",
      usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
    });
    const schemaDiagnostic = {
      code: "schema-failed",
      safeMessage: "Schema diagnostic",
      retryable: false,
      remediation: "Retry with a compatible schema.",
      correlationId: "schema-failed-correlation",
    };
    const transportDiagnostic = {
      code: "transport-failed",
      safeMessage: "Transport diagnostic",
      retryable: true,
      remediation: "Retry after checking provider status.",
      correlationId: "transport-failed-correlation",
    };
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrateReview.mockResolvedValue(err({ code: "PARSE_ERROR", message: "schema mismatch" }));
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
        terminalExecutions: [schemaFailed, transportFailed],
        terminalDiagnostics: [schemaDiagnostic, transportDiagnostic],
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.outcome).toBe("schema-failed");
    expect(result.value.terminalDiagnostic).toEqual(schemaDiagnostic);
    expect(result.value.execution?.receipt.startedAt).toBe(schemaFailed.receipt.startedAt);
    expect(result.value.execution?.receipt.finishedAt).toBe(schemaFailed.receipt.finishedAt);
    expect(result.value.execution?.receipt.attemptCount).toBe(2);
    expect(result.value.execution?.receipt.usage).toEqual({
      inputTokens: 12,
      outputTokens: 5,
      totalTokens: 17,
    });
  });

  it("reports the schema failure that decided the review, not the dispatch that failed first", async () => {
    const plan = pipelineAdmittedPlan();
    const transportFailed = buildExecutionResult(plan, "transport-failed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:01.000Z",
      attemptCount: 1,
      usageAvailability: "unavailable",
    });
    const schemaFailed = buildExecutionResult(plan, "schema-failed", {
      startedAt: "2026-07-31T10:00:02.000Z",
      finishedAt: "2026-07-31T10:00:03.000Z",
      attemptCount: 2,
      usageAvailability: "unavailable",
    });
    const transportDiagnostic = {
      code: "transport-failed",
      safeMessage: "Transport diagnostic",
      retryable: true,
      remediation: "Retry after checking provider status.",
      correlationId: "transport-failed-correlation",
    };
    const schemaDiagnostic = {
      code: "schema-failed",
      safeMessage: "Schema diagnostic",
      retryable: false,
      remediation: "Retry with a compatible schema.",
      correlationId: "schema-failed-correlation",
    };
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrateReview.mockResolvedValue(err({ code: "PARSE_ERROR", message: "schema mismatch" }));
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
        terminalExecutions: [transportFailed, schemaFailed],
        terminalDiagnostics: [transportDiagnostic, schemaDiagnostic],
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.outcome).toBe("schema-failed");
    expect(result.value.terminalDiagnostic).toEqual(schemaDiagnostic);
    expect(result.value.execution?.receipt.startedAt).toBe(schemaFailed.receipt.startedAt);
    expect(result.value.execution?.receipt.attemptCount).toBe(2);
  });

  it("reports a bridge schema rejection as schema-failed when no dispatch receipt carries it", async () => {
    const plan = pipelineAdmittedPlan();
    const transportFailed = buildExecutionResult(plan, "transport-failed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:01.000Z",
      attemptCount: 1,
      usageAvailability: "unavailable",
    });
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrateReview.mockResolvedValue(err({ code: "PARSE_ERROR", message: "schema mismatch" }));
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
        terminalExecutions: [transportFailed],
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.outcome).toBe("schema-failed");
  });

  it("marks all-failed total-only usage as unavailable", async () => {
    const plan = pipelineAdmittedPlan();
    const schemaFailed = buildExecutionResult(plan, "schema-failed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:01.000Z",
      usageAvailability: "reported",
      usage: { totalTokens: 10 },
    });
    const transportFailed = buildExecutionResult(plan, "transport-failed", {
      startedAt: "2026-07-31T10:00:02.000Z",
      finishedAt: "2026-07-31T10:00:03.000Z",
      usageAvailability: "reported",
      usage: { totalTokens: 7 },
    });
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrateReview.mockResolvedValue(err({ code: "PARSE_ERROR", message: "schema mismatch" }));
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
        terminalExecutions: [schemaFailed, transportFailed],
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.outcome).toBe("schema-failed");
    expect(result.value.execution?.receipt.usageAvailability).toBe("unavailable");
    expect(result.value.execution?.receipt.usage).toBeUndefined();
  });

  it("threads the last safe terminal diagnostic through admitted execution failures", async () => {
    const plan = pipelineAdmittedPlan();
    const failureExecution = buildExecutionResult(plan, "transport-failed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:02.000Z",
      attemptCount: 1,
      usageAvailability: "unavailable",
    });
    const terminalDiagnostic = {
      code: "transport-failed",
      safeMessage: "Hosted adapter timed out after handshake",
      retryable: true,
      remediation: "Retry after checking provider status.",
      correlationId: "diag-review-123",
    };
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrateReview.mockResolvedValue(err({ code: "STREAM_ERROR", message: "unused" }));
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
        terminalExecutions: [failureExecution],
        terminalDiagnostics: [terminalDiagnostic],
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.outcome).toBe("transport-failed");
    expect(result.value.terminalDiagnostic).toEqual(terminalDiagnostic);
  });

  it.each([
    "timed-out",
    "budget-exhausted",
  ] as const)("persists the exact %s receipt outcome on the admitted execution result", (outcome) => {
    const plan = pipelineAdmittedPlan();
    const execution = buildExecutionResult(plan, outcome, {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:05.000Z",
    });
    expect(execution.receipt).toMatchObject({
      outcome,
      configurationId: plan.configurationId,
      configurationRevision: plan.configurationRevision,
    });
    expect(execution.result.issues).toEqual([]);
  });

  it("releases lease and budget resources exactly once", () => {
    const plan = pipelineAdmittedPlan();
    const { authorization, release, leaseRegistry } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    const context = createReviewExecutionContext(authorization);

    context.releaseOnce();
    context.releaseOnce();

    expect(release).toHaveBeenCalledTimes(1);
    expect(leaseRegistry.activeLeaseCount(plan.configurationId)).toBe(0);
  });

  it("normalizes reported usage and associates it with the admitted receipt fingerprint", () => {
    const plan = pipelineAdmittedPlan();
    const usage = {
      inputTokens: 12,
      outputTokens: 4,
      totalTokens: 16,
      cachedTokens: 0,
      reasoningTokens: 0,
    };
    const execution = buildExecutionResult(plan, "completed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:01.000Z",
      usage,
      usageAvailability: "reported",
      issues: [makePipelineIssue("1", "a.ts", "high")],
    });

    expect(execution.receipt.usageAvailability).toBe("reported");
    expect(execution.receipt.usage).toEqual(usage);
    expect(execution.receipt.executionFingerprint).toHaveLength(64);
  });

  it("uses per-dispatch receipt timing instead of the orchestration wall clock", async () => {
    const plan = pipelineAdmittedPlan();
    const dispatchStarted = "2026-07-31T10:00:00.000Z";
    const dispatchFinished = "2026-07-31T10:00:04.000Z";
    const dispatchExecution = buildExecutionResult(plan, "completed", {
      startedAt: dispatchStarted,
      finishedAt: dispatchFinished,
      usageAvailability: "reported",
      usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
      issues: [makePipelineIssue("1", "a.ts", "high")],
    });
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrationSuccess([makePipelineIssue("1", "a.ts", "high")]);
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
        terminalExecutions: [dispatchExecution],
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.startedAt).toBe(dispatchStarted);
    expect(result.value.execution?.receipt.finishedAt).toBe(dispatchFinished);
    expect(result.value.execution?.receipt.outcome).toBe("completed");
  });

  it("keeps retry counts per dispatch across the five default lenses", async () => {
    const plan = pipelineAdmittedPlan();
    const dispatches = LENS_IDS.map((_, index) =>
      buildExecutionResult(plan, "completed", {
        startedAt: `2026-07-31T10:00:0${index}.000Z`,
        finishedAt: `2026-07-31T10:00:0${index + 1}.000Z`,
        attemptCount: 2,
        usageAvailability: "unavailable",
      }),
    );
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrationSuccess();
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
        terminalExecutions: dispatches,
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: { ...pipelineConfig(), activeLenses: [...LENS_IDS], concurrency: LENS_IDS.length },
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.attemptCount).toBe(2);
    expect(result.value.execution?.receipt.startedAt).toBe("2026-07-31T10:00:04.000Z");
    expect(result.value.execution?.receipt.finishedAt).toBe("2026-07-31T10:00:05.000Z");
  });

  it("makes a budget-exhausted dispatch terminal and retains known usage from every dispatch", async () => {
    const plan = pipelineAdmittedPlan();
    const completed = buildExecutionResult(plan, "completed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:01.000Z",
      attemptCount: 2,
      usageAvailability: "reported",
      usage: {
        inputTokens: 12,
        outputTokens: 4,
        totalTokens: 16,
        cachedTokens: 2,
        reasoningTokens: 1,
      },
    });
    const budgetExhausted = buildExecutionResult(plan, "budget-exhausted", {
      startedAt: "2026-07-31T10:00:02.000Z",
      finishedAt: "2026-07-31T10:00:03.000Z",
      attemptCount: 1,
      usageAvailability: "reported",
      usage: {
        inputTokens: 3,
        outputTokens: 2,
        totalTokens: 5,
        cachedTokens: 1,
        reasoningTokens: 1,
      },
    });
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrationSuccess();
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
        terminalExecutions: [completed, budgetExhausted],
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.outcome).toBe("budget-exhausted");
    // The lens that settled inside the budget keeps its findings; the dispatch
    // that ran out never returned any, so its own receipt result stays empty.
    expect(result.value.issues).toHaveLength(1);
    expect(result.value.execution?.result.issues).toEqual([]);
    expect(result.value.execution?.receipt.usage).toEqual({
      inputTokens: 15,
      outputTokens: 6,
      totalTokens: 21,
      cachedTokens: 3,
      reasoningTokens: 2,
    });
  });

  it("keeps a partial input-only usage report input-only", async () => {
    const plan = pipelineAdmittedPlan();
    const dispatch = buildExecutionResult(plan, "completed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:01.000Z",
      usageAvailability: "reported",
      usage: { inputTokens: 12 },
    });
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrationSuccess();
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
        terminalExecutions: [dispatch],
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.usageAvailability).toBe("reported");
    expect(result.value.execution?.receipt.usage).toEqual({ inputTokens: 12 });
  });

  it("does not report a total-only usage aggregate", async () => {
    const plan = pipelineAdmittedPlan();
    const dispatch = buildExecutionResult(plan, "completed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:01.000Z",
      usageAvailability: "reported",
      usage: { totalTokens: 12 },
    });
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrationSuccess();
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
        terminalExecutions: [dispatch],
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.usageAvailability).toBe("unavailable");
    expect(result.value.execution?.receipt.usage).toBeUndefined();
  });

  it("sums cached and reasoning usage components independently", async () => {
    const plan = pipelineAdmittedPlan();
    const firstDispatch = buildExecutionResult(plan, "completed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:01.000Z",
      usageAvailability: "reported",
      usage: {
        inputTokens: 8,
        outputTokens: 6,
        totalTokens: 14,
        cachedTokens: 3,
        reasoningTokens: 2,
      },
    });
    const secondDispatch = buildExecutionResult(plan, "completed", {
      startedAt: "2026-07-31T10:00:02.000Z",
      finishedAt: "2026-07-31T10:00:03.000Z",
      usageAvailability: "reported",
      usage: {
        inputTokens: 4,
        outputTokens: 5,
        totalTokens: 9,
        cachedTokens: 1,
        reasoningTokens: 1,
      },
    });
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrationSuccess();
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
        terminalExecutions: [firstDispatch, secondDispatch],
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.usage).toEqual({
      inputTokens: 12,
      outputTokens: 11,
      totalTokens: 23,
      cachedTokens: 4,
      reasoningTokens: 3,
    });
  });

  it("preserves earlier reported usage when a later dispatch is unavailable", async () => {
    const plan = pipelineAdmittedPlan();
    const firstDispatch = buildExecutionResult(plan, "completed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:01.000Z",
      usageAvailability: "reported",
      usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
    });
    const unavailableDispatch = buildExecutionResult(plan, "completed", {
      startedAt: "2026-07-31T10:00:02.000Z",
      finishedAt: "2026-07-31T10:00:03.000Z",
      attemptCount: 2,
      usageAvailability: "unavailable",
    });
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrationSuccess();
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
        terminalExecutions: [firstDispatch, unavailableDispatch],
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.attemptCount).toBe(2);
    expect(result.value.execution?.receipt.usageAvailability).toBe("reported");
    expect(result.value.execution?.receipt.usage).toEqual({
      inputTokens: 12,
      outputTokens: 4,
      totalTokens: 16,
    });
  });

  it("aggregates reported usage from failed and completed dispatches", async () => {
    const plan = pipelineAdmittedPlan();
    const schemaFailed = buildExecutionResult(plan, "schema-failed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:01.000Z",
      usageAvailability: "reported",
      usage: { inputTokens: 7, outputTokens: 3, totalTokens: 10 },
    });
    const completed = buildExecutionResult(plan, "completed", {
      startedAt: "2026-07-31T10:00:02.000Z",
      finishedAt: "2026-07-31T10:00:03.000Z",
      usageAvailability: "reported",
      usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
    });
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrationSuccess();
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
        terminalExecutions: [schemaFailed, completed],
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.outcome).toBe("completed");
    expect(result.value.execution?.receipt.startedAt).toBe(completed.receipt.startedAt);
    expect(result.value.execution?.receipt.finishedAt).toBe(completed.receipt.finishedAt);
    expect(result.value.execution?.receipt.attemptCount).toBe(completed.receipt.attemptCount);
    expect(result.value.execution?.receipt.usage).toEqual({
      inputTokens: 12,
      outputTokens: 5,
      totalTokens: 17,
    });
  });

  it("clamps orchestration wall clock to the admitted limit and keeps completed findings", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T10:00:00.000Z"));
    const plan = pipelineAdmittedPlan();
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrateReview.mockImplementation(async () => {
      vi.setSystemTime(new Date("2026-07-31T10:10:00.000Z"));
      return ok({
        issues: [makePipelineIssue("1", "a.ts", "high")],
        lensStats: [],
        droppedDuplicates: 0,
        droppedBelowThreshold: 0,
      });
    });
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
        terminalExecutions: [],
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });
    vi.useRealTimers();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.outcome).toBe("completed");
    expect(result.value.execution?.receipt.startedAt).toBe("2026-07-31T10:00:00.000Z");
    expect(result.value.execution?.receipt.finishedAt).toBe("2026-07-31T10:05:00.000Z");
    expect(result.value.issues).toHaveLength(1);
  });

  it("uses the last completed dispatch timing when usage is unavailable", async () => {
    const plan = pipelineAdmittedPlan();
    const dispatchStarted = "2026-07-31T10:00:00.000Z";
    const dispatchFinished = "2026-07-31T10:00:03.000Z";
    const firstDispatch = buildExecutionResult(plan, "completed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:01.000Z",
      usageAvailability: "unavailable",
      issues: [],
    });
    const lastDispatch = buildExecutionResult(plan, "completed", {
      startedAt: dispatchStarted,
      finishedAt: dispatchFinished,
      usageAvailability: "unavailable",
      issues: [],
    });
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    orchestrationSuccess([makePipelineIssue("1", "a.ts", "high")]);
    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
        terminalExecutions: [firstDispatch, lastDispatch],
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.execution?.receipt.startedAt).toBe(dispatchStarted);
    expect(result.value.execution?.receipt.finishedAt).toBe(dispatchFinished);
    expect(result.value.execution?.receipt.outcome).toBe("completed");
    expect(result.value.execution?.receipt.usageAvailability).toBe("unavailable");
    expect(result.value.issues).toHaveLength(1);
  });

  it("exposes no secret values on the client-safe admitted plan surface", () => {
    const plan = pipelineAdmittedPlan();
    const { authorization } = authorizePipelineExecution(plan, {
      productId: "gemini",
      transportFamily: "hosted-api",
      execute: vi.fn(),
    });
    const clientSurface = toClientSafeAdmittedPlanJson(authorization.plan);

    expect(clientSurface).not.toContain("super-secret-token");
    expect(clientSurface).not.toContain("credential");
    expect(clientSurface).toContain(plan.executionFingerprint);
  });
});

describe("finalizeReview", () => {
  const auxiliarySessionIds = new Set<string>();

  afterEach(() => {
    saveReview.mockReset();
    deleteSessionForTests("review-1");
    for (const reviewId of auxiliarySessionIds) deleteSessionForTests(reviewId);
    auxiliarySessionIds.clear();
  });

  function runFinalize(
    events: FullReviewStreamEvent[],
    onEmit?: (event: FullReviewStreamEvent) => void,
    monotonicNow?: () => number,
    outcome: ReviewOutcome = { issues: [makePipelineIssue("1", "a.ts", "high")] },
  ) {
    const session = createSession("review-1", {
      projectPath: "/project",
      headCommit: "snapshot-head",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
      ...(monotonicNow ? { monotonicNow } : {}),
    });
    return finalizeReview({
      outcome,
      emit: async (event) => {
        events.push(event);
        addEvent("review-1", event);
        onEmit?.(event);
      },
      reviewId: "review-1",
      projectPath: "/project",
      mode: "unstaged",
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      activeLenses: ["correctness"],
      durationMs: 42.5,
      branch: "snapshot-branch",
      headCommit: "snapshot-head",
      signal: session.controller.signal,
    });
  }

  function stepNames(events: FullReviewStreamEvent[], type: string): string[] {
    return events
      .filter(
        (e): e is Extract<FullReviewStreamEvent, { type: "step_start" | "step_complete" }> =>
          e.type === type && "step" in e,
      )
      .map((e) => e.step);
  }

  it("aborts with INTERNAL_ERROR and emits no report-complete when the save fails", async () => {
    saveReview.mockResolvedValue(err({ code: "WRITE_ERROR", message: "disk full" }));
    const events: FullReviewStreamEvent[] = [];

    const result = await runFinalize(events);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ kind: "review_abort", code: "INTERNAL_ERROR" });
    // The report step starts, but a save failure must never complete it — so the
    // client's View Results gate (and the absence of a terminal complete) holds.
    expect(stepNames(events, "step_start")).toContain("report");
    expect(stepNames(events, "step_complete")).not.toContain("report");
  });

  it("persists the findings of lenses that completed inside an exhausted budget", async () => {
    saveReview.mockResolvedValue(ok({ id: "review-1" }));
    const issues = [
      makePipelineIssue("1", "a.ts", "high"),
      makePipelineIssue("2", "b.ts", "medium"),
    ];
    const lensStats: LensStat[] = [
      { lensId: "correctness", issueCount: 1, status: "success" },
      { lensId: "security", issueCount: 1, status: "success" },
      {
        lensId: "tests",
        issueCount: 0,
        status: "failed",
        errorCode: "STREAM_ERROR",
        errorMessage: "Review budget exhausted at maxInputTokens (20000).",
      },
    ];
    const execution = buildExecutionResult(pipelineAdmittedPlan(), "budget-exhausted", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:02.000Z",
      attemptCount: 1,
      usageAvailability: "unavailable",
    });

    const result = await runFinalize([], undefined, undefined, { issues, lensStats, execution });

    expect(saveReview).toHaveBeenCalledWith(
      expect.objectContaining({ result: { issues }, lensStats }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({
      code: ReviewErrorCode.BUDGET_EXHAUSTED,
      step: "report",
    });
  });

  it.each([
    "cancelled",
    "timed-out",
    "transport-failed",
    "schema-failed",
  ] as const)("drops the findings a %s review cannot vouch for", async (outcome) => {
    saveReview.mockResolvedValue(ok({ id: "review-1" }));
    const execution = buildExecutionResult(pipelineAdmittedPlan(), outcome, {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:02.000Z",
      attemptCount: 1,
      usageAvailability: "unavailable",
    });

    await runFinalize([], undefined, undefined, {
      issues: [makePipelineIssue("partial", "a.ts", "high")],
      execution,
    });

    expect(saveReview).toHaveBeenCalledWith(expect.objectContaining({ result: { issues: [] } }));
  });

  it("returns the safe terminal diagnostic after persisting a failed execution", async () => {
    saveReview.mockResolvedValue(ok({ id: "review-1" }));
    const plan = pipelineAdmittedPlan();
    const terminalDiagnostic = {
      code: "transport-failed",
      safeMessage: "Hosted adapter timed out after handshake",
      retryable: true,
      remediation: "Retry after checking provider status.",
      correlationId: "diag-review-123",
    };
    const execution = buildExecutionResult(plan, "transport-failed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:02.000Z",
      attemptCount: 1,
      usageAvailability: "unavailable",
    });
    const events: FullReviewStreamEvent[] = [];

    const result = await runFinalize(events, undefined, undefined, {
      issues: [],
      execution,
      terminalDiagnostic,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({
      kind: "review_abort",
      code: "AI_ERROR",
      message: "Hosted adapter timed out after handshake",
    });
    expect(saveReview).toHaveBeenCalledWith(expect.objectContaining({ execution }));
  });

  it("reports the structured-output guidance when a schema failure carries no diagnostic", async () => {
    saveReview.mockResolvedValue(ok({ id: "review-1" }));
    const execution = buildExecutionResult(pipelineAdmittedPlan(), "schema-failed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:02.000Z",
      attemptCount: 1,
      usageAvailability: "unavailable",
    });

    const result = await runFinalize([], undefined, undefined, { issues: [], execution });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({
      kind: "review_abort",
      code: "MODEL_INCOMPATIBLE",
      message: STRUCTURED_OUTPUT_FAILURE_GUIDANCE,
    });
  });

  it("reports a refused provider request under its own code so surfaces can offer the fix", async () => {
    saveReview.mockResolvedValue(ok({ id: "review-1" }));
    const execution = buildExecutionResult(pipelineAdmittedPlan(), "transport-failed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:02.000Z",
      attemptCount: 1,
      usageAvailability: "unavailable",
    });
    const terminalDiagnostic = {
      code: "provider-rejected",
      safeMessage: "Groq rejected the credential (HTTP 401).",
      retryable: false,
      remediation: "Update the configuration with a valid API key.",
      correlationId: "rejected-correlation",
    };

    const result = await runFinalize([], undefined, undefined, {
      issues: [],
      execution,
      terminalDiagnostic,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({
      kind: "review_abort",
      code: "PROVIDER_REJECTED",
      message: "Groq rejected the credential (HTTP 401).",
    });
  });

  it("completes the report step only after a successful save", async () => {
    let savedBeforeReportComplete = false;
    saveReview.mockImplementation(async () => {
      // At save time the report step has started but must not yet be complete.
      savedBeforeReportComplete = capturedEvents.every(
        (e) => !(e.type === "step_complete" && "step" in e && e.step === "report"),
      );
      return ok({ id: "review-1" });
    });
    const capturedEvents: FullReviewStreamEvent[] = [];

    const result = await runFinalize(capturedEvents);

    expect(result.ok).toBe(true);
    expect(savedBeforeReportComplete).toBe(true);
    expect(saveReview).toHaveBeenCalledWith(expect.objectContaining({ durationMs: 42.5 }));
    expect(saveReview).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "snapshot-branch", commit: "snapshot-head" }),
    );
    expect(stepNames(capturedEvents, "step_complete")).toContain("report");
    expect(capturedEvents.filter((event) => event.type === "complete")).toHaveLength(1);
    expect(getSession("review-1")?.persistenceState).toBe("committed");
  });

  it("cancels before committing without saving a History entry", async () => {
    const events: FullReviewStreamEvent[] = [];

    const finalizing = runFinalize(events, (event) => {
      if (event.type === "step_start" && event.step === "report") {
        expect(cancelSessionForUser("review-1")).toBe("cancelled");
      }
    });

    await expect(finalizing).rejects.toBe("user_cancelled");
    expect(saveReview).not.toHaveBeenCalled();
    expect(getSession("review-1")?.events).toMatchObject([
      { type: "step_start", step: "report" },
      { type: "error", error: { code: ReviewErrorCode.CANCELLED } },
    ]);
    expect(
      getSession("review-1")?.events.filter((event) => event.type === "complete"),
    ).toHaveLength(0);
  });

  it("does not cancel after committing starts and emits one committed terminal outcome", async () => {
    const save = createDeferred<ReturnType<typeof ok<{ id: string }>>>();
    saveReview.mockReturnValue(save.promise);
    const events: FullReviewStreamEvent[] = [];
    const cancellationResults: string[] = [];

    const finalizing = runFinalize(events, (event) => {
      if (event.type === "step_complete" && event.step === "report") {
        cancellationResults.push(cancelSessionForUser("review-1"));
      }
    });
    await vi.waitFor(() => expect(saveReview).toHaveBeenCalledTimes(1));

    expect(getSession("review-1")?.persistenceState).toBe("committing");
    expect(cancelSessionForUser("review-1")).toBe("already-committed");
    expect(getSession("review-1")?.events.filter((event) => event.type === "error")).toHaveLength(
      0,
    );

    save.resolve(ok({ id: "review-1" }));
    await expect(finalizing).resolves.toMatchObject({ ok: true });

    expect(cancellationResults).toEqual(["already-committed"]);
    const terminalEvents = events.filter(
      (event) => event.type === "complete" || event.type === "error",
    );
    expect(terminalEvents).toHaveLength(1);
    expect(terminalEvents[0]).toMatchObject({ type: "complete", reviewId: "review-1" });
    expect(getSession("review-1")).toMatchObject({
      isComplete: true,
      persistenceState: "committed",
    });
  });

  it("keeps a committing save addressable under eviction pressure", async () => {
    const save = createDeferred<ReturnType<typeof ok<{ id: string }>>>();
    saveReview.mockReturnValue(save.promise);
    const events: FullReviewStreamEvent[] = [];
    const finalizing = runFinalize(events);
    await vi.waitFor(() => expect(saveReview).toHaveBeenCalledTimes(1));

    for (let index = 0; index < 50; index += 1) {
      const reviewId = `pressure-${index}`;
      auxiliarySessionIds.add(reviewId);
      createSession(reviewId, {
        projectPath: "/project",
        headCommit: "snapshot-head",
        statusHash: `status-${index}`,
        statusHashKind: "full",
        mode: "unstaged",
      });
    }

    expect(getSession("review-1")).toMatchObject({ persistenceState: "committing" });
    expect(getSession("review-1")?.events.filter((event) => event.type === "error")).toHaveLength(
      0,
    );
    expect(getSession("pressure-0")).toBeUndefined();

    save.resolve(ok({ id: "review-1" }));
    await expect(finalizing).resolves.toMatchObject({ ok: true });

    expect(saveReview).toHaveBeenCalledTimes(1);
    expect(events.filter((event) => event.type === "complete")).toHaveLength(1);
    expect(events.filter((event) => event.type === "error")).toHaveLength(0);
    expect(getSession("review-1")?.persistenceState).toBe("committed");
  });

  it("keeps a committing save addressable past the idle timeout", async () => {
    let activityTick = 0;
    const save = createDeferred<ReturnType<typeof ok<{ id: string }>>>();
    saveReview.mockReturnValue(save.promise);
    const events: FullReviewStreamEvent[] = [];
    const finalizing = runFinalize(events, undefined, () => activityTick);
    await vi.waitFor(() => expect(saveReview).toHaveBeenCalledTimes(1));

    activityTick = 30 * 60 * 1000 + 1;
    cleanupStaleSessions();

    expect(getSession("review-1")).toMatchObject({ persistenceState: "committing" });
    expect(events.filter((event) => event.type === "error")).toHaveLength(0);

    save.resolve(ok({ id: "review-1" }));
    await expect(finalizing).resolves.toMatchObject({ ok: true });

    expect(saveReview).toHaveBeenCalledTimes(1);
    expect(events.filter((event) => event.type === "complete")).toHaveLength(1);
    expect(events.filter((event) => event.type === "error")).toHaveLength(0);
    expect(getSession("review-1")?.persistenceState).toBe("committed");
  });
});
