import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ok } from "@diffgazer/core/result";
import type { EvidenceKey, RuntimeIdentity } from "@diffgazer/core/schemas/review";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  buildExpectedEvidenceKey,
  createAdmissionEvidence,
} from "../../config/admission-evidence.js";
import { executionLimitsFromBudget } from "../../config/budget-ceiling.js";
import type { SupportedProviderConfigurationRecord } from "../../config/provider-config.js";
import { createEnvironmentSecretBinding } from "../../config/secret-bindings.js";
import { clientTestExecutionResult } from "../../testing/ai-client-fixtures.js";
import { assertTempHome } from "../../testing/temp-home.js";
import {
  type AdmissionServiceDependencies,
  type AdmissionSnapshot,
  authorizeReviewExecution,
  ExecutionLeaseRegistry,
} from "../admission/service.js";
import { createBudgetLedger } from "../budget/ledger.js";

const CHECKED_AT = "2026-07-31T12:00:00.000Z";
const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);
const RUNTIME: RuntimeIdentity = { identity: "diffgazer-server", version: "1.2.3" };

const BUDGET = {
  inputTokens: 32_000,
  responseBytes: 65_536,
  wallTimeMs: 60_000,
  retries: 2,
  concurrency: 1,
  perReview: 40_000,
} as const;

const catalogMocks = vi.hoisted(() => ({
  getProviderModels: vi.fn(),
}));
const executeReviewGenerationMock = vi.hoisted(() => vi.fn());
const storeMocks = vi.hoisted(() => ({
  readCurrentState: vi.fn(),
}));

vi.mock("../models-dev-catalog.js", () => ({
  getProviderModels: catalogMocks.getProviderModels,
}));
vi.mock("./generate.js", () => ({
  executeReviewGeneration: (...args: unknown[]) => executeReviewGenerationMock(...args),
}));
vi.mock("../../config/store.js", () => ({
  getStore: () => storeMocks,
}));

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
  };
}

function createDependencies(
  snapshot: AdmissionSnapshot | null,
  overrides: Partial<AdmissionServiceDependencies> = {},
): AdmissionServiceDependencies {
  const resolveCredential = vi.fn(async () => "super-secret-api-key-value");
  return {
    now: () => new Date("2026-07-31T12:05:00.000Z"),
    loadSnapshot: async () => ok(snapshot),
    leaseRegistry: new ExecutionLeaseRegistry(),
    createBudgetLedger: (limits) => createBudgetLedger(limits),
    structuredOutputSchemaSha256: SCHEMA_SHA256,
    runtimeIdentity: RUNTIME,
    resolveCredential,
    ...overrides,
  };
}

let diffgazerHome: string;

function setupTempHome() {
  diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-initialize-"));
  assertTempHome(diffgazerHome);
  process.env.DIFFGAZER_HOME = diffgazerHome;
  process.env.GEMINI_KEY = "test-api-key";
  vi.resetModules();
  vi.clearAllMocks();
  catalogMocks.getProviderModels.mockResolvedValue({
    models: [],
    fetchedAt: "",
    source: "live",
    cached: false,
  });
  storeMocks.readCurrentState.mockResolvedValue({
    ok: true,
    value: {
      config: {
        schemaVersion: 2,
        settings: {},
        selectedConfigurationId: null,
        configurations: [],
      },
      secrets: { schemaVersion: 2, bindings: [] },
      evidenceByConfiguration: new Map(),
    },
  });
}

// The config store is mocked here (`storeMocks`), so nothing home-scoped is left pending;
// the temp home still has to fall before DIFFGAZER_HOME is dropped, which `paths.ts`
// re-reads on every call.
function teardownTempHome() {
  vi.restoreAllMocks();
  rmSync(diffgazerHome, { recursive: true, force: true });
  delete process.env.DIFFGAZER_HOME;
  delete process.env.GEMINI_KEY;
}

async function loadInitialize() {
  return import("./initialize.js");
}

describe("toInitializedAIClient", () => {
  beforeEach(setupTempHome);
  afterEach(teardownTempHome);

  it("carries the admitted fingerprint without leaking the credential", async () => {
    const dependencies = createDependencies(readySnapshot());
    const { toInitializedAIClient } = await loadInitialize();
    const authorization = await authorizeReviewExecution("gemini-primary", dependencies);

    expect(authorization.ok).toBe(true);
    if (!authorization.ok) return;
    const client = toInitializedAIClient(authorization.value);

    expect(client.provider).toBe("gemini");
    expect(client.authorization?.plan.evidenceKey.modelId).toBe("gemini-2.5-flash");
    expect(client.authorization?.plan.configurationId).toBe("gemini-primary");
    expect(JSON.stringify(client.authorization?.plan.evidenceKey)).not.toContain("super-secret");
    expect(catalogMocks.getProviderModels).not.toHaveBeenCalled();
    expect(dependencies.resolveCredential).not.toHaveBeenCalled();
  });

  it("preserves safe terminal diagnostics on initialized client failures", async () => {
    const dependencies = createDependencies(readySnapshot());
    const { toInitializedAIClient } = await loadInitialize();
    const authorizationResult = await authorizeReviewExecution("gemini-primary", dependencies);

    expect(authorizationResult.ok).toBe(true);
    if (!authorizationResult.ok) return;

    const authorization = authorizationResult.value;
    const client = toInitializedAIClient(authorization);

    const execution = clientTestExecutionResult(authorization.plan, "transport-failed");
    executeReviewGenerationMock.mockResolvedValueOnce({
      execution,
      diagnostic: {
        code: "transport-failed",
        safeMessage: "Hosted adapter timed out after handshake",
        retryable: true,
        remediation: "Retry the review after checking the provider status.",
        correlationId: "diag-test-123",
        truncatedDetails: "stderr: REDACTED",
      },
    });

    const generateResult = await client.generate("review prompt", z.string());

    expect(generateResult.ok).toBe(false);
    if (generateResult.ok) return;
    expect(generateResult.error).toMatchObject({
      code: "STREAM_ERROR",
      message: "Hosted adapter timed out after handshake",
      diagnostic: {
        code: "transport-failed",
        safeMessage: "Hosted adapter timed out after handshake",
        retryable: true,
        remediation: "Retry the review after checking the provider status.",
        correlationId: "diag-test-123",
      },
    });
    expect(client.terminalExecutions).toEqual([execution]);
    expect(client.terminalDiagnostics).toEqual([generateResult.error.diagnostic]);
  });
});

describe("createAdmissionServiceDependencies", () => {
  beforeEach(setupTempHome);
  afterEach(teardownTempHome);

  it("gives every authorization its own budget ledger", async () => {
    const { createAdmissionServiceDependencies } = await loadInitialize();

    const first = createAdmissionServiceDependencies();
    const second = createAdmissionServiceDependencies();

    // A shared module-level ledger latched one configuration's exhaustion onto
    // every later review until restart.
    const limits = executionLimitsFromBudget(BUDGET);
    expect(first.createBudgetLedger(limits)).not.toBe(second.createBudgetLedger(limits));
  });

  it("constructs dependencies without reading V2 configuration", async () => {
    const { createAdmissionServiceDependencies } = await loadInitialize();
    storeMocks.readCurrentState.mockClear();

    createAdmissionServiceDependencies();

    expect(storeMocks.readCurrentState).not.toHaveBeenCalled();
  });

  it("waits for a serialized current snapshot before resolving the selected configuration", async () => {
    let releaseSnapshot:
      | ((value: {
          ok: true;
          value: {
            config: {
              schemaVersion: 2;
              settings: Record<string, unknown>;
              selectedConfigurationId: string;
              configurations: never[];
            };
            secrets: { schemaVersion: 2; bindings: never[] };
            evidenceByConfiguration: ReadonlyMap<string, unknown>;
          };
        }) => void)
      | undefined;
    storeMocks.readCurrentState.mockReturnValue(
      new Promise((resolve) => {
        releaseSnapshot = resolve;
      }),
    );
    const { resolveSelectedConfigurationId } = await loadInitialize();

    const selected = resolveSelectedConfigurationId();
    releaseSnapshot?.({
      ok: true,
      value: {
        config: {
          schemaVersion: 2,
          settings: {},
          selectedConfigurationId: "gemini-primary",
          configurations: [],
        },
        secrets: { schemaVersion: 2, bindings: [] },
        evidenceByConfiguration: new Map(),
      },
    });

    await expect(selected).resolves.toEqual({ ok: true, value: "gemini-primary" });
    expect(storeMocks.readCurrentState).toHaveBeenCalledOnce();
  });

  it("does not load or dispatch a provider snapshot when store startup is blocked", async () => {
    const blocked = {
      ok: false,
      error: {
        code: "SECRETS_MIGRATION_FAILED",
        message: "attacker-controlled migration detail /private/credential/path",
      },
    } as const;
    storeMocks.readCurrentState.mockResolvedValue(blocked);
    const { createAdmissionServiceDependencies } = await loadInitialize();
    const createLedger = vi.fn((limits) => createBudgetLedger(limits));
    const leaseRegistry = new ExecutionLeaseRegistry();
    const leaseProbe = vi.spyOn(leaseRegistry, "isRevoked");
    const adapterProbe = vi.fn();
    const credentialProbe = vi.fn(async () => null);
    const dependencies = createAdmissionServiceDependencies({
      createBudgetLedger: createLedger,
      leaseRegistry,
      getAdapter: adapterProbe,
      resolveCredential: credentialProbe,
    });
    const result = await authorizeReviewExecution("cfg-v1-gemini", dependencies);

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "configuration-migration-required",
        safeMessage: "Legacy configuration requires manual migration",
      },
    });
    expect(storeMocks.readCurrentState).toHaveBeenCalledOnce();
    expect(createLedger).not.toHaveBeenCalled();
    expect(leaseProbe).not.toHaveBeenCalled();
    expect(adapterProbe).not.toHaveBeenCalled();
    expect(credentialProbe).not.toHaveBeenCalled();
    expect(executeReviewGenerationMock).not.toHaveBeenCalled();
  });
});
