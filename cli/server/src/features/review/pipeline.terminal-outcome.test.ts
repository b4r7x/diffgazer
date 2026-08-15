import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { ok } from "@diffgazer/core/result";
import {
  type EvidenceKey,
  type ExecutionLimits,
  type ExecutionResult,
  ExecutionResultSchema,
  hashExecutionReceiptFingerprintSync,
  type NormalizedUsage,
  type TerminalOutcome,
} from "@diffgazer/core/schemas/review";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdmittedExecutionPlan } from "../../shared/lib/ai/admission/service.js";
import { ExecutionLeaseRegistry } from "../../shared/lib/ai/admission/service.js";
import { createBudgetLedger } from "../../shared/lib/ai/budget/ledger.js";
import { toInitializedAIClient } from "../../shared/lib/ai/client/initialize.js";
import type { Adapter } from "../../shared/lib/ai/types.js";
import { assertTempHome } from "../../shared/lib/testing/temp-home.js";
import { makeFileDiff, makeParsedDiff } from "./testing/factories.js";
import { createReviewExecutionContext } from "./types.js";

const saveReview = vi.fn();
// Boundary mock: filesystem storage — this suite asserts what reaches the durable write.
vi.mock("./storage/reviews.js", () => ({
  saveReview: (...args: unknown[]) => saveReview(...args),
}));

import { executeReview, finalizeReview } from "./pipeline.js";
import { createSession, deleteSessionForTests } from "./stream/store.js";

const LIMITS: ExecutionLimits = Object.freeze({
  maxInputTokens: 40_000,
  maxOutputTokens: 8_000,
  maxResponseBytes: 8_000_000,
  wallTimeMs: 300_000,
  maxRetries: 1,
  maxConcurrency: 2,
  maxCostUsd: 5,
});

const REPORTED_USAGE: NormalizedUsage = Object.freeze({
  inputTokens: 120,
  outputTokens: 40,
  totalTokens: 160,
});

function evidenceKey(): EvidenceKey {
  const product = PRODUCT_REGISTRY.gemini;
  const endpoint = product.configuration.endpoints[0];
  return {
    authentication: null,
    credentialReferenceIdentity: "c".repeat(64),
    installationId: null,
    productId: "gemini",
    transportFamily: "hosted-api",
    normalizedEndpoint: endpoint?.endpoint ?? "https://example.invalid/v1",
    region: null,
    workspaceAccountReference: null,
    modelId: "gemini-2.5-flash",
    runtime: { identity: "diffgazer-server", version: "1.0.0" },
    structuredOutputSchemaSha256: "a".repeat(64),
    noticeVersion: product.notice.noticeVersion,
    limits: LIMITS,
  };
}

function admittedPlan(): AdmittedExecutionPlan {
  return Object.freeze({
    configurationId: "gemini-primary",
    configurationRevision: 3,
    executionFingerprint: "admitted-fingerprint-terminal",
    evidenceKey: Object.freeze(evidenceKey()),
    productId: "gemini",
    transportFamily: "hosted-api",
    limits: LIMITS,
  });
}

function adapterExecution(plan: AdmittedExecutionPlan, outcome: TerminalOutcome): ExecutionResult {
  const { evidenceKey: key } = plan;
  return ExecutionResultSchema.parse({
    receipt: {
      schemaVersion: 1,
      executionFingerprint: hashExecutionReceiptFingerprintSync({
        configurationId: plan.configurationId,
        configurationRevision: plan.configurationRevision,
        authentication: key.authentication,
        credentialReferenceIdentity: key.credentialReferenceIdentity,
        installationId: key.installationId,
        productId: key.productId,
        transportFamily: key.transportFamily,
        modelId: key.modelId,
        normalizedEndpoint: key.normalizedEndpoint,
        region: key.region,
        workspaceAccountReference: key.workspaceAccountReference,
        runtime: key.runtime,
        structuredOutputSchemaSha256: key.structuredOutputSchemaSha256,
        noticeVersion: key.noticeVersion,
        limits: plan.limits,
      }),
      configurationId: plan.configurationId,
      configurationRevision: plan.configurationRevision,
      authentication: key.authentication,
      credentialReferenceIdentity: key.credentialReferenceIdentity,
      installationId: key.installationId,
      productId: key.productId,
      transportFamily: key.transportFamily,
      modelId: key.modelId,
      normalizedEndpoint: key.normalizedEndpoint,
      region: key.region ?? undefined,
      runtime: key.runtime,
      structuredOutputSchemaSha256: key.structuredOutputSchemaSha256,
      noticeVersion: key.noticeVersion,
      limits: plan.limits,
      attemptCount: 1,
      startedAt: "2026-07-31T10:00:00.000Z",
      finishedAt: "2026-07-31T10:00:01.000Z",
      usage: REPORTED_USAGE,
      usageAvailability: "reported",
      outcome,
    },
    result: { issues: [] },
  });
}

function authorizedClient(plan: AdmittedExecutionPlan, outcome: TerminalOutcome) {
  const adapter: Adapter = {
    productId: plan.productId,
    transportFamily: plan.transportFamily,
    execute: async () => adapterExecution(plan, outcome),
  };
  const budgetLedger = createBudgetLedger(plan.limits);
  const budgetReservation = budgetLedger.reserveAttempt({
    inputTokens: plan.limits.maxInputTokens,
    outputTokens: plan.limits.maxOutputTokens,
    responseBytes: plan.limits.maxResponseBytes,
    wallTimeMs: plan.limits.wallTimeMs,
    costUsd: plan.limits.maxCostUsd,
  });
  if (!budgetReservation.ok) throw new Error("budget reservation failed in test setup");
  const lease = new ExecutionLeaseRegistry().tryAcquire({
    configurationId: plan.configurationId,
    configurationRevision: plan.configurationRevision,
    executionFingerprint: plan.executionFingerprint,
    limits: plan.limits,
  });
  if (!lease.ok) throw new Error("lease acquisition failed in test setup");

  const authorization = Object.freeze({
    plan,
    adapter,
    evidenceState: "proven" as const,
    budgetLedger,
    budgetReservation: budgetReservation.value,
    lease: lease.value,
    resolveCredential: async () => "terminal-outcome-secret",
    workspaceAccountId: null,
    release: () => lease.value.release(),
  });
  return { client: toInitializedAIClient(authorization), authorization };
}

function reviewConfig() {
  return {
    activeLenses: ["correctness" as const],
    effectiveProfileId: undefined,
    profile: undefined,
    severityFilter: undefined,
    concurrency: 1,
    projectContext: "",
  };
}

let diffgazerHome: string;

beforeEach(() => {
  diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-terminal-outcome-"));
  assertTempHome(diffgazerHome);
  process.env.DIFFGAZER_HOME = diffgazerHome;
  saveReview.mockReset();
  saveReview.mockResolvedValue(ok({ id: "review-terminal" }));
});

// Nothing here reaches the config store or the review store — `saveReview` is mocked and
// `toInitializedAIClient` is pure — so the temp home only has to fall before
// DIFFGAZER_HOME is dropped, which `paths.ts` re-reads on every call.
afterEach(() => {
  rmSync(diffgazerHome, { recursive: true, force: true });
  delete process.env.DIFFGAZER_HOME;
  deleteSessionForTests("review-terminal");
});

describe("terminal adapter outcomes reach the review receipt", () => {
  it.each([
    "cancelled",
    "budget-exhausted",
  ] as const)("carries a %s adapter receipt and its reported usage through the review", async (outcome) => {
    const plan = admittedPlan();
    const { client, authorization } = authorizedClient(plan, outcome);

    const result = await executeReview({
      aiClient: client,
      parsed: makeParsedDiff([makeFileDiff({ filePath: "a.ts", rawDiff: "+const a = 1;" })]),
      config: reviewConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(client.terminalExecutions).toHaveLength(1);
    expect(result.value.execution?.receipt.outcome).toBe(outcome);
    expect(result.value.execution?.receipt.usageAvailability).toBe("reported");
    expect(result.value.execution?.receipt.usage).toEqual(REPORTED_USAGE);
    expect(result.value.issues).toEqual([]);
  });

  it("persists a non-completed terminal receipt before reporting the failure", async () => {
    const plan = admittedPlan();
    const { client, authorization } = authorizedClient(plan, "cancelled");
    const executed = await executeReview({
      aiClient: client,
      parsed: makeParsedDiff([makeFileDiff({ filePath: "a.ts", rawDiff: "+const a = 1;" })]),
      config: reviewConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });
    expect(executed.ok).toBe(true);
    if (!executed.ok) return;

    const session = createSession("review-terminal", {
      projectPath: "/project",
      headCommit: "head",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
    });

    const finalized = await finalizeReview({
      outcome: executed.value,
      emit: async () => undefined,
      reviewId: "review-terminal",
      projectPath: "/project",
      mode: "unstaged",
      parsed: makeParsedDiff([makeFileDiff({ filePath: "a.ts", rawDiff: "+const a = 1;" })]),
      activeLenses: ["correctness"],
      durationMs: 10,
      branch: null,
      headCommit: "head",
      signal: session.controller.signal,
    });

    expect(saveReview).toHaveBeenCalledWith(
      expect.objectContaining({
        execution: expect.objectContaining({
          receipt: expect.objectContaining({ outcome: "cancelled", usageAvailability: "reported" }),
        }),
      }),
    );
    expect(finalized.ok).toBe(false);
    if (finalized.ok) return;
    expect(finalized.error).toMatchObject({ code: "AI_ERROR" });
  });

  it("round-trips a cancelled terminal outcome through the real review store", async () => {
    const reviews =
      await vi.importActual<typeof import("./storage/reviews.js")>("./storage/reviews.js");
    saveReview.mockImplementationOnce(reviews.saveReview);

    const plan = admittedPlan();
    const { client, authorization } = authorizedClient(plan, "cancelled");
    const executed = await executeReview({
      aiClient: client,
      parsed: makeParsedDiff([makeFileDiff({ filePath: "a.ts", rawDiff: "+const a = 1;" })]),
      config: reviewConfig(),
      emit: async () => undefined,
      executionContext: createReviewExecutionContext(authorization),
    });
    expect(executed.ok).toBe(true);
    if (!executed.ok) return;

    const reviewId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const session = createSession(reviewId, {
      projectPath: "/project",
      headCommit: "head",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
    });

    const finalized = await finalizeReview({
      outcome: executed.value,
      emit: async () => undefined,
      reviewId,
      projectPath: "/project",
      mode: "unstaged",
      parsed: makeParsedDiff([makeFileDiff({ filePath: "a.ts", rawDiff: "+const a = 1;" })]),
      activeLenses: ["correctness"],
      durationMs: 10,
      branch: null,
      headCommit: "head",
      signal: session.controller.signal,
    });

    expect(finalized.ok).toBe(false);
    const persisted = await reviews.getReview(reviewId);
    expect(persisted.ok).toBe(true);
    if (!persisted.ok) return;
    expect(persisted.value.execution?.receipt.outcome).toBe("cancelled");
    expect(persisted.value.execution?.receipt.usageAvailability).toBe("reported");
    expect(persisted.value.metadata.durationMs).toBe(10);
    deleteSessionForTests(reviewId);
  });
});
