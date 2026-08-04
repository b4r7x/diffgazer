import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  READINESS_PRESENTATION,
  READINESS_STATUSES,
  type Readiness,
  ReadinessSchema,
  type ReadinessStatus,
} from "@diffgazer/core/schemas/config";
import { type EvidenceKey, sha256CanonicalJsonSync } from "@diffgazer/core/schemas/review";
import { describe, expect, it } from "vitest";
import { executionLimitsFromBudget } from "../ai/admission/service.js";
import { createAdmissionEvidence } from "./admission-evidence.js";
import { DEFAULT_CONFIGURATION_BUDGET } from "./store.js";
import {
  configPath,
  diffgazerHome,
  loadStore,
  secretsPath,
  writeJson,
} from "./store.test-support.js";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const CREATED_AT = "2026-01-01T00:00:00.000Z";
const OBSERVED_AT = "2026-01-02T00:00:00.000Z";

const DEFAULT_BUDGET = {
  inputTokens: 200_000,
  outputTokens: 40_000,
  responseBytes: 8_000_000,
  wallTimeMs: 300_000,
  retries: 0,
  concurrency: 1,
  perReview: 5,
};

const v2Config = (
  records: unknown[],
  selectedConfigurationId: string | null = null,
  settings: Record<string, unknown> = {},
) => ({
  schemaVersion: 2,
  settings,
  selectedConfigurationId,
  configurations: records,
});

const v2Secrets = (bindings: unknown[] = []) => ({ schemaVersion: 2, bindings });

const literalSecretPathFor = (configurationId: string, revision: number): string =>
  join(diffgazerHome, "credentials", `${configurationId}-${revision}.key`);

const bindingFor = (configurationId: string) => ({
  configurationId,
  revision: 1,
  kind: "file-0600",
  filePath: literalSecretPathFor(configurationId, 1),
  status: "active",
});

const supportedRecord = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 2,
  status: "supported",
  configurationId: "cfg-existing",
  revision: 1,
  transportFamily: "hosted-api",
  productId: "gemini",
  input: { transportFamily: "hosted-api", productId: "gemini", endpoint: GEMINI_ENDPOINT },
  selectedModelId: "gemini-2.5-flash",
  acknowledgement: { noticeVersion: 1, acceptedAt: OBSERVED_AT },
  evidenceReference: null,
  budget: DEFAULT_BUDGET,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  ...overrides,
});

const createGeminiAction = (
  credential: { kind: "literal"; value: string } | { kind: "environment" },
) =>
  ({
    action: "create",
    input: {
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: GEMINI_ENDPOINT,
      credential,
    },
  }) as const;

const updateGeminiAction = (configurationId: string, expectedRevision: number) =>
  ({
    action: "update",
    configurationId,
    expectedRevision,
    input: { transportFamily: "hosted-api", productId: "gemini", endpoint: GEMINI_ENDPOINT },
    acknowledgement: {
      status: "accepted",
      noticeId: "gemini-hosted-api",
      noticeVersion: 1,
      acceptedAt: OBSERVED_AT,
    },
  }) as const;

const evidenceKeyFor = (configurationId: string): EvidenceKey => ({
  authentication: null,
  credentialReferenceIdentity: sha256CanonicalJsonSync({
    kind: "file-0600",
    filePath: literalSecretPathFor(configurationId, 1),
  }),
  installationId: null,
  productId: "gemini",
  transportFamily: "hosted-api",
  normalizedEndpoint: GEMINI_ENDPOINT,
  region: null,
  workspaceAccountReference: null,
  modelId: "gemini-2.5-flash",
  runtime: { identity: "diffgazer-server", version: "1.0.0" },
  structuredOutputSchemaSha256: "1".repeat(64),
  noticeVersion: 1,
  limits: executionLimitsFromBudget(DEFAULT_CONFIGURATION_BUDGET),
});

async function createReadyConfiguration(): Promise<string> {
  const store = await loadStore();
  const created = await store.runConfigurationAction(
    createGeminiAction({ kind: "literal", value: "sk-test-secret-12345" }),
  );
  if (!created.ok) throw new Error(created.error.message);
  const configurationId = created.value.configuration?.configurationId;
  if (!configurationId) throw new Error("create response requires a configuration");
  await store.runConfigurationAction({
    action: "select",
    configurationId,
    modelId: "gemini-2.5-flash",
  });
  await store.runConfigurationAction(updateGeminiAction(configurationId, 1));
  await store.recordConfigurationEvidence(
    configurationId,
    createAdmissionEvidence({
      evidenceKey: evidenceKeyFor(configurationId),
      checkedAt: OBSERVED_AT,
      status: "passed",
    }),
  );
  return configurationId;
}

async function seedSelectedConfiguration(): Promise<void> {
  writeJson(configPath(), v2Config([supportedRecord()], "cfg-existing"));
  writeJson(secretsPath(), v2Secrets([bindingFor("cfg-existing")]));
}

const EVIDENCE_STATUS_FOR: Record<ReadinessStatus, Readiness["evidenceStatus"]> = {
  unconfigured: "not-checked",
  "credential-invalid": "failed",
  "endpoint-invalid": "failed",
  unreachable: "failed",
  "model-missing": "failed",
  "conformance-pending": "pending",
  "conformance-failed": "failed",
  "acknowledgement-required": "passed",
  unsupported: "not-checked",
  removed: "not-checked",
  skipped: "skipped",
  "local-endpoint-unreachable": "failed",
  "local-endpoint-forbidden": "failed",
  "local-api-incompatible": "failed",
  "local-no-review-capable-model": "failed",
  "local-selected-model-missing": "failed",
  "local-conformance-failed": "failed",
  "local-cancellation-failed": "failed",
  ready: "passed",
};

function acknowledgementFor(status: ReadinessStatus): Readiness["acknowledgement"] {
  if (status === "ready") {
    return {
      status: "accepted",
      noticeId: "gemini-hosted-api",
      noticeVersion: 1,
      acceptedAt: OBSERVED_AT,
    };
  }
  if (status === "acknowledgement-required") {
    return { status: "required", noticeId: "gemini-hosted-api", noticeVersion: 1 };
  }
  return { status: "not-applicable" };
}

function readinessVariantFor(status: ReadinessStatus): Readiness {
  const observed = status !== "unconfigured" && status !== "unsupported" && status !== "removed";
  return ReadinessSchema.parse({
    status,
    ready: status === "ready",
    evidenceStatus: EVIDENCE_STATUS_FOR[status],
    checkedAt: observed ? OBSERVED_AT : null,
    acknowledgement: acknowledgementFor(status),
    ...READINESS_PRESENTATION[status],
  });
}

describe("verdictFromReadiness", () => {
  it.each(
    READINESS_STATUSES,
  )("keeps the %s state distinct with its exact remediation", async (status) => {
    const { verdictFromReadiness } = await import("./setup-status.js");
    const verdict = verdictFromReadiness(readinessVariantFor(status), "cfg-existing");

    expect(verdict.configurationId).toBe("cfg-existing");
    expect(verdict.status).toBe(status);
    expect(verdict.ready).toBe(status === "ready");
    expect(verdict.action).toBe(READINESS_PRESENTATION[status].action);
    expect(verdict.explanation).toBe(READINESS_PRESENTATION[status].explanation);
    expect(verdict.remediation).toEqual(READINESS_PRESENTATION[status].remediation);
  });
});

describe("getSetupVerdict", () => {
  it("reports unconfigured until a configuration is selected", async () => {
    const { getSetupVerdict } = await import("./setup-status.js");

    const result = await getSetupVerdict();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({
      configurationId: null,
      status: "unconfigured",
      ready: false,
      remediation: { code: "configure", message: "Create a configuration to continue." },
    });
  });

  it("does not count an unselected credential as setup", async () => {
    const store = await loadStore();
    await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-test-unselected" }),
    );
    const { getSetupVerdict } = await import("./setup-status.js");

    const result = await getSetupVerdict();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({
      configurationId: null,
      status: "unconfigured",
      ready: false,
    });
  });

  it("is ready only for the selected configuration with passed conformance evidence", async () => {
    const configurationId = await createReadyConfiguration();
    const { getSetupVerdict } = await import("./setup-status.js");

    const result = await getSetupVerdict();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({
      configurationId,
      status: "ready",
      ready: true,
      remediation: { code: "none", message: "No remediation is required." },
    });
  });

  it("reports model-missing for a selected configuration without an exact model", async () => {
    writeJson(configPath(), v2Config([supportedRecord({ selectedModelId: null })], "cfg-existing"));
    writeJson(secretsPath(), v2Secrets([bindingFor("cfg-existing")]));
    const { getSetupVerdict } = await import("./setup-status.js");

    const result = await getSetupVerdict();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({
      configurationId: "cfg-existing",
      status: "model-missing",
      ready: false,
      remediation: { code: "select-model", message: "Select an available exact model." },
    });
  });

  it("reports credential-invalid for a selected configuration without a secret binding", async () => {
    writeJson(configPath(), v2Config([supportedRecord()], "cfg-existing"));
    const { getSetupVerdict } = await import("./setup-status.js");

    const result = await getSetupVerdict();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({
      configurationId: "cfg-existing",
      status: "credential-invalid",
      ready: false,
      remediation: {
        code: "replace-credential",
        message: "Update the configuration with a valid credential reference.",
      },
    });
  });

  it("reports conformance-pending for a selected configuration without live evidence", async () => {
    await seedSelectedConfiguration();
    const { getSetupVerdict } = await import("./setup-status.js");

    const result = await getSetupVerdict();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({
      configurationId: "cfg-existing",
      status: "conformance-pending",
      ready: false,
      remediation: {
        code: "run-conformance",
        message: "Run Test readiness to verify structured review support.",
      },
    });
  });

  it("reports skipped when the live check was explicitly skipped", async () => {
    await seedSelectedConfiguration();
    const store = await loadStore();
    await store.recordConfigurationEvidence(
      "cfg-existing",
      createAdmissionEvidence({
        evidenceKey: evidenceKeyFor("cfg-existing"),
        checkedAt: OBSERVED_AT,
        status: "skipped",
      }),
    );
    const { getSetupVerdict } = await import("./setup-status.js");

    const result = await getSetupVerdict();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({
      configurationId: "cfg-existing",
      status: "skipped",
      ready: false,
      remediation: {
        code: "enable-live-probe",
        message: "Satisfy the live-check prerequisites, then test the configuration again.",
      },
    });
  });

  it("reports conformance-failed when the recorded evidence failed", async () => {
    await seedSelectedConfiguration();
    const store = await loadStore();
    await store.recordConfigurationEvidence(
      "cfg-existing",
      createAdmissionEvidence({
        evidenceKey: evidenceKeyFor("cfg-existing"),
        checkedAt: OBSERVED_AT,
        status: "failed",
      }),
    );
    const { getSetupVerdict } = await import("./setup-status.js");

    const result = await getSetupVerdict();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({
      configurationId: "cfg-existing",
      status: "conformance-failed",
      ready: false,
      remediation: {
        code: "rerun-conformance",
        message: "Review the safe failure guidance, then test the exact model again.",
      },
    });
  });

  it("exposes no secret value, reference, or path in any status output", async () => {
    await createReadyConfiguration();
    const { getSetupStatus, getSetupVerdict } = await import("./setup-status.js");

    const verdictResult = await getSetupVerdict();
    expect(verdictResult.ok).toBe(true);
    if (!verdictResult.ok) throw new Error(verdictResult.error.message);
    const statusResult = getSetupStatus();
    expect(statusResult.ok).toBe(true);
    if (!statusResult.ok) throw new Error(statusResult.error.message);

    const serialized = JSON.stringify(verdictResult.value) + JSON.stringify(statusResult.value);
    expect(serialized).not.toContain("sk-test-secret-12345");
    expect(serialized).not.toContain("GOOGLE_API_KEY");
    expect(serialized).not.toContain("credentials");
    expect(serialized).not.toContain(diffgazerHome);
  });

  it("fails closed with a path-free message when the configuration cannot be read", async () => {
    writeJson(configPath(), { schemaVersion: 1, providers: [] });
    const { getSetupVerdict } = await import("./setup-status.js");

    const result = await getSetupVerdict();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a failed verdict");
    expect(result.error.code).toBe("PERSIST_FAILED");
    expect(result.error.message).not.toContain(diffgazerHome);
  });
});

describe("getSetupStatus", () => {
  it("projects setup state from the selected V2 configuration and stays fail-closed on readiness", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "diffgazer-setup-project-"));
    mkdirSync(join(projectRoot, ".git"));
    try {
      const { getSetupStatus } = await import("./setup-status.js");

      const initial = getSetupStatus(projectRoot);
      expect(initial.ok).toBe(true);
      if (!initial.ok) throw new Error(initial.error.message);
      expect(initial.value).toMatchObject({
        hasSecretsStorage: false,
        hasProvider: false,
        hasModel: false,
        hasTrust: false,
        isConfigured: false,
        isReady: false,
      });
      expect(initial.value.missing).toEqual(["provider", "model", "trust", "secrets storage"]);

      await seedSelectedConfiguration();

      const configured = getSetupStatus(projectRoot);
      expect(configured.ok).toBe(true);
      if (!configured.ok) throw new Error(configured.error.message);
      expect(configured.value).toMatchObject({
        hasSecretsStorage: false,
        hasProvider: true,
        hasModel: true,
        hasTrust: false,
        isConfigured: true,
        isReady: false,
      });
      expect(configured.value.missing).toEqual(["trust", "secrets storage"]);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
