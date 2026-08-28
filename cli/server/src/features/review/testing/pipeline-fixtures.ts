import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import type {
  EvidenceKey,
  ExecutionLimits,
  SelectableLensId,
} from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { vi } from "vitest";
import { ExecutionLeaseRegistry } from "../../../shared/lib/ai/admission/lease-registry.js";
import type { AdmittedExecutionPlan } from "../../../shared/lib/ai/admission/service.js";
import { createBudgetLedger } from "../../../shared/lib/ai/budget/ledger.js";
import { promptAttemptEstimate } from "../../../shared/lib/ai/providers/execution-receipt.js";
import type { Adapter } from "../../../shared/lib/ai/types.js";
import { makeFileDiff } from "./factories.js";

export function makePipelineFile(filePath: string, additions = 1, deletions = 0) {
  return makeFileDiff({
    filePath,
    rawDiff: "",
    stats: { additions, deletions, sizeBytes: 100 },
  });
}

export const makePipelineIssue = (
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
    region: null,
    workspaceAccountReference: null,
    modelId: "gemini-test-model",
    runtime: { identity: "diffgazer-server", version: "1.0.0" },
    structuredOutputSchemaSha256: "a".repeat(64),
    noticeVersion: product.notice.noticeVersion,
    limits: PIPELINE_LIMITS,
  };
}

export function pipelineAdmittedPlan(
  productId: HostedApiProductId = "gemini",
): AdmittedExecutionPlan {
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

export function authorizePipelineExecution(plan: AdmittedExecutionPlan, adapter: Adapter) {
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

export function pipelineConfig() {
  return {
    activeLenses: ["correctness"] as SelectableLensId[],
    effectiveProfileId: undefined,
    profile: undefined,
    severityFilter: undefined,
    concurrency: 1,
    projectContext: "",
  };
}
