import { REMOVED_PRODUCT_IDS } from "@diffgazer/core/schemas/config";
import type { EvidenceKey, RuntimeIdentity } from "@diffgazer/core/schemas/review";

const REMOVED_PRODUCT_ID = REMOVED_PRODUCT_IDS[0];

import {
  ExecutionFingerprintInputSchema,
  sha256CanonicalJsonSync,
} from "@diffgazer/core/schemas/review";
import { describe, expect, it, vi } from "vitest";
import { createAdmissionEvidence } from "../../config/admission-evidence.js";
import type { SupportedProviderConfigurationRecord } from "../../config/provider-config.js";
import { createEnvironmentSecretBinding } from "../../config/secret-bindings.js";
import { createBudgetLedger } from "../budget/ledger.js";
import { ADAPTER_REGISTRY } from "../providers/registry.js";
import {
  type AdmissionServiceDependencies,
  type AdmissionSnapshot,
  authorizeReviewExecution,
  buildExpectedEvidenceKey,
  ExecutionLeaseRegistry,
  executionLimitsFromBudget,
  toClientSafeAdmittedPlanJson,
} from "./service.js";

const CHECKED_AT = "2026-07-31T12:00:00.000Z";
const NOW = "2026-07-31T12:05:00.000Z";
const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);
const RUNTIME: RuntimeIdentity = { identity: "diffgazer-server", version: "1.2.3" };

const BUDGET = {
  inputTokens: 32_000,
  outputTokens: 8_000,
  responseBytes: 65_536,
  wallTimeMs: 60_000,
  retries: 2,
  concurrency: 1,
  perReview: 40_000,
} as const;

function hostedRecord(
  patch: Partial<SupportedProviderConfigurationRecord> = {},
): SupportedProviderConfigurationRecord {
  return {
    schemaVersion: 2,
    status: "supported",
    configurationId: "gemini-primary",
    revision: 3,
    productId: "gemini",
    transportFamily: "hosted-api",
    input: {
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
    },
    selectedModelId: "gemini-2.5-flash",
    acknowledgement: {
      noticeVersion: 1,
      acceptedAt: CHECKED_AT,
    },
    evidenceReference: "evidence-gemini-3",
    budget: BUDGET,
    createdAt: "2026-07-31T11:00:00.000Z",
    updatedAt: CHECKED_AT,
    ...patch,
  };
}

function evidenceKeyFor(record = hostedRecord()): EvidenceKey {
  return buildExpectedEvidenceKey({
    record,
    structuredOutputSchemaSha256: SCHEMA_SHA256,
    runtime: RUNTIME,
    credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
    workspaceAccountReference: null,
  });
}

function passedEvidence(evidenceKey: EvidenceKey) {
  return createAdmissionEvidence({
    evidenceKey,
    checkedAt: CHECKED_AT,
    status: "passed",
    expiresAt: "2026-08-01T00:00:00.000Z",
  });
}

function readySnapshot(
  patch: Partial<AdmissionSnapshot> & {
    recordPatch?: Partial<SupportedProviderConfigurationRecord>;
  } = {},
): AdmissionSnapshot {
  const record = hostedRecord(patch.recordPatch);
  const binding = createEnvironmentSecretBinding(
    record.configurationId,
    record.revision,
    "GEMINI_KEY",
  );
  const evidenceKey = evidenceKeyFor(record);
  return {
    configuration: { status: "supported", record },
    binding,
    evidence: passedEvidence(evidenceKey),
    credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
    workspaceAccountReference: null,
    ...patch,
  };
}

function createDependencies(
  snapshot: AdmissionSnapshot | null,
  overrides: Partial<AdmissionServiceDependencies> = {},
): AdmissionServiceDependencies {
  const resolveCredential = vi.fn(async () => "super-secret-api-key-value");
  return {
    now: () => new Date(NOW),
    loadSnapshot: async () => snapshot,
    leaseRegistry: new ExecutionLeaseRegistry(),
    budgetLedger: createBudgetLedger(executionLimitsFromBudget(BUDGET)),
    structuredOutputSchemaSha256: SCHEMA_SHA256,
    runtimeIdentity: RUNTIME,
    resolveCredential,
    ...overrides,
  };
}

describe("authorizeReviewExecution", () => {
  it("rejects configuration-not-found when loadSnapshot returns null", async () => {
    const dependencies = createDependencies(null);

    const result = await authorizeReviewExecution("missing-configuration", dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("configuration-not-found");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("rejects missing evidence before secret resolution", async () => {
    const dependencies = createDependencies(readySnapshot({ evidence: null }));

    const result = await authorizeReviewExecution("gemini-primary", dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("evidence-missing");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("rejects skipped evidence before secret resolution", async () => {
    const record = hostedRecord();
    const dependencies = createDependencies(
      readySnapshot({
        evidence: createAdmissionEvidence({
          evidenceKey: evidenceKeyFor(record),
          checkedAt: CHECKED_AT,
          status: "skipped",
        }),
      }),
    );

    const result = await authorizeReviewExecution(record.configurationId, dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("evidence-skipped");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("rejects stale or expired evidence before secret resolution", async () => {
    const record = hostedRecord();
    const dependencies = createDependencies(
      readySnapshot({
        evidence: createAdmissionEvidence({
          evidenceKey: evidenceKeyFor(record),
          checkedAt: CHECKED_AT,
          status: "passed",
          expiresAt: "2026-07-31T12:01:00.000Z",
        }),
      }),
    );

    const result = await authorizeReviewExecution(record.configurationId, dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("evidence-stale");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("rejects a changed configuration revision hash before secret resolution", async () => {
    const previousRecord = hostedRecord({
      revision: 3,
      budget: { ...BUDGET, perReview: 10 },
    });
    const record = hostedRecord({ revision: 4 });
    const staleEvidence = passedEvidence(evidenceKeyFor(previousRecord));
    const dependencies = createDependencies({
      configuration: { status: "supported", record },
      binding: createEnvironmentSecretBinding(
        record.configurationId,
        record.revision,
        "GEMINI_KEY",
      ),
      evidence: staleEvidence,
      credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
      workspaceAccountReference: null,
    });

    const result = await authorizeReviewExecution(record.configurationId, dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tuple-changed");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("rejects a changed evidence tuple before secret resolution", async () => {
    const record = hostedRecord();
    const staleKey = evidenceKeyFor(record);
    const changedRecord = hostedRecord({ selectedModelId: "gemini-2.5-pro" });
    const dependencies = createDependencies({
      ...readySnapshot(),
      configuration: { status: "supported", record: changedRecord },
      evidence: passedEvidence(staleKey),
    });

    const result = await authorizeReviewExecution(record.configurationId, dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tuple-changed");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("rejects missing acknowledgement before secret resolution", async () => {
    const record = hostedRecord({
      acknowledgement: { noticeVersion: 1, acceptedAt: null },
    });
    const dependencies = createDependencies(readySnapshot({ recordPatch: record }));

    const result = await authorizeReviewExecution(record.configurationId, dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("acknowledgement-required");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("rejects exhausted budget before secret resolution", async () => {
    const ledger = createBudgetLedger({
      ...executionLimitsFromBudget(BUDGET),
      maxRetries: 0,
      maxConcurrency: 1,
    });
    const first = ledger.reserveAttempt({
      inputTokens: 1,
      outputTokens: 1,
      responseBytes: 1,
      wallTimeMs: 1,
      costUsd: 0.01,
    });
    expect(first.ok).toBe(true);

    const dependencies = createDependencies(readySnapshot(), { budgetLedger: ledger });
    const result = await authorizeReviewExecution("gemini-primary", dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("budget-exhausted");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("rejects removed configuration ids before secret resolution", async () => {
    const dependencies = createDependencies({
      configuration: {
        status: "removed",
        record: {
          schemaVersion: 2,
          status: "removed",
          configurationId: "legacy-removed-zai-plan",
          revision: 1,
          productId: REMOVED_PRODUCT_ID,
          transportFamily: "hosted-api",
          selectedModelId: null,
          acknowledgement: null,
          evidenceReference: null,
          budget: null,
          createdAt: CHECKED_AT,
          updatedAt: CHECKED_AT,
        },
      },
      binding: null,
      evidence: null,
      credentialReferenceIdentity: null,
      workspaceAccountReference: null,
    });

    const result = await authorizeReviewExecution("legacy-removed-zai-plan", dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("configuration-removed");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("rejects unknown configuration ids before secret resolution", async () => {
    const dependencies = createDependencies({
      configuration: { status: "unknown" },
      binding: null,
      evidence: null,
      credentialReferenceIdentity: null,
      workspaceAccountReference: null,
    });

    const result = await authorizeReviewExecution("cfg-unknown", dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("configuration-unsupported");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("rejects missing adapter before secret resolution", async () => {
    const dependencies = createDependencies(readySnapshot(), {
      getAdapter: () => {
        throw new Error("Adapter unavailable for unknown product: missing");
      },
    });

    const result = await authorizeReviewExecution("gemini-primary", dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("adapter-unavailable");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("rejects adapter productId mismatch as adapter-unavailable before secret resolution", async () => {
    const dependencies = createDependencies(readySnapshot(), {
      getAdapter: () => ({
        productId: "zai",
        transportFamily: "hosted-api",
        execute: async () => {
          throw new Error("adapter execute should not run");
        },
      }),
    });

    const result = await authorizeReviewExecution("gemini-primary", dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("adapter-unavailable");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("rejects readiness-not-ready before secret resolution", async () => {
    const record = hostedRecord();
    const evidenceKey = evidenceKeyFor(record);
    const dependencies = createDependencies({
      configuration: { status: "supported", record },
      binding: null,
      evidence: passedEvidence(evidenceKey),
      credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
      workspaceAccountReference: null,
    });

    const result = await authorizeReviewExecution(record.configurationId, dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("readiness-not-ready");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("issues an immutable fingerprinted plan without resolving secrets", async () => {
    const dependencies = createDependencies(readySnapshot());

    const result = await authorizeReviewExecution("gemini-primary", dependencies);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(Object.isFrozen(result.value.plan)).toBe(true);
    expect(Object.isFrozen(result.value.plan.evidenceKey)).toBe(true);
    expect(Object.isFrozen(result.value.plan.evidenceKey.runtime)).toBe(true);
    expect(Object.isFrozen(result.value.plan.limits)).toBe(true);

    expect(result.value.plan.executionFingerprint).toBe(
      sha256CanonicalJsonSync(
        ExecutionFingerprintInputSchema.parse({
          configurationId: result.value.plan.configurationId,
          configurationRevision: result.value.plan.configurationRevision,
          evidenceKey: result.value.plan.evidenceKey,
        }),
      ),
    );

    expect(result.value.adapter).toBe(ADAPTER_REGISTRY.gemini);
    expect(toClientSafeAdmittedPlanJson(result.value.plan)).not.toContain("super-secret");
    expect(toClientSafeAdmittedPlanJson(result.value.plan)).not.toContain("GEMINI_KEY");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();

    await expect(result.value.resolveCredential()).resolves.toBe("super-secret-api-key-value");
    expect(dependencies.resolveCredential).toHaveBeenCalledTimes(1);

    result.value.release();
    expect(dependencies.leaseRegistry.activeLeaseCount("gemini-primary")).toBe(0);
  });

  it("rejects a revoking configuration before secret resolution", async () => {
    const leaseRegistry = new ExecutionLeaseRegistry();
    leaseRegistry.revoke("gemini-primary");
    const dependencies = createDependencies(readySnapshot(), { leaseRegistry });

    const result = await authorizeReviewExecution("gemini-primary", dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("configuration-revoking");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });
});
