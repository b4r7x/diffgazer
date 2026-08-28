import { err, ok } from "@diffgazer/core/result";
import type { HostedApiProductId, SettingsConfig } from "@diffgazer/core/schemas/config";
import type { FullReviewStreamEvent, LensStat } from "@diffgazer/core/schemas/events";
import {
  type ExecutionLimits,
  REVIEW_WALL_CEILING_SLACK,
  ReviewErrorCode,
  SELECTABLE_LENS_IDS,
} from "@diffgazer/core/schemas/review";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExecutionLeaseRegistry } from "../../shared/lib/ai/admission/lease-registry.js";
import type { AdmittedExecutionPlan } from "../../shared/lib/ai/admission/service.js";
import { createBudgetLedger } from "../../shared/lib/ai/budget/ledger.js";
import { buildExecutionResult } from "../../shared/lib/ai/client/generate.js";
import { makeParsedDiff } from "./testing/factories.js";
import {
  makePipelineFile,
  makePipelineIssue,
  pipelineAdmittedPlan,
  pipelineConfig,
} from "./testing/pipeline-fixtures.js";
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

describe("resolveReviewDefaults", () => {
  const baseSettings: SettingsConfig = {
    theme: "auto",
    secretsStorage: null,
    defaultLenses: ["correctness", "security"],
    effectiveCallTokenCap: 49_152,
    defaultProfile: null,
    severityThreshold: "low",
    agentExecution: "sequential",
    providerConsent: null,
  };

  it("uses validated settings defaults when explicit lenses are empty", () => {
    const settings: SettingsConfig = {
      theme: "auto",
      defaultLenses: ["security"],
      effectiveCallTokenCap: 49_152,
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
    expect(defaults.activeLenses).toHaveLength(SELECTABLE_LENS_IDS.length);
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
    orchestrateReview.mockResolvedValue(
      err({ code: "NO_DIFF", message: "No files changed", lensStats: [] }),
    );
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

const ENVELOPE_BASE_LIMITS: ExecutionLimits = Object.freeze({
  maxInputTokens: 200_000,
  maxResponseBytes: 8_000_000,
  wallTimeMs: 300_000,
  maxRetries: 1,
  maxConcurrency: 2,
  maxCostUsd: 5,
});

function authorizeAtBaseEnvelope(modelId?: string, productId: HostedApiProductId = "gemini") {
  const base = pipelineAdmittedPlan(productId);
  const plan: AdmittedExecutionPlan = Object.freeze({
    ...base,
    evidenceKey: Object.freeze({
      ...base.evidenceKey,
      modelId: modelId ?? base.evidenceKey.modelId,
      limits: ENVELOPE_BASE_LIMITS,
    }),
    limits: ENVELOPE_BASE_LIMITS,
  });
  const ledger = createBudgetLedger(ENVELOPE_BASE_LIMITS);
  // Admission reserves the whole envelope up front, and every dispatch draws on
  // that one standing reservation — so a raise has to grow it, not open another.
  const reservation = ledger.reserveAttempt({
    inputTokens: ENVELOPE_BASE_LIMITS.maxInputTokens,
    responseBytes: ENVELOPE_BASE_LIMITS.maxResponseBytes,
    wallTimeMs: ENVELOPE_BASE_LIMITS.wallTimeMs,
    costUsd: 0,
  });
  if (!reservation.ok) throw new Error("budget reservation failed in test setup");
  const lease = new ExecutionLeaseRegistry().tryAcquire({
    configurationId: plan.configurationId,
    configurationRevision: plan.configurationRevision,
    executionFingerprint: plan.executionFingerprint,
    limits: plan.limits,
  });
  if (!lease.ok) throw new Error("lease acquisition failed in test setup");
  return {
    ledger,
    authorization: Object.freeze({
      plan,
      adapter: {
        productId,
        transportFamily: "hosted-api" as const,
        execute: vi.fn(),
      },
      evidenceState: "proven" as const,
      budgetLedger: ledger,
      budgetReservation: reservation.value,
      lease: lease.value,
      resolveCredential: async () => "super-secret-token",
      release: () => {
        ledger.releaseReservation(reservation.value);
        lease.value.release();
      },
    }),
  };
}

function capacityPlan(batchCount: number, estimatedTotalInputTokens: number) {
  return {
    batches: Array.from({ length: batchCount }, (_, index) =>
      makeParsedDiff([makePipelineFile(`batch-${index}.ts`)]),
    ),
    perCallBudgetTokens: 49_152,
    estimatedTotalInputTokens,
    warning: null,
  };
}

describe("batched review budget envelope", () => {
  afterEach(() => {
    orchestrateReview.mockReset();
  });

  it("opens the reservation at the scaled envelope for a multi-batch plan", async () => {
    const { authorization, ledger } = authorizeAtBaseEnvelope();
    orchestrationSuccess();

    await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      capacity: capacityPlan(2, 1_000_000),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    const snapshot = ledger.snapshot();
    expect(snapshot.limits.maxInputTokens).toBe(1_200_000);
    // One lens over two batches plus synthesis, sequentially, under the slack.
    expect(snapshot.limits.wallTimeMs).toBe(Math.ceil(300_000 * 3 * REVIEW_WALL_CEILING_SLACK));
    expect(snapshot.reserved.inputTokens).toBe(1_200_000);
    expect(snapshot.reserved.wallTimeMs).toBe(snapshot.limits.wallTimeMs);
  });

  it("raises only the wall clock for a single-batch plan", async () => {
    const { authorization, ledger } = authorizeAtBaseEnvelope();
    orchestrationSuccess();

    await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      capacity: capacityPlan(1, 1_000_000),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    const snapshot = ledger.snapshot();
    expect(snapshot.limits.maxInputTokens).toBe(200_000);
    // The size axes stay at the configured base, but the wall dimension is the
    // whole-review elapsed clock: one call for the single lens, under the slack.
    expect(snapshot.limits.wallTimeMs).toBe(Math.ceil(300_000 * REVIEW_WALL_CEILING_SLACK));
    expect(snapshot.reserved.inputTokens).toBe(200_000);
    expect(snapshot.reserved.wallTimeMs).toBe(snapshot.limits.wallTimeMs);
  });

  it("refuses a batched plan whose worst case runs past the per-review spend cap", async () => {
    const { authorization, ledger } = authorizeAtBaseEnvelope("gemini-2.5-pro");
    orchestrationSuccess();

    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      capacity: capacityPlan(6, 3_000_000),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(ReviewErrorCode.DIFF_TOO_LARGE);
    expect(result.error.message).toContain("spend cap");
    // The review step is already in flight when this refusal is raised, so it is
    // the step the surfaces must resolve.
    expect(result.error.step).toBe("review");
    expect(orchestrateReview).not.toHaveBeenCalled();
    expect(ledger.snapshot().limits.maxInputTokens).toBe(200_000);
  });

  it("dispatches the plan's batches through the orchestration options", async () => {
    const { authorization } = authorizeAtBaseEnvelope();
    orchestrationSuccess();
    const capacity = capacityPlan(3, 900_000);

    await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      capacity,
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(orchestrateReview.mock.calls[0]?.[4]).toMatchObject({ batches: capacity.batches });
  });
});

function fiveLensConfig(concurrency: number) {
  return {
    ...pipelineConfig(),
    activeLenses: [...SELECTABLE_LENS_IDS],
    concurrency,
  };
}

describe("review wall clock sizing and concurrency clamp", () => {
  afterEach(() => {
    orchestrateReview.mockReset();
    vi.useRealTimers();
  });

  it("sizes the wall clock for every call of a multi-batch plan at sequential concurrency", async () => {
    const { authorization, ledger } = authorizeAtBaseEnvelope();
    orchestrationSuccess();

    await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      capacity: capacityPlan(2, 100_000),
      config: fiveLensConfig(1),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    // Five lenses over two batches plus one synthesis = 11 sequential calls.
    expect(ledger.snapshot().limits.wallTimeMs).toBe(
      Math.ceil(300_000 * 11 * REVIEW_WALL_CEILING_SLACK),
    );
  });

  it("sizes the single-batch wall clock at one call per lens, without synthesis", async () => {
    const { authorization, ledger } = authorizeAtBaseEnvelope();
    orchestrationSuccess();

    await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      capacity: capacityPlan(1, 100_000),
      config: fiveLensConfig(1),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(ledger.snapshot().limits.wallTimeMs).toBe(
      Math.ceil(300_000 * 5 * REVIEW_WALL_CEILING_SLACK),
    );
  });

  it("hands the orchestration the admitted per-dispatch wall the wait heartbeat names", async () => {
    const { authorization } = authorizeAtBaseEnvelope();
    orchestrationSuccess();

    await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: fiveLensConfig(1),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(orchestrateReview.mock.calls[0]?.[4]).toMatchObject({
      dispatchWallTimeMs: authorization.plan.limits.wallTimeMs,
    });
  });

  it("clamps parallel execution to the provider profile and reports the requested concurrency", async () => {
    const { authorization, ledger } = authorizeAtBaseEnvelope("glm-4.5-flash", "zai");
    orchestrationSuccess();

    await executeReview({
      aiClient: {
        provider: "zai",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      capacity: capacityPlan(2, 100_000),
      config: fiveLensConfig(5),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(orchestrateReview.mock.calls[0]?.[4]).toMatchObject({
      concurrency: 1,
      requestedConcurrency: 5,
    });
    // The clamped-to-1 provider gets the full sequential clock.
    expect(ledger.snapshot().limits.wallTimeMs).toBe(
      Math.ceil(300_000 * 11 * REVIEW_WALL_CEILING_SLACK),
    );
  });

  it("runs paid zai models parallel and still sizes the clock for the sequential worst case", async () => {
    const { authorization, ledger } = authorizeAtBaseEnvelope("glm-5.2", "zai");
    orchestrationSuccess();

    await executeReview({
      aiClient: {
        provider: "zai",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      capacity: capacityPlan(2, 100_000),
      config: fiveLensConfig(5),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(orchestrateReview.mock.calls[0]?.[4]).toMatchObject({ concurrency: 5 });
    expect(orchestrateReview.mock.calls[0]?.[4]).not.toHaveProperty("requestedConcurrency");
    expect(ledger.snapshot().limits.wallTimeMs).toBe(
      Math.ceil(300_000 * 11 * REVIEW_WALL_CEILING_SLACK),
    );
  });

  it("leaves parallel execution unclamped for a provider without pacing", async () => {
    const { authorization } = authorizeAtBaseEnvelope();
    orchestrationSuccess();

    await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: fiveLensConfig(5),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(orchestrateReview.mock.calls[0]?.[4]).toMatchObject({ concurrency: 5 });
    expect(orchestrateReview.mock.calls[0]?.[4]).not.toHaveProperty("requestedConcurrency");
  });

  it("forces the budget-exhausted outcome with the elapsed wall message when the clock expires", async () => {
    vi.useFakeTimers();
    const { authorization } = authorizeAtBaseEnvelope();
    const cancelledDispatch = buildExecutionResult(authorization.plan, "cancelled", {
      attemptCount: 1,
    });
    orchestrateReview.mockImplementation(async () => {
      vi.advanceTimersByTime(400_000);
      return err({ code: "CANCELLED", message: "Cancelled", lensStats: [] });
    });

    const result = await executeReview({
      aiClient: {
        provider: "gemini",
        generate: async () => err({ code: "MODEL_ERROR", message: "unused" }),
        authorization,
        terminalExecutions: [cancelledDispatch],
      },
      parsed: makeParsedDiff([makePipelineFile("a.ts")]),
      config: pipelineConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The dispatch receipt honestly says cancelled (mechanism); the review-level
    // outcome names the cause with the operative raised limit, not the 300s base.
    expect(cancelledDispatch.receipt.outcome).toBe("cancelled");
    expect(result.value.execution?.receipt.outcome).toBe("budget-exhausted");
    expect(result.value.terminalDiagnostic?.code).toBe("budget-exhausted");
    expect(result.value.terminalDiagnostic?.safeMessage).toBe(
      "Review wall-clock budget exhausted: 400s elapsed of 360s allowed.",
    );
  });

  it("disposes the review clock after a completed run", async () => {
    vi.useFakeTimers();
    const { authorization } = authorizeAtBaseEnvelope();
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
    expect(result.value.execution?.receipt.outcome).toBe("completed");
    expect(vi.getTimerCount()).toBe(0);
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

  it("keeps the findings a cancelled review already streamed", async () => {
    saveReview.mockResolvedValue(ok({ id: "review-1" }));
    const issues = [makePipelineIssue("partial", "a.ts", "high")];
    const execution = buildExecutionResult(pipelineAdmittedPlan(), "cancelled", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:02.000Z",
      attemptCount: 1,
      usageAvailability: "unavailable",
    });

    await runFinalize([], undefined, undefined, { issues, execution });

    expect(saveReview).toHaveBeenCalledWith(expect.objectContaining({ result: { issues } }));
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
      message: "Hosted adapter timed out after handshake Retry after checking provider status.",
    });
    expect(saveReview).toHaveBeenCalledWith(expect.objectContaining({ execution }));
  });

  it("names the schema failure and the way out, without the fail-fast memo sentence, when it carries no diagnostic", async () => {
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
      message:
        "This model could not produce Diffgazer's structured review output. Change the model or update the configuration.",
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
      message:
        "Groq rejected the credential (HTTP 401). Update the configuration with a valid API key.",
    });
  });

  it("names Sequential mode in the abort message when every lens died rate-limited", async () => {
    saveReview.mockResolvedValue(ok({ id: "review-1" }));
    const execution = buildExecutionResult(pipelineAdmittedPlan(), "transport-failed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:02.000Z",
      attemptCount: 1,
      usageAvailability: "unavailable",
    });
    const terminalDiagnostic = {
      code: "provider-rejected",
      safeMessage: "Z.AI rate limited the request (HTTP 429).",
      retryable: true,
      remediation:
        "Wait and retry. If Agent Execution is set to Parallel, switching it to Sequential can help.",
      correlationId: "rate-limited-correlation",
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
      message:
        "Z.AI rate limited the request (HTTP 429). Wait and retry. If Agent Execution is set to Parallel, switching it to Sequential can help.",
    });
    expect(result.error.message).toContain("Sequential");
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
