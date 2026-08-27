import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import {
  type EvidenceKey,
  type ExecutionLimits,
  type ExecutionResult,
  ExecutionResultSchema,
  hashExecutionReceiptFingerprintSync,
  type TerminalOutcome,
} from "@diffgazer/core/schemas/review";
import { ExecutionLeaseRegistry } from "../ai/admission/lease-registry.js";
import type { AdmittedExecutionPlan } from "../ai/admission/service.js";
import { createBudgetLedger } from "../ai/budget/ledger.js";
import { promptAttemptEstimate } from "../ai/providers/execution-receipt.js";
import type { Adapter, AdapterExecuteRequest } from "../ai/types.js";

const CLIENT_TEST_SCHEMA_SHA256 = "1".repeat(64);
export const CLIENT_TEST_CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);
export const CLIENT_TEST_SECRET_LITERAL = "sk-live-provider-secret-value";

const DEFAULT_CLIENT_TEST_LIMITS: ExecutionLimits = Object.freeze({
  maxInputTokens: 32_000,
  maxResponseBytes: 65_536,
  wallTimeMs: 60_000,
  maxRetries: 2,
  maxConcurrency: 1,
  maxCostUsd: 0.5,
});

export function suggestedClientTestModelId(productId: RunnableProductId): string {
  const policy = PRODUCT_REGISTRY[productId].modelPolicy;
  if ("suggestedModelId" in policy && policy.suggestedModelId) {
    return policy.suggestedModelId;
  }
  if (productId === "openrouter") return "openai/gpt-4.1-mini";
  return "model-1";
}

export type ClientTestPlanOptions = Readonly<{
  modelId?: string;
  limits?: ExecutionLimits;
}>;

export function clientTestEvidenceKey(
  productId: RunnableProductId,
  options: ClientTestPlanOptions = {},
): EvidenceKey {
  const limits = options.limits ?? DEFAULT_CLIENT_TEST_LIMITS;
  const modelId = options.modelId ?? suggestedClientTestModelId(productId);
  const product = PRODUCT_REGISTRY[productId];
  const endpoint = product.configuration.endpoints[0];
  const noticeVersion = product.notice.noticeVersion;

  return {
    authentication: null,
    credentialReferenceIdentity: CLIENT_TEST_CREDENTIAL_REFERENCE_IDENTITY,
    installationId: null,
    productId,
    transportFamily: "hosted-api",
    normalizedEndpoint: endpoint?.endpoint ?? "https://example.invalid/v1",
    region: null,
    workspaceAccountReference: null,
    modelId,
    runtime: { identity: "diffgazer-server", version: "1.2.3" },
    structuredOutputSchemaSha256: CLIENT_TEST_SCHEMA_SHA256,
    noticeVersion,
    limits,
  };
}

export function clientTestAdmittedPlan(
  productId: RunnableProductId = "gemini",
  options: ClientTestPlanOptions = {},
): AdmittedExecutionPlan {
  const limits = options.limits ?? DEFAULT_CLIENT_TEST_LIMITS;
  const evidenceKey = clientTestEvidenceKey(productId, { ...options, limits });
  return Object.freeze({
    configurationId: `${productId}-configuration`,
    configurationRevision: 1,
    executionFingerprint: `${productId}-fingerprint`,
    evidenceKey: Object.freeze({
      ...evidenceKey,
      runtime: Object.freeze({ ...evidenceKey.runtime }),
      limits: Object.freeze({ ...limits }),
    }),
    productId,
    transportFamily: PRODUCT_REGISTRY[productId].transportFamily,
    limits: Object.freeze({ ...limits }),
  });
}

export function clientTestBuildReceipt(
  plan: AdmittedExecutionPlan,
  outcome: TerminalOutcome,
  patch: Partial<ExecutionResult["receipt"]> = {},
): ExecutionResult["receipt"] {
  const startedAt = patch.startedAt ?? "2026-07-31T10:00:00.000Z";
  const finishedAt = patch.finishedAt ?? "2026-07-31T10:00:01.000Z";
  const { evidenceKey } = plan;
  const executionFingerprint = hashExecutionReceiptFingerprintSync({
    configurationId: plan.configurationId,
    configurationRevision: plan.configurationRevision,
    authentication: evidenceKey.authentication,
    credentialReferenceIdentity: evidenceKey.credentialReferenceIdentity,
    installationId: evidenceKey.installationId,
    productId: evidenceKey.productId,
    transportFamily: evidenceKey.transportFamily,
    modelId: evidenceKey.modelId,
    normalizedEndpoint: evidenceKey.normalizedEndpoint,
    region: evidenceKey.region,
    workspaceAccountReference: evidenceKey.workspaceAccountReference,
    runtime: evidenceKey.runtime,
    structuredOutputSchemaSha256: evidenceKey.structuredOutputSchemaSha256,
    noticeVersion: evidenceKey.noticeVersion,
    limits: plan.limits,
  });
  return {
    schemaVersion: 1,
    executionFingerprint,
    configurationId: plan.configurationId,
    configurationRevision: plan.configurationRevision,
    authentication: plan.evidenceKey.authentication,
    credentialReferenceIdentity: plan.evidenceKey.credentialReferenceIdentity,
    installationId: plan.evidenceKey.installationId,
    productId: plan.productId,
    transportFamily: plan.transportFamily,
    modelId: plan.evidenceKey.modelId,
    normalizedEndpoint: plan.evidenceKey.normalizedEndpoint,
    region: plan.evidenceKey.region ?? undefined,
    workspaceAccountReference: plan.evidenceKey.workspaceAccountReference ?? undefined,
    runtime: plan.evidenceKey.runtime,
    structuredOutputSchemaSha256: plan.evidenceKey.structuredOutputSchemaSha256,
    noticeVersion: plan.evidenceKey.noticeVersion,
    limits: plan.limits,
    attemptCount: 1,
    startedAt,
    finishedAt,
    usageAvailability: "unavailable",
    outcome,
    ...patch,
  } as ExecutionResult["receipt"];
}

export function clientTestExecutionResult(
  plan: AdmittedExecutionPlan,
  outcome: TerminalOutcome,
  patch: Partial<ExecutionResult["receipt"]> = {},
  issues: ExecutionResult["result"]["issues"] = [],
): ExecutionResult {
  return ExecutionResultSchema.parse({
    receipt: clientTestBuildReceipt(plan, outcome, patch),
    result: { issues },
  });
}

export function clientTestCreateMockAdapter(
  productId: RunnableProductId,
  execute: (request: AdapterExecuteRequest) => Promise<ExecutionResult>,
): Adapter {
  return {
    productId,
    transportFamily: PRODUCT_REGISTRY[productId].transportFamily,
    execute,
  };
}

export type ClientTestAuthorizeOptions = Readonly<{
  ledger?: ReturnType<typeof createBudgetLedger>;
  reservationPrompt?: string;
  credential?: string;
  trackRelease?: boolean;
  evidenceState?: "proven" | "unproven";
}>;

export function clientTestAuthorize(
  plan: AdmittedExecutionPlan,
  adapter: Adapter,
  options: ClientTestAuthorizeOptions = {},
) {
  const ledger = options.ledger ?? createBudgetLedger(plan.limits);
  const estimate = promptAttemptEstimate(
    { prompt: options.reservationPrompt ?? "review prompt" },
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
  const releaseTracker = options.trackRelease ? { count: 0 } : undefined;
  let released = false;
  return {
    authorization: Object.freeze({
      plan,
      adapter,
      evidenceState: options.evidenceState ?? "proven",
      budgetLedger: ledger,
      budgetReservation: budgetReservation.value,
      lease: lease.value,
      resolveCredential: async () => options.credential ?? CLIENT_TEST_SECRET_LITERAL,
      release: () => {
        if (released) return;
        released = true;
        if (releaseTracker) {
          releaseTracker.count += 1;
        }
        ledger.releaseReservation(budgetReservation.value);
        lease.value.release();
      },
    }),
    ledger,
    releaseTracker,
  };
}
