import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { err } from "@diffgazer/core/result";
import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "@diffgazer/core/schemas/config";
import type { EvidenceKey, RuntimeIdentity } from "@diffgazer/core/schemas/review";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdmissionEvidence } from "../../config/admission-evidence.js";
import type { SupportedProviderConfigurationRecord } from "../../config/provider-config.js";
import { createEnvironmentSecretBinding } from "../../config/secret-bindings.js";
import {
  type AdmissionServiceDependencies,
  type AdmissionSnapshot,
  authorizeReviewExecution,
  buildExpectedEvidenceKey,
  ExecutionLeaseRegistry,
  executionLimitsFromBudget,
} from "../admission/service.js";
import { createBudgetLedger } from "../budget/ledger.js";

const CHECKED_AT = "2026-07-31T12:00:00.000Z";
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

const catalogMocks = vi.hoisted(() => ({
  getProviderModels: vi.fn(),
  getOpenRouterModelsWithCache: vi.fn(),
}));

vi.mock("../models-dev-catalog.js", () => ({
  getProviderModels: catalogMocks.getProviderModels,
}));
vi.mock("../openrouter-models.js", () => ({
  getOpenRouterModelsWithCache: catalogMocks.getOpenRouterModelsWithCache,
}));

vi.mock("../admission/service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../admission/service.js")>();
  return {
    ...actual,
    authorizeReviewExecution: vi.fn(actual.authorizeReviewExecution),
  };
});

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

function readySnapshot(): AdmissionSnapshot {
  const record = hostedRecord();
  const binding = createEnvironmentSecretBinding(
    record.configurationId,
    record.revision,
    "GEMINI_KEY",
  );
  const evidenceKey = evidenceKeyFor(record);
  return {
    configuration: { status: "supported", record },
    binding,
    evidence: createAdmissionEvidence({
      evidenceKey,
      checkedAt: CHECKED_AT,
      status: "passed",
      expiresAt: "2026-08-01T00:00:00.000Z",
    }),
    credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
    workspaceAccountReference: null,
  };
}

function createDependencies(
  snapshot: AdmissionSnapshot | null,
  overrides: Partial<AdmissionServiceDependencies> = {},
): AdmissionServiceDependencies {
  const resolveCredential = vi.fn(async () => "super-secret-api-key-value");
  return {
    now: () => new Date("2026-07-31T12:05:00.000Z"),
    loadSnapshot: async () => snapshot,
    leaseRegistry: new ExecutionLeaseRegistry(),
    budgetLedger: createBudgetLedger(executionLimitsFromBudget(BUDGET)),
    structuredOutputSchemaSha256: SCHEMA_SHA256,
    runtimeIdentity: RUNTIME,
    resolveCredential,
    ...overrides,
  };
}

let diffgazerHome: string;

function setupTempHome() {
  diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-initialize-"));
  process.env.DIFFGAZER_HOME = diffgazerHome;
  vi.resetModules();
  vi.clearAllMocks();
  catalogMocks.getProviderModels.mockResolvedValue({
    models: [],
    fetchedAt: "",
    source: "live",
    cached: false,
  });
  catalogMocks.getOpenRouterModelsWithCache.mockResolvedValue({
    ok: true,
    value: { models: [], fetchedAt: "", cached: false },
  });
}

function teardownTempHome() {
  vi.restoreAllMocks();
  delete process.env.DIFFGAZER_HOME;
  rmSync(diffgazerHome, { recursive: true, force: true });
}

async function loadInitialize() {
  return import("./initialize.js");
}

describe("initializeAIClient", () => {
  beforeEach(setupTempHome);
  afterEach(teardownTempHome);

  it("authorizes the exact configuration id and returns the admitted fingerprint", async () => {
    const snapshot = readySnapshot();
    const dependencies = createDependencies(snapshot);
    const { initializeAIClient } = await loadInitialize();

    const result = await initializeAIClient("gemini-primary", dependencies);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.authorization).toBeDefined();
    expect(authorizeReviewExecution).toHaveBeenCalledWith("gemini-primary", dependencies);
    expect(result.value.executionFingerprint).toStrictEqual({
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
    expect(result.value.authorization?.plan.configurationId).toBe("gemini-primary");
    expect(result.value.authorization?.plan.executionFingerprint).toBe(
      result.value.authorization?.plan.executionFingerprint,
    );
    expect(JSON.stringify(result.value.executionFingerprint)).not.toContain("super-secret");
  });

  it("rechecks admission evidence through authorizeReviewExecution before adapter creation", async () => {
    const snapshot = readySnapshot();
    const dependencies = createDependencies(snapshot);
    const { initializeAIClient } = await loadInitialize();

    const result = await initializeAIClient("gemini-primary", dependencies);

    expect(result.ok).toBe(true);
    expect(authorizeReviewExecution).toHaveBeenCalledOnce();
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("does not consult catalog lookups", async () => {
    const dependencies = createDependencies(readySnapshot());
    const { initializeAIClient } = await loadInitialize();

    await initializeAIClient("gemini-primary", dependencies);

    expect(catalogMocks.getProviderModels).not.toHaveBeenCalled();
    expect(catalogMocks.getOpenRouterModelsWithCache).not.toHaveBeenCalled();
  });

  it("surfaces admission failures without creating an adapter client", async () => {
    const dependencies = createDependencies(null);
    const { initializeAIClient } = await loadInitialize();

    const result = await initializeAIClient("missing-configuration", dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("configuration-not-found");
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("gives every authorization its own budget ledger", async () => {
    const { createAdmissionServiceDependencies } = await loadInitialize();

    const first = createAdmissionServiceDependencies("gemini-primary");
    const second = createAdmissionServiceDependencies("gemini-primary");

    // A shared module-level ledger latched one configuration's exhaustion onto
    // every later review until restart.
    expect(first.budgetLedger).not.toBe(second.budgetLedger);
  });

  it("rejects stale evidence during the immediate recheck", async () => {
    const staleEvidenceKey = evidenceKeyFor(hostedRecord({ selectedModelId: "stale-model" }));
    const snapshot = readySnapshot();
    const dependencies = createDependencies({
      ...snapshot,
      evidence: createAdmissionEvidence({
        evidenceKey: staleEvidenceKey,
        checkedAt: CHECKED_AT,
        status: "passed",
        expiresAt: "2026-08-01T00:00:00.000Z",
      }),
    });
    const { initializeAIClient } = await loadInitialize();

    const result = await initializeAIClient("gemini-primary", dependencies);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tuple-changed");
  });
});

describe("initializeAIClient legacy behavior", () => {
  beforeEach(setupTempHome);
  afterEach(teardownTempHome);

  it("does not resolve catalog model limits or legacy provider credentials", async () => {
    writeFileSync(
      join(diffgazerHome, "config.json"),
      JSON.stringify({
        settings: { secretsStorage: "file" },
        providers: [
          {
            provider: "gemini",
            [LEGACY_V1_HAS_API_KEY_PROPERTY]: true,
            isActive: true,
            model: "gemini-2.5-flash",
          },
        ],
      }),
      "utf-8",
    );
    writeFileSync(
      join(diffgazerHome, "secrets.json"),
      JSON.stringify({ providers: { gemini: "legacy-key" } }),
      "utf-8",
    );
    mkdirSync(dirname(join(diffgazerHome, "credentials", "noop.key")), { recursive: true });

    const dependencies = createDependencies(readySnapshot());
    const { initializeAIClient } = await loadInitialize();
    vi.mocked(authorizeReviewExecution).mockResolvedValueOnce(
      err({
        code: "configuration-not-found",
        safeMessage: "Configuration was not found",
        retryable: false,
      }),
    );

    await initializeAIClient("gemini-primary", dependencies);

    expect(catalogMocks.getProviderModels).not.toHaveBeenCalled();
    expect(catalogMocks.getOpenRouterModelsWithCache).not.toHaveBeenCalled();
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });
});
