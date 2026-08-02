import { REMOVED_PRODUCT_IDS } from "@diffgazer/core/schemas/config";
import type { EvidenceKey } from "@diffgazer/core/schemas/review";

const REMOVED_PRODUCT_ID = REMOVED_PRODUCT_IDS[0];

import { describe, expect, it } from "vitest";
import { createAdmissionEvidence } from "./admission-evidence.js";
import type { SupportedProviderConfigurationRecord } from "./provider-config.js";
import {
  computeProviderReadiness,
  computeProviderReadinessResult,
  type ProviderReadinessInput,
} from "./readiness.js";
import { createEnvironmentSecretBinding, createNoneSecretBinding } from "./secret-bindings.js";

const CHECKED_AT = "2026-07-31T12:00:00.000Z";
const NOW = "2026-07-31T12:05:00.000Z";
const LIMITS = {
  maxInputTokens: 32_000,
  maxOutputTokens: 8_000,
  maxResponseBytes: 65_536,
  wallTimeMs: 60_000,
  maxRetries: 2,
  maxConcurrency: 1,
  maxCostUsd: 40_000,
} as const;
const BUDGET = {
  inputTokens: LIMITS.maxInputTokens,
  outputTokens: LIMITS.maxOutputTokens,
  responseBytes: LIMITS.maxResponseBytes,
  wallTimeMs: LIMITS.wallTimeMs,
  retries: LIMITS.maxRetries,
  concurrency: LIMITS.maxConcurrency,
  perReview: LIMITS.maxCostUsd,
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

function localRecord(
  patch: Partial<SupportedProviderConfigurationRecord> = {},
): SupportedProviderConfigurationRecord {
  return {
    schemaVersion: 2,
    status: "supported",
    configurationId: "ollama-local",
    revision: 2,
    productId: "ollama",
    transportFamily: "local-http",
    input: {
      transportFamily: "local-http",
      productId: "ollama",
      endpoint: "http://127.0.0.1:11434",
      authentication: "none",
    },
    selectedModelId: "llama3.2",
    acknowledgement: {
      noticeVersion: 1,
      acceptedAt: CHECKED_AT,
    },
    evidenceReference: "evidence-ollama-2",
    budget: BUDGET,
    createdAt: "2026-07-31T11:00:00.000Z",
    updatedAt: CHECKED_AT,
    ...patch,
  };
}

function hostedEvidenceKey(record = hostedRecord()): EvidenceKey {
  return {
    authentication: null,
    credentialReferenceIdentity: "3".repeat(64),
    installationId: null,
    productId: "gemini",
    transportFamily: "hosted-api",
    normalizedEndpoint:
      record.input.transportFamily === "hosted-api" ? record.input.endpoint : null,
    region: null,
    workspaceAccountReference: null,
    modelId: record.selectedModelId ?? "gemini-2.5-flash",
    runtime: { identity: "diffgazer-server", version: "1.2.3" },
    structuredOutputSchemaSha256: "1".repeat(64),
    noticeVersion: 1,
    limits: LIMITS,
  };
}

function passedEvidence(evidenceKey: EvidenceKey) {
  return createAdmissionEvidence({
    evidenceKey,
    checkedAt: CHECKED_AT,
    status: "passed",
    expiresAt: "2026-08-01T00:00:00.000Z",
  });
}

describe("server V2 readiness calculation", () => {
  it("returns every core state with its exact actionable remediation", () => {
    const record = hostedRecord();
    const key = hostedEvidenceKey(record);
    const binding = createEnvironmentSecretBinding(
      record.configurationId,
      record.revision,
      "GEMINI_KEY",
    );
    const ready = computeProviderReadiness({
      configuration: record,
      binding,
      evidence: passedEvidence(key),
      evidenceKey: key,
      credentialReferenceIdentity: "3".repeat(64),
      now: NOW,
    });
    expect(ready.status).toBe("ready");
    expect(ready.action).toBe("inspect");
    expect(ready.remediation.code).toBe("none");

    expect(computeProviderReadiness({ configuration: null }).status).toBe("unconfigured");
    expect(
      computeProviderReadiness({
        configuration: { status: "unknown", rawBytes: new TextEncoder().encode("opaque") },
      }).status,
    ).toBe("unsupported");
    expect(
      computeProviderReadiness({
        configuration: {
          status: "removed",
          schemaVersion: 2,
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
      }).status,
    ).toBe("removed");

    expect(computeProviderReadiness({ configuration: record, binding: null }).status).toBe(
      "credential-invalid",
    );
    expect(
      computeProviderReadiness({
        configuration: record,
        binding,
        evidence: null,
        evidenceKey: key,
        credentialReferenceIdentity: "3".repeat(64),
      }).status,
    ).toBe("conformance-pending");
    expect(
      computeProviderReadiness({
        configuration: record,
        binding,
        evidence: createAdmissionEvidence({
          evidenceKey: key,
          checkedAt: CHECKED_AT,
          status: "skipped",
        }),
        evidenceKey: key,
        credentialReferenceIdentity: "3".repeat(64),
        now: NOW,
      }).status,
    ).toBe("skipped");
    expect(
      computeProviderReadiness({
        configuration: record,
        binding,
        evidence: createAdmissionEvidence({
          evidenceKey: key,
          checkedAt: CHECKED_AT,
          status: "failed",
        }),
        evidenceKey: key,
        credentialReferenceIdentity: "3".repeat(64),
        now: NOW,
      }).status,
    ).toBe("conformance-failed");
    expect(
      computeProviderReadiness({
        configuration: hostedRecord({ selectedModelId: null }),
        binding,
        evidence: null,
      }).status,
    ).toBe("model-missing");
    expect(
      computeProviderReadiness({
        configuration: hostedRecord({ acknowledgement: { noticeVersion: 0, acceptedAt: null } }),
        binding,
        evidence: passedEvidence(key),
        evidenceKey: key,
        credentialReferenceIdentity: "3".repeat(64),
        now: NOW,
      }).status,
    ).toBe("acknowledgement-required");
  });

  it("retains each local failure as a distinct readiness state", () => {
    const record = localRecord();
    const binding = createNoneSecretBinding(record.configurationId, record.revision);
    const statuses = {
      "endpoint-unreachable": "local-endpoint-unreachable",
      "endpoint-forbidden": "local-endpoint-forbidden",
      "api-incompatible": "local-api-incompatible",
      "no-review-capable-model": "local-no-review-capable-model",
      "selected-model-missing": "local-selected-model-missing",
      "conformance-failed": "local-conformance-failed",
      "cancellation-failed": "local-cancellation-failed",
    } as const;

    for (const [localStatus, readinessStatus] of Object.entries(statuses)) {
      expect(
        computeProviderReadiness({
          configuration: record,
          binding,
          localObservation: { status: localStatus as keyof typeof statuses, checkedAt: CHECKED_AT },
        }).status,
      ).toBe(readinessStatus);
    }
  });

  it("invalidates material tuple, model, runtime, notice, and budget changes", () => {
    const record = hostedRecord();
    const key = hostedEvidenceKey(record);
    const binding = createEnvironmentSecretBinding(
      record.configurationId,
      record.revision,
      "GEMINI_KEY",
    );
    const base: ProviderReadinessInput = {
      configuration: record,
      binding,
      evidence: passedEvidence(key),
      evidenceKey: key,
      credentialReferenceIdentity: "3".repeat(64),
      now: NOW,
    };
    expect(computeProviderReadiness(base).status).toBe("ready");
    expect(
      computeProviderReadiness({ ...base, evidenceKey: { ...key, modelId: "gemini-2.5-pro" } })
        .status,
    ).toBe("conformance-failed");
    expect(
      computeProviderReadiness({
        ...base,
        evidenceKey: { ...key, limits: { ...LIMITS, maxOutputTokens: 8_001 } },
      }).status,
    ).toBe("conformance-failed");
    expect(
      computeProviderReadiness({ ...base, credentialReferenceIdentity: "4".repeat(64) }).status,
    ).toBe("conformance-failed");
    expect(
      computeProviderReadiness({
        ...base,
        configuration: hostedRecord({
          acknowledgement: { noticeVersion: 2, acceptedAt: CHECKED_AT },
        }),
      }).status,
    ).toBe("acknowledgement-required");
  });

  it("returns bounded secret-free details and observed checkedAt", () => {
    const record = hostedRecord();
    const key = hostedEvidenceKey(record);
    const result = computeProviderReadinessResult({
      configuration: record,
      binding: createEnvironmentSecretBinding(
        record.configurationId,
        record.revision,
        "GEMINI_API_KEY",
      ),
      evidence: passedEvidence(key),
      evidenceKey: key,
      credentialReferenceIdentity: "3".repeat(64),
      now: NOW,
    });
    expect(result.readiness.checkedAt).toBe(CHECKED_AT);
    expect(result.details).toEqual({
      status: "ready",
      checkedAt: CHECKED_AT,
      evidenceStatus: "passed",
      evidenceKeyHash: result.details.evidenceKeyHash,
    });
    expect(JSON.stringify(result)).not.toContain("GEMINI_API_KEY");
    expect(JSON.stringify(result)).not.toContain("3".repeat(64));
    expect(JSON.stringify(result)).not.toContain("generativelanguage.googleapis.com");
  });
});
