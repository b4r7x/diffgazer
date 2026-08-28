import { err, ok } from "@diffgazer/core/result";
import type { LensStat } from "@diffgazer/core/schemas/events";
import {
  ExecutionReceiptSchema,
  type ExecutionResult,
  SELECTABLE_LENS_IDS,
} from "@diffgazer/core/schemas/review";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdmittedExecutionPlan } from "../../shared/lib/ai/admission/service.js";
import { toClientSafeAdmittedPlanJson } from "../../shared/lib/ai/admission/service.js";
import { buildExecutionResult } from "../../shared/lib/ai/client/generate.js";
import type { AIErrorDiagnostic } from "../../shared/lib/ai/types.js";
import { makeParsedDiff } from "./testing/factories.js";
import {
  authorizePipelineExecution,
  makePipelineFile,
  makePipelineIssue,
  pipelineAdmittedPlan,
  pipelineConfig,
} from "./testing/pipeline-fixtures.js";
import { createReviewExecutionContext } from "./types.js";

const orchestrateReview = vi.fn();
vi.mock("./engine/orchestrate.js", () => ({
  orchestrateReview: (...args: unknown[]) => orchestrateReview(...args),
}));
// Boundary mock: filesystem storage - executeReview never writes, but pipeline.js imports the module.
vi.mock("./storage/reviews.js", () => ({ saveReview: vi.fn() }));

import { executeReview } from "./pipeline.js";

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

function orchestrationSchemaFailure() {
  orchestrateReview.mockResolvedValue(
    err({ code: "PARSE_ERROR", message: "schema mismatch", lensStats: [] }),
  );
}

async function runExecuteReview(
  options: {
    plan?: AdmittedExecutionPlan;
    terminalExecutions?: readonly ExecutionResult[];
    terminalDiagnostics?: readonly AIErrorDiagnostic[];
    config?: ReturnType<typeof pipelineConfig>;
    signal?: AbortSignal;
  } = {},
) {
  const plan = options.plan ?? pipelineAdmittedPlan();
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
      terminalExecutions: options.terminalExecutions ?? [],
      terminalDiagnostics: options.terminalDiagnostics ?? [],
    },
    parsed: makeParsedDiff([makePipelineFile("a.ts")]),
    config: options.config ?? pipelineConfig(),
    emit: async () => undefined,
    executionContext: createReviewExecutionContext(authorization),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!result.ok) {
    throw new Error(`executeReview failed unexpectedly: ${result.error.code}`);
  }
  return result.value;
}

describe("admitted execution lifecycle", () => {
  afterEach(() => {
    orchestrateReview.mockReset();
  });

  it("persists the exact completed receipt outcome through execution", async () => {
    const plan = pipelineAdmittedPlan();
    orchestrationSuccess();

    const outcome = await runExecuteReview({ plan });

    expect(outcome.execution?.receipt).toMatchObject({
      outcome: "completed",
      configurationId: plan.configurationId,
      configurationRevision: plan.configurationRevision,
      modelId: plan.evidenceKey.modelId,
      limits: plan.limits,
    });
    expect(outcome.issues).toHaveLength(1);
  });

  it("persists the exact cancelled receipt outcome when execution aborts before orchestration", async () => {
    const outcome = await runExecuteReview({ signal: AbortSignal.abort() });

    expect(outcome.execution?.receipt.outcome).toBe("cancelled");
    expect(outcome.issues).toEqual([]);
    expect(orchestrateReview).not.toHaveBeenCalled();
  });

  it.each([
    ["transport-failed", { code: "AI_ERROR", message: "transport down" }],
    ["schema-failed", { code: "PARSE_ERROR", message: "schema mismatch" }],
  ] as const)("persists the exact %s receipt outcome for orchestration failures", async (receiptOutcome, error) => {
    orchestrateReview.mockResolvedValue(err({ ...error, lensStats: [] }));

    const outcome = await runExecuteReview();

    expect(outcome.execution?.receipt.outcome).toBe(receiptOutcome);
    expect(outcome.issues).toEqual([]);
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
    orchestrationSchemaFailure();

    const outcome = await runExecuteReview({
      plan,
      terminalExecutions: [schemaFailed, transportFailed],
      terminalDiagnostics: [schemaDiagnostic, transportDiagnostic],
    });

    expect(outcome.execution?.receipt.outcome).toBe("schema-failed");
    expect(outcome.terminalDiagnostic).toEqual(schemaDiagnostic);
    expect(outcome.execution?.receipt.scope).toBe("review");
    expect(outcome.execution?.receipt.dispatchCount).toBe(2);
    expect(outcome.execution?.receipt.attemptCount).toBe(3);
    expect(outcome.execution?.receipt.usage).toEqual({
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
    orchestrationSchemaFailure();

    const outcome = await runExecuteReview({
      plan,
      terminalExecutions: [transportFailed, schemaFailed],
      terminalDiagnostics: [transportDiagnostic, schemaDiagnostic],
    });

    expect(outcome.execution?.receipt.outcome).toBe("schema-failed");
    expect(outcome.terminalDiagnostic).toEqual(schemaDiagnostic);
    expect(outcome.execution?.receipt.attemptCount).toBe(3);
  });

  it("reports a bridge schema rejection as schema-failed when no dispatch receipt carries it", async () => {
    const plan = pipelineAdmittedPlan();
    const transportFailed = buildExecutionResult(plan, "transport-failed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:01.000Z",
      attemptCount: 1,
      usageAvailability: "unavailable",
    });
    orchestrationSchemaFailure();

    const outcome = await runExecuteReview({ plan, terminalExecutions: [transportFailed] });

    expect(outcome.execution?.receipt.outcome).toBe("schema-failed");
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
    orchestrateReview.mockResolvedValue(
      err({ code: "STREAM_ERROR", message: "unused", lensStats: [] }),
    );

    const outcome = await runExecuteReview({
      plan,
      terminalExecutions: [failureExecution],
      terminalDiagnostics: [terminalDiagnostic],
    });

    expect(outcome.execution?.receipt.outcome).toBe("transport-failed");
    expect(outcome.terminalDiagnostic).toEqual(terminalDiagnostic);
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

  it("stamps the review's own span and dispatch count on the completed receipt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T10:00:00.000Z"));
    const plan = pipelineAdmittedPlan();
    const dispatchExecution = buildExecutionResult(plan, "completed", {
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:04.000Z",
      usageAvailability: "reported",
      usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
      issues: [makePipelineIssue("1", "a.ts", "high")],
    });
    orchestrateReview.mockImplementation(async () => {
      vi.setSystemTime(new Date("2026-07-31T10:00:10.000Z"));
      return ok({
        issues: [makePipelineIssue("1", "a.ts", "high")],
        lensStats: [],
        droppedDuplicates: 0,
        droppedBelowThreshold: 0,
      });
    });

    const outcome = await runExecuteReview({ plan, terminalExecutions: [dispatchExecution] });
    vi.useRealTimers();

    expect(outcome.execution?.receipt.startedAt).toBe("2026-07-31T10:00:00.000Z");
    expect(outcome.execution?.receipt.finishedAt).toBe("2026-07-31T10:00:10.000Z");
    expect(outcome.execution?.receipt.scope).toBe("review");
    expect(outcome.execution?.receipt.dispatchCount).toBe(1);
    expect(outcome.execution?.receipt.outcome).toBe("completed");
  });

  it("sums retry counts across the five default lenses", async () => {
    const plan = pipelineAdmittedPlan();
    const dispatches = SELECTABLE_LENS_IDS.map((_, index) =>
      buildExecutionResult(plan, "completed", {
        startedAt: `2026-07-31T10:00:0${index}.000Z`,
        finishedAt: `2026-07-31T10:00:0${index + 1}.000Z`,
        attemptCount: 2,
        usageAvailability: "unavailable",
      }),
    );
    orchestrationSuccess();

    const outcome = await runExecuteReview({
      plan,
      terminalExecutions: dispatches,
      config: {
        ...pipelineConfig(),
        activeLenses: [...SELECTABLE_LENS_IDS],
        concurrency: SELECTABLE_LENS_IDS.length,
      },
    });

    expect(outcome.execution?.receipt.attemptCount).toBe(10);
    expect(outcome.execution?.receipt.dispatchCount).toBe(5);
  });

  it("parses the 6-dispatch incident receipt whose summed usage exceeds the per-call input limit", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T10:00:00.000Z"));
    const plan = pipelineAdmittedPlan();
    const dispatches = Array.from({ length: 6 }, (_, index) =>
      buildExecutionResult(plan, "completed", {
        startedAt: `2026-07-31T10:00:0${index}.000Z`,
        finishedAt: `2026-07-31T10:00:0${index + 1}.000Z`,
        attemptCount: index === 5 ? 2 : 1,
        usageAvailability: "reported",
        usage: { inputTokens: 39_000, outputTokens: 500, totalTokens: 39_500 },
      }),
    );
    orchestrateReview.mockImplementation(async () => {
      vi.setSystemTime(new Date("2026-07-31T10:05:00.000Z"));
      return ok({
        issues: [makePipelineIssue("1", "a.ts", "high")],
        lensStats: [],
        droppedDuplicates: 0,
        droppedBelowThreshold: 0,
      });
    });

    const outcome = await runExecuteReview({ plan, terminalExecutions: dispatches });
    vi.useRealTimers();

    const receipt = outcome.execution?.receipt;
    expect(() => ExecutionReceiptSchema.parse(receipt)).not.toThrow();
    expect(receipt?.outcome).toBe("completed");
    expect(receipt?.scope).toBe("review");
    expect(receipt?.dispatchCount).toBe(6);
    expect(receipt?.attemptCount).toBe(7);
    expect(receipt?.usage?.inputTokens).toBe(234_000);
    expect(receipt?.startedAt).toBe("2026-07-31T10:00:00.000Z");
    expect(receipt?.finishedAt).toBe("2026-07-31T10:05:00.000Z");
  });

  it("keeps the timed-out outcome decisive when four completed dispatches sum past the per-call input limit", async () => {
    const plan = pipelineAdmittedPlan();
    const completedDispatches = Array.from({ length: 4 }, (_, index) =>
      buildExecutionResult(plan, "completed", {
        startedAt: `2026-07-31T10:00:0${index}.000Z`,
        finishedAt: `2026-07-31T10:00:0${index + 1}.000Z`,
        attemptCount: 1,
        usageAvailability: "reported",
        usage: { inputTokens: 39_000, outputTokens: 500, totalTokens: 39_500 },
      }),
    );
    const timedOut = buildExecutionResult(plan, "timed-out", {
      startedAt: "2026-07-31T10:00:04.000Z",
      finishedAt: "2026-07-31T10:00:44.000Z",
      attemptCount: 1,
      usageAvailability: "unavailable",
    });
    const timedOutDiagnostic = {
      code: "timed-out",
      safeMessage: "Lens dispatch timed out after 40s",
      retryable: true,
      remediation: "Retry the review.",
      correlationId: "timed-out-correlation",
    };
    orchestrateReview.mockResolvedValue(
      err({ code: "STREAM_ERROR", message: "lens timed out", lensStats: [] }),
    );

    const outcome = await runExecuteReview({
      plan,
      terminalExecutions: [...completedDispatches, timedOut],
      terminalDiagnostics: [timedOutDiagnostic],
    });

    const receipt = outcome.execution?.receipt;
    expect(() => ExecutionReceiptSchema.parse(receipt)).not.toThrow();
    expect(receipt?.outcome).toBe("timed-out");
    expect(receipt?.scope).toBe("review");
    expect(receipt?.dispatchCount).toBe(5);
    expect(receipt?.attemptCount).toBe(5);
    expect(receipt?.usage?.inputTokens).toBe(156_000);
    expect(outcome.terminalDiagnostic).toEqual(timedOutDiagnostic);
  });

  it("persists per-lens stats in the failure outcome when every lens failed", async () => {
    const lensStats: LensStat[] = [
      {
        lensId: "correctness",
        issueCount: 0,
        status: "failed",
        errorCode: "STREAM_ERROR",
        errorMessage: "provider stream dropped",
        dispatches: [
          {
            batchIndex: 0,
            startedAt: "2026-07-31T10:00:00.000Z",
            finishedAt: "2026-07-31T10:00:40.000Z",
            outcome: "STREAM_ERROR",
          },
        ],
      },
    ];
    orchestrateReview.mockResolvedValue(
      err({ code: "STREAM_ERROR", message: "provider stream dropped", lensStats }),
    );

    const outcome = await runExecuteReview();

    expect(outcome.lensStats).toEqual(lensStats);
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
    orchestrationSuccess();

    const outcome = await runExecuteReview({
      plan,
      terminalExecutions: [completed, budgetExhausted],
    });

    expect(outcome.execution?.receipt.outcome).toBe("budget-exhausted");
    // The lens that settled inside the budget keeps its findings; the dispatch
    // that ran out never returned any, so its own receipt result stays empty.
    expect(outcome.issues).toHaveLength(1);
    expect(outcome.execution?.result.issues).toEqual([]);
    expect(outcome.execution?.receipt.usage).toEqual({
      inputTokens: 15,
      outputTokens: 6,
      totalTokens: 21,
      cachedTokens: 3,
      reasoningTokens: 2,
    });
  });

  it("keeps the honest orchestration span past the per-dispatch limit and keeps completed findings", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T10:00:00.000Z"));
    orchestrateReview.mockImplementation(async () => {
      // Longer than the 5-minute per-dispatch wallTimeMs, inside the review ceiling.
      vi.setSystemTime(new Date("2026-07-31T10:05:30.000Z"));
      return ok({
        issues: [makePipelineIssue("1", "a.ts", "high")],
        lensStats: [],
        droppedDuplicates: 0,
        droppedBelowThreshold: 0,
      });
    });

    const outcome = await runExecuteReview();
    vi.useRealTimers();

    expect(outcome.execution?.receipt.outcome).toBe("completed");
    expect(outcome.execution?.receipt.startedAt).toBe("2026-07-31T10:00:00.000Z");
    expect(outcome.execution?.receipt.finishedAt).toBe("2026-07-31T10:05:30.000Z");
    expect(outcome.issues).toHaveLength(1);
  });

  it("exposes no secret values on the client-safe admitted plan surface", () => {
    // The sentinel has to be something the plan actually carries: the credential
    // resolver lives on the authorization, which this surface never sees.
    const credentialSentinel = `credential-sentinel-${"9".repeat(44)}`;
    const base = pipelineAdmittedPlan();
    const plan = Object.freeze({
      ...base,
      evidenceKey: Object.freeze({
        ...base.evidenceKey,
        credentialReferenceIdentity: credentialSentinel,
      }),
    });
    const clientSurface = toClientSafeAdmittedPlanJson(plan);

    expect(clientSurface).not.toContain(credentialSentinel);
    expect(clientSurface).not.toContain("credential");
    expect(clientSurface).toContain(plan.executionFingerprint);
    expect(JSON.parse(clientSurface)).toHaveProperty("evidenceKeyHash");
  });
});

describe("admitted execution usage aggregation", () => {
  afterEach(() => {
    orchestrateReview.mockReset();
  });

  const usageCases = [
    {
      name: "keeps a partial input-only usage report input-only",
      orchestration: "success",
      dispatches: (plan: AdmittedExecutionPlan) => [
        buildExecutionResult(plan, "completed", {
          startedAt: "2026-07-31T10:00:00.000Z",
          finishedAt: "2026-07-31T10:00:01.000Z",
          usageAvailability: "reported",
          usage: { inputTokens: 12 },
        }),
      ],
      receipt: { outcome: "completed", usageAvailability: "reported", dispatchCount: 1 },
      usage: { inputTokens: 12 },
      issueCount: 1,
    },
    {
      name: "does not report a total-only usage aggregate",
      orchestration: "success",
      dispatches: (plan: AdmittedExecutionPlan) => [
        buildExecutionResult(plan, "completed", {
          startedAt: "2026-07-31T10:00:00.000Z",
          finishedAt: "2026-07-31T10:00:01.000Z",
          usageAvailability: "reported",
          usage: { totalTokens: 12 },
        }),
      ],
      receipt: { outcome: "completed", usageAvailability: "unavailable", dispatchCount: 1 },
      usage: undefined,
      issueCount: 1,
    },
    {
      name: "sums cached and reasoning usage components independently",
      orchestration: "success",
      dispatches: (plan: AdmittedExecutionPlan) => [
        buildExecutionResult(plan, "completed", {
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
        }),
        buildExecutionResult(plan, "completed", {
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
        }),
      ],
      receipt: { outcome: "completed", usageAvailability: "reported", dispatchCount: 2 },
      usage: {
        inputTokens: 12,
        outputTokens: 11,
        totalTokens: 23,
        cachedTokens: 4,
        reasoningTokens: 3,
      },
      issueCount: 1,
    },
    {
      name: "preserves earlier reported usage when a later dispatch is unavailable",
      orchestration: "success",
      dispatches: (plan: AdmittedExecutionPlan) => [
        buildExecutionResult(plan, "completed", {
          startedAt: "2026-07-31T10:00:00.000Z",
          finishedAt: "2026-07-31T10:00:01.000Z",
          usageAvailability: "reported",
          usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
        }),
        buildExecutionResult(plan, "completed", {
          startedAt: "2026-07-31T10:00:02.000Z",
          finishedAt: "2026-07-31T10:00:03.000Z",
          attemptCount: 2,
          usageAvailability: "unavailable",
        }),
      ],
      receipt: {
        outcome: "completed",
        usageAvailability: "reported",
        dispatchCount: 2,
        attemptCount: 3,
      },
      usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
      issueCount: 1,
    },
    {
      name: "aggregates reported usage from failed and completed dispatches",
      orchestration: "success",
      dispatches: (plan: AdmittedExecutionPlan) => [
        buildExecutionResult(plan, "schema-failed", {
          startedAt: "2026-07-31T10:00:00.000Z",
          finishedAt: "2026-07-31T10:00:01.000Z",
          usageAvailability: "reported",
          usage: { inputTokens: 7, outputTokens: 3, totalTokens: 10 },
        }),
        buildExecutionResult(plan, "completed", {
          startedAt: "2026-07-31T10:00:02.000Z",
          finishedAt: "2026-07-31T10:00:03.000Z",
          usageAvailability: "reported",
          usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
        }),
      ],
      receipt: {
        outcome: "completed",
        usageAvailability: "reported",
        scope: "review",
        dispatchCount: 2,
        attemptCount: 2,
      },
      usage: { inputTokens: 12, outputTokens: 5, totalTokens: 17 },
      issueCount: 1,
    },
    {
      name: "marks usage unavailable when no completed dispatch reported it",
      orchestration: "success",
      dispatches: (plan: AdmittedExecutionPlan) => [
        buildExecutionResult(plan, "completed", {
          startedAt: "2026-07-31T10:00:00.000Z",
          finishedAt: "2026-07-31T10:00:01.000Z",
          usageAvailability: "unavailable",
          issues: [],
        }),
        buildExecutionResult(plan, "completed", {
          startedAt: "2026-07-31T10:00:00.000Z",
          finishedAt: "2026-07-31T10:00:03.000Z",
          usageAvailability: "unavailable",
          issues: [],
        }),
      ],
      receipt: { outcome: "completed", usageAvailability: "unavailable", dispatchCount: 2 },
      usage: undefined,
      issueCount: 1,
    },
    {
      name: "marks all-failed total-only usage as unavailable",
      orchestration: "schema-failure",
      dispatches: (plan: AdmittedExecutionPlan) => [
        buildExecutionResult(plan, "schema-failed", {
          startedAt: "2026-07-31T10:00:00.000Z",
          finishedAt: "2026-07-31T10:00:01.000Z",
          usageAvailability: "reported",
          usage: { totalTokens: 10 },
        }),
        buildExecutionResult(plan, "transport-failed", {
          startedAt: "2026-07-31T10:00:02.000Z",
          finishedAt: "2026-07-31T10:00:03.000Z",
          usageAvailability: "reported",
          usage: { totalTokens: 7 },
        }),
      ],
      receipt: { outcome: "schema-failed", usageAvailability: "unavailable", dispatchCount: 2 },
      usage: undefined,
      issueCount: 0,
    },
  ] as const;

  it.each(usageCases)("$name", async ({
    orchestration,
    dispatches,
    receipt,
    usage,
    issueCount,
  }) => {
    const plan = pipelineAdmittedPlan();
    if (orchestration === "success") {
      orchestrationSuccess();
    } else {
      orchestrationSchemaFailure();
    }

    const outcome = await runExecuteReview({ plan, terminalExecutions: dispatches(plan) });

    expect(outcome.execution?.receipt).toMatchObject(receipt);
    expect(outcome.execution?.receipt.usage).toEqual(usage);
    expect(outcome.issues).toHaveLength(issueCount);
  });
});
