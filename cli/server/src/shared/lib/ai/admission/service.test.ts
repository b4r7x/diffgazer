import { CATALOG_SNAPSHOT } from "@diffgazer/core/catalog";
import { sha256CanonicalJsonSync } from "@diffgazer/core/json";
import { err, ok } from "@diffgazer/core/result";
import type { EvidenceKey, ExecutionLimits, RuntimeIdentity } from "@diffgazer/core/schemas/review";
import { ExecutionFingerprintInputSchema } from "@diffgazer/core/schemas/review";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildExpectedEvidenceKey,
  createAdmissionEvidence,
} from "../../config/admission-evidence.js";
import { executionLimitsFromBudget } from "../../config/budget-ceiling.js";
import type { SupportedProviderConfigurationRecord } from "../../config/provider-config.js";
import {
  createEnvironmentSecretBinding,
  type SecretBinding,
} from "../../config/secret-bindings.js";
import { estimateWorstCaseCostUsd, PLANNING_OUTPUT_TOKENS } from "../budget/cost.js";
import { type BudgetLedger, createBudgetLedger } from "../budget/ledger.js";
import { ADAPTER_REGISTRY } from "../providers/registry.js";
import { ExecutionLeaseRegistry } from "./lease-registry.js";
import {
  type AdmissionServiceDependencies,
  type AdmissionSnapshot,
  authorizeReviewExecution,
  STRUCTURED_OUTPUT_FAILURE_GUIDANCE,
  toClientSafeAdmittedPlanJson,
} from "./service.js";

// The bearer case below resolves a keyring reference through production secret
// IO; the real OS keychain must stay out of the suite.
vi.mock("../../config/keyring.js", () => ({
  readKeyringSecret: async () => ({ ok: true, value: null }),
  writeKeyringSecret: async () => ({ ok: true, value: undefined }),
  deleteKeyringSecret: async () => ({ ok: true, value: false }),
  isKeyringAvailable: async () => true,
}));

const CHECKED_AT = "2026-07-31T12:00:00.000Z";
const NOW = "2026-07-31T12:05:00.000Z";
const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);
const RUNTIME: RuntimeIdentity = { identity: "diffgazer-server", version: "1.2.3" };
const ORIGINAL_GEMINI_KEY = process.env.GEMINI_KEY;

const BUDGET = {
  inputTokens: 32_000,
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
      noticeId: "gemini-hosted-api",
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
    loadSnapshot: async () => ok(snapshot),
    leaseRegistry: new ExecutionLeaseRegistry(),
    createBudgetLedger: vi.fn((limits: ExecutionLimits) => createBudgetLedger(limits)),
    structuredOutputSchemaSha256: SCHEMA_SHA256,
    runtimeIdentity: RUNTIME,
    resolveCredential,
    ...overrides,
  };
}

describe("buildExpectedEvidenceKey", () => {
  it("derives the input ceiling from the selected model's bundled catalog observation", () => {
    // Far above any published ceiling, so the catalog observation is provably
    // the binding constraint and the assertion survives a snapshot refresh.
    const legacyBudget = {
      inputTokens: 5_000_000,
      responseBytes: 8_000_000,
      wallTimeMs: 300_000,
      retries: 0,
      concurrency: 1,
      perReview: 5,
    };
    const catalogLimit = CATALOG_SNAPSHOT.zai?.models["glm-4.6"]?.limit;
    if (catalogLimit?.context === undefined || catalogLimit.output === undefined) {
      throw new Error("Bundled snapshot is missing zai/glm-4.6 limits");
    }
    const record = hostedRecord({
      productId: "zai",
      transportFamily: "hosted-api",
      input: {
        transportFamily: "hosted-api",
        productId: "zai",
        endpoint: "https://api.z.ai/api/paas/v4",
      },
      selectedModelId: "glm-4.6",
      budget: legacyBudget,
    });
    const key = buildExpectedEvidenceKey({
      record,
      structuredOutputSchemaSha256: SCHEMA_SHA256,
      runtime: RUNTIME,
      credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
    });

    // Reservations plan for an answer of PLANNING_OUTPUT_TOKENS, not the whole
    // catalog ceiling, so the input envelope keeps the rest of the window.
    expect(key.limits.maxInputTokens).toBe(
      catalogLimit.context - Math.min(catalogLimit.output, PLANNING_OUTPUT_TOKENS),
    );
  });
});

describe("authorizeReviewExecution", () => {
  beforeEach(() => {
    process.env.GEMINI_KEY = "test-api-key";
  });

  afterEach(() => {
    if (ORIGINAL_GEMINI_KEY === undefined) {
      delete process.env.GEMINI_KEY;
    } else {
      process.env.GEMINI_KEY = ORIGINAL_GEMINI_KEY;
    }
  });

  it("rejects configuration-not-found when loadSnapshot returns null", async () => {
    const dependencies = createDependencies(null);

    const result = await authorizeReviewExecution("missing-configuration", dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("configuration-not-found");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("admits an unproven execution when no evidence exists", async () => {
    const dependencies = createDependencies(readySnapshot({ evidence: null }));

    const result = await authorizeReviewExecution("gemini-primary", dependencies);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.evidenceState).toBe("unproven");
    result.value.release();
  });

  it("admits an unproven execution when passed evidence has expired", async () => {
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

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.evidenceState).toBe("unproven");
    result.value.release();
  });

  it("admits a proven execution when durable passed evidence matches the tuple", async () => {
    const record = hostedRecord();
    const dependencies = createDependencies(
      readySnapshot({
        evidence: createAdmissionEvidence({
          evidenceKey: evidenceKeyFor(record),
          checkedAt: CHECKED_AT,
          status: "passed",
          expiresAt: null,
        }),
      }),
    );

    const result = await authorizeReviewExecution(record.configurationId, dependencies);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.evidenceState).toBe("proven");
    result.value.release();
  });

  it("fast-fails free when failed evidence matches the tuple", async () => {
    const record = hostedRecord();
    const leaseRegistry = new ExecutionLeaseRegistry();
    const acquireLease = vi.spyOn(leaseRegistry, "tryAcquire");
    const dependencies = createDependencies(
      readySnapshot({
        evidence: createAdmissionEvidence({
          evidenceKey: evidenceKeyFor(record),
          checkedAt: CHECKED_AT,
          status: "failed",
          expiresAt: null,
        }),
      }),
      { leaseRegistry },
    );

    const result = await authorizeReviewExecution(record.configurationId, dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("conformance-failed");
    expect(result.error.retryable).toBe(false);
    expect(result.error.safeMessage).toBe(STRUCTURED_OUTPUT_FAILURE_GUIDANCE);
    // "Free" is all three: no credential read, no budget reserved, no lease
    // taken. Only the credential half is visible from the failure itself.
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
    expect(dependencies.createBudgetLedger).not.toHaveBeenCalled();
    expect(acquireLease).not.toHaveBeenCalled();
  });

  it("clears a cached failure the moment the tuple changes", async () => {
    const record = hostedRecord();
    const changedRecord = hostedRecord({ selectedModelId: "gemini-2.5-pro" });
    const dependencies = createDependencies({
      ...readySnapshot(),
      configuration: { status: "supported", record: changedRecord },
      evidence: createAdmissionEvidence({
        evidenceKey: evidenceKeyFor(record),
        checkedAt: CHECKED_AT,
        status: "failed",
        expiresAt: null,
      }),
    });

    const result = await authorizeReviewExecution(record.configurationId, dependencies);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.evidenceState).toBe("unproven");
    result.value.release();
  });

  it("admits an unproven execution when evidence belongs to a previous revision", async () => {
    const previousRecord = hostedRecord({
      revision: 3,
      budget: { ...BUDGET, perReview: 10 },
    });
    const record = hostedRecord({ revision: 4 });
    const dependencies = createDependencies({
      configuration: { status: "supported", record },
      binding: createEnvironmentSecretBinding(
        record.configurationId,
        record.revision,
        "GEMINI_KEY",
      ),
      evidence: passedEvidence(evidenceKeyFor(previousRecord)),
      credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
    });

    const result = await authorizeReviewExecution(record.configurationId, dependencies);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.evidenceState).toBe("unproven");
    result.value.release();
  });

  it("refuses a configuration whose credential no longer resolves", async () => {
    const record = hostedRecord();
    const binding: SecretBinding = {
      configurationId: record.configurationId,
      revision: record.revision,
      kind: "keyring-reference",
      keyId: `${record.configurationId}/${record.revision}/credential`,
      status: "active",
    };
    const evidenceKey = buildExpectedEvidenceKey({
      record,
      structuredOutputSchemaSha256: SCHEMA_SHA256,
      runtime: RUNTIME,
      credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
    });
    const dependencies = createDependencies({
      configuration: { status: "supported", record },
      binding,
      evidence: passedEvidence(evidenceKey),
      credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
    });

    const result = await authorizeReviewExecution(record.configurationId, dependencies);

    // Refused up front with the credential reason, instead of being admitted
    // and coming back as an undiagnosed transport failure from the endpoint's 401.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("readiness-not-ready");
    expect(result.error.safeMessage).toBe("Configuration credential is unavailable");
  });

  it("rejects a snapshot that changed between the two admission reads", async () => {
    const record = hostedRecord();
    const snapshots = [readySnapshot(), readySnapshot({ recordPatch: { revision: 4 } })];
    let read = 0;
    const dependencies = createDependencies(readySnapshot(), {
      loadSnapshot: async () => ok(snapshots[read++] ?? null),
    });

    const result = await authorizeReviewExecution(record.configurationId, dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tuple-changed");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("rejects missing acknowledgement before secret resolution", async () => {
    const record = hostedRecord({
      acknowledgement: { noticeId: "gemini-hosted-api", noticeVersion: 1, acceptedAt: null },
    });
    const dependencies = createDependencies(readySnapshot({ recordPatch: record }));

    const result = await authorizeReviewExecution(record.configurationId, dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("acknowledgement-required");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("refuses an unacknowledged record before its first review, with no evidence to lean on", async () => {
    const record = hostedRecord({
      acknowledgement: { noticeId: "gemini-hosted-api", noticeVersion: 1, acceptedAt: null },
    });
    const dependencies = createDependencies(readySnapshot({ recordPatch: record, evidence: null }));

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
      responseBytes: 1,
      wallTimeMs: 1,
      costUsd: 0.01,
    });
    expect(first.ok).toBe(true);

    const dependencies = createDependencies(readySnapshot(), { createBudgetLedger: () => ledger });
    const result = await authorizeReviewExecution("gemini-primary", dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("budget-exhausted");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("rejects unknown configuration ids before secret resolution", async () => {
    const dependencies = createDependencies({
      configuration: { status: "unknown" },
      binding: null,
      evidence: null,
      credentialReferenceIdentity: null,
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

  it("revalidates storage before credential, adapter, budget, or lease effects", async () => {
    const snapshot = readySnapshot();
    const loadSnapshot = vi
      .fn<AdmissionServiceDependencies["loadSnapshot"]>()
      .mockResolvedValueOnce(ok(snapshot))
      .mockResolvedValueOnce(
        err({
          code: "configuration-migration-required",
          safeMessage: "Legacy configuration requires manual migration",
          retryable: false,
        }),
      );
    const createLedger = vi.fn((limits) => createBudgetLedger(limits));
    const getAdapter = vi.fn(() => ADAPTER_REGISTRY.gemini);
    const leaseRegistry = new ExecutionLeaseRegistry();
    const acquireLease = vi.spyOn(leaseRegistry, "tryAcquire");
    const dependencies = createDependencies(snapshot, {
      loadSnapshot,
      createBudgetLedger: createLedger,
      getAdapter,
      leaseRegistry,
    });

    const result = await authorizeReviewExecution("gemini-primary", dependencies);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "configuration-migration-required",
        safeMessage: "Legacy configuration requires manual migration",
        retryable: false,
      },
    });
    expect(loadSnapshot).toHaveBeenCalledTimes(2);
    expect(getAdapter).not.toHaveBeenCalled();
    expect(createLedger).not.toHaveBeenCalled();
    expect(acquireLease).not.toHaveBeenCalled();
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
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

describe("admission spend and model gates", () => {
  beforeEach(() => {
    process.env.GEMINI_KEY = "test-api-key";
  });

  afterEach(() => {
    if (ORIGINAL_GEMINI_KEY === undefined) {
      delete process.env.GEMINI_KEY;
    } else {
      process.env.GEMINI_KEY = ORIGINAL_GEMINI_KEY;
    }
  });

  it("denies admission when the admitted model can bill past the spend cap", async () => {
    // gemini-2.5-flash is priced by the bundled catalog, so the worst case for
    // this envelope is a real dollar figure the one-cent cap cannot cover.
    const budget = { ...BUDGET, perReview: 0.01 };
    const snapshot = readySnapshot({ recordPatch: { budget } });
    const dependencies = createDependencies(snapshot, {
      createBudgetLedger: () => createBudgetLedger(executionLimitsFromBudget(budget)),
    });

    const result = await authorizeReviewExecution("gemini-primary", dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("budget-exhausted");
  });

  it("admits when the spend cap covers the model's worst-case bill", async () => {
    const result = await authorizeReviewExecution(
      "gemini-primary",
      createDependencies(readySnapshot()),
    );

    expect(result.ok).toBe(true);
  });

  it("reserves the whole input envelope and the planned worst-case bill", async () => {
    const ledgers: BudgetLedger[] = [];
    const dependencies = createDependencies(readySnapshot(), {
      createBudgetLedger: (limits: ExecutionLimits) => {
        const ledger = createBudgetLedger(limits);
        ledgers.push(ledger);
        return ledger;
      },
    });

    const result = await authorizeReviewExecution("gemini-primary", dependencies);

    expect(result.ok).toBe(true);
    expect(ledgers).toHaveLength(1);
    const admittedLimits = ledgers[0]?.limits;
    const reserved = ledgers[0]?.snapshot().reserved;
    expect(reserved?.inputTokens).toBe(admittedLimits?.maxInputTokens);
    expect(reserved?.costUsd).toBe(
      admittedLimits && estimateWorstCaseCostUsd("gemini", "gemini-2.5-flash", admittedLimits),
    );
  });

  it("denies admission for a configuration with no selected model", async () => {
    const snapshot = readySnapshot();
    const unselected: AdmissionSnapshot = {
      ...snapshot,
      configuration: {
        status: "supported",
        record: hostedRecord({ selectedModelId: null }),
      },
    };

    const result = await authorizeReviewExecution("gemini-primary", createDependencies(unselected));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("readiness-not-ready");
    expect(result.error.safeMessage).toContain("no selected model");
  });
});
