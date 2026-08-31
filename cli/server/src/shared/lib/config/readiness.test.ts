import type { EvidenceKey } from "@diffgazer/core/schemas/review";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildExpectedEvidenceKey,
  createAdmissionEvidence,
  hashAdmissionEvidenceKeySync,
} from "./admission-evidence.js";
import type { SupportedProviderConfigurationRecord } from "./provider-config.js";
import {
  computeProviderReadiness,
  computeProviderReadinessResult,
  type ProviderReadinessInput,
} from "./readiness.js";
import { createEnvironmentSecretBinding } from "./secret-binding-model.js";

const CHECKED_AT = "2026-07-31T12:00:00.000Z";
const NOW = "2026-07-31T12:05:00.000Z";
const ORIGINAL_GEMINI_KEY = process.env.GEMINI_KEY;
const LIMITS = {
  maxInputTokens: 32_000,
  maxResponseBytes: 65_536,
  wallTimeMs: 60_000,
  maxRetries: 2,
  maxConcurrency: 1,
  maxCostUsd: 40_000,
} as const;
const BUDGET = {
  inputTokens: LIMITS.maxInputTokens,
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

const RUNTIME = { identity: "diffgazer-server", version: "1.2.3" } as const;
const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE = "3".repeat(64);

/** What the server recomputes for a record whose credential is still bound. */
const SERVER_OWNED_INPUTS = {
  runtime: RUNTIME,
  structuredOutputSchemaSha256: SCHEMA_SHA256,
  credentialReferenceIdentity: CREDENTIAL_REFERENCE,
} as const;

function hostedEvidenceKey(record = hostedRecord()): EvidenceKey {
  return buildExpectedEvidenceKey({
    record,
    runtime: RUNTIME,
    structuredOutputSchemaSha256: SCHEMA_SHA256,
    credentialReferenceIdentity: CREDENTIAL_REFERENCE,
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

describe("server V2 readiness calculation", () => {
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

  const hostedBinding = () => {
    const record = hostedRecord();
    return createEnvironmentSecretBinding(record.configurationId, record.revision, "GEMINI_KEY");
  };

  it.each<[string, () => ProviderReadinessInput, string]>([
    [
      "an admitted record with passed evidence",
      () => ({
        configuration: hostedRecord(),
        binding: hostedBinding(),
        evidence: passedEvidence(hostedEvidenceKey()),
        ...SERVER_OWNED_INPUTS,
        now: NOW,
      }),
      "ready",
    ],
    ["no configuration at all", () => ({ configuration: null }), "unconfigured"],
    [
      "a configuration this build cannot parse",
      () => ({
        configuration: { status: "unknown", rawBytes: new TextEncoder().encode("opaque") },
      }),
      "unsupported",
    ],
    [
      "a record whose credential is unbound",
      () => ({ configuration: hostedRecord(), binding: null }),
      "credential-invalid",
    ],
    [
      "a bound record with no evidence yet",
      () => ({
        configuration: hostedRecord(),
        binding: hostedBinding(),
        evidence: null,
        ...SERVER_OWNED_INPUTS,
      }),
      "conformance-pending",
    ],
    [
      "a bound record whose evidence failed",
      () => ({
        configuration: hostedRecord(),
        binding: hostedBinding(),
        evidence: createAdmissionEvidence({
          evidenceKey: hostedEvidenceKey(),
          checkedAt: CHECKED_AT,
          status: "failed",
        }),
        ...SERVER_OWNED_INPUTS,
        now: NOW,
      }),
      "conformance-failed",
    ],
    [
      "a record with no selected model",
      () => ({
        configuration: hostedRecord({ selectedModelId: null }),
        binding: hostedBinding(),
        evidence: null,
      }),
      "model-missing",
    ],
    [
      "a record acknowledging a superseded notice version",
      () => ({
        configuration: hostedRecord({
          acknowledgement: { noticeId: "gemini-hosted-api", noticeVersion: 0, acceptedAt: null },
        }),
        binding: hostedBinding(),
        evidence: passedEvidence(hostedEvidenceKey()),
        ...SERVER_OWNED_INPUTS,
        now: NOW,
      }),
      "acknowledgement-required",
    ],
  ])("reads %s as %s", (_label, buildInput, expectedStatus) => {
    expect(computeProviderReadiness(buildInput()).status).toBe(expectedStatus);
  });

  it("asks a ready configuration for nothing beyond inspection", () => {
    const record = hostedRecord();
    const ready = computeProviderReadiness({
      configuration: record,
      binding: hostedBinding(),
      evidence: passedEvidence(hostedEvidenceKey(record)),
      ...SERVER_OWNED_INPUTS,
      now: NOW,
    });

    expect(ready.status).toBe("ready");
    expect(ready.action).toBe("inspect");
    expect(ready.remediation.code).toBe("none");
  });

  it("refuses an unacknowledged record before any evidence exists", () => {
    const record = hostedRecord({
      acknowledgement: { noticeId: "gemini-hosted-api", noticeVersion: 1, acceptedAt: null },
    });
    const binding = createEnvironmentSecretBinding(
      record.configurationId,
      record.revision,
      "GEMINI_KEY",
    );

    const unproven = computeProviderReadiness({
      configuration: record,
      binding,
      evidence: null,
      ...SERVER_OWNED_INPUTS,
    });
    expect(unproven).toMatchObject({
      status: "acknowledgement-required",
      ready: false,
      evidenceStatus: "pending",
      acknowledgement: { status: "required", noticeId: "gemini-hosted-api", noticeVersion: 1 },
    });

    // The notice outranks a cached failure too: accepting it first reveals the
    // failed tuple, never the other way round.
    const failed = computeProviderReadiness({
      configuration: record,
      binding,
      evidence: createAdmissionEvidence({
        evidenceKey: hostedEvidenceKey(record),
        checkedAt: CHECKED_AT,
        status: "failed",
      }),
      ...SERVER_OWNED_INPUTS,
      now: NOW,
    });
    expect(failed).toMatchObject({ status: "acknowledgement-required", evidenceStatus: "failed" });
  });

  it("invalidates material tuple, model, runtime, schema, notice, and budget changes", () => {
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
      ...SERVER_OWNED_INPUTS,
      now: NOW,
    };
    expect(computeProviderReadiness(base).status).toBe("ready");
    // A tuple change still blocks reviews; only the presentation softened from
    // "the contract failed" to "this configuration needs a re-check".
    const staleTuple = { status: "conformance-pending", ready: false };
    expect(
      computeProviderReadiness({
        ...base,
        configuration: hostedRecord({ selectedModelId: "gemini-2.5-pro" }),
      }),
    ).toMatchObject(staleTuple);
    // An upgraded server speaks a newer admission protocol and a newer review
    // schema; evidence proved under the previous ones is not proof of this one.
    expect(
      computeProviderReadiness({
        ...base,
        runtime: { identity: "diffgazer-server", version: "1.2.4" },
      }),
    ).toMatchObject(staleTuple);
    expect(
      computeProviderReadiness({ ...base, structuredOutputSchemaSha256: "2".repeat(64) }),
    ).toMatchObject(staleTuple);
    expect(
      computeProviderReadiness({
        ...base,
        configuration: hostedRecord({ budget: { ...BUDGET, inputTokens: 32_001 } }),
      }),
    ).toMatchObject(staleTuple);
    expect(
      computeProviderReadiness({ ...base, credentialReferenceIdentity: "4".repeat(64) }),
    ).toMatchObject(staleTuple);
    expect(
      computeProviderReadiness({
        ...base,
        configuration: hostedRecord({
          acknowledgement: {
            noticeId: "gemini-hosted-api",
            noticeVersion: 2,
            acceptedAt: CHECKED_AT,
          },
        }),
      }).status,
    ).toBe("acknowledgement-required");
  });

  it("clears a cached conformance failure that belongs to a previous tuple", () => {
    const record = hostedRecord();
    const key = hostedEvidenceKey(record);
    const readiness = computeProviderReadiness({
      configuration: record,
      binding: createEnvironmentSecretBinding(
        record.configurationId,
        record.revision,
        "GEMINI_KEY",
      ),
      evidence: createAdmissionEvidence({
        evidenceKey: { ...key, modelId: "gemini-2.5-pro" },
        checkedAt: CHECKED_AT,
        status: "failed",
        expiresAt: null,
      }),
      ...SERVER_OWNED_INPUTS,
      now: NOW,
    });

    expect(readiness.status).toBe("conformance-pending");
    expect(readiness.ready).toBe(false);
  });

  it("asks for a re-check instead of a failure when campaign-era evidence carries a past expiry", () => {
    const record = hostedRecord();
    const key = hostedEvidenceKey(record);
    const readiness = computeProviderReadiness({
      configuration: record,
      binding: createEnvironmentSecretBinding(
        record.configurationId,
        record.revision,
        "GEMINI_KEY",
      ),
      evidence: createAdmissionEvidence({
        evidenceKey: key,
        checkedAt: CHECKED_AT,
        status: "passed",
        expiresAt: "2026-07-31T12:01:00.000Z",
      }),
      ...SERVER_OWNED_INPUTS,
      now: NOW,
    });

    expect(readiness.status).toBe("conformance-pending");
    expect(readiness.remediation.code).toBe("run-conformance");
    expect(readiness.ready).toBe(false);
  });

  it("keeps unexpiring passed evidence ready long after it was observed", () => {
    const record = hostedRecord();
    const key = hostedEvidenceKey(record);
    const readiness = computeProviderReadiness({
      configuration: record,
      binding: createEnvironmentSecretBinding(
        record.configurationId,
        record.revision,
        "GEMINI_KEY",
      ),
      evidence: createAdmissionEvidence({
        evidenceKey: key,
        checkedAt: CHECKED_AT,
        status: "passed",
        expiresAt: null,
      }),
      ...SERVER_OWNED_INPUTS,
      now: "2027-12-01T00:00:00.000Z",
    });

    expect(readiness.status).toBe("ready");
    expect(readiness.ready).toBe(true);
  });

  it("returns bounded secret-free details and observed checkedAt", () => {
    const record = hostedRecord();
    const key = hostedEvidenceKey(record);
    const result = computeProviderReadinessResult({
      configuration: record,
      binding: createEnvironmentSecretBinding(
        record.configurationId,
        record.revision,
        "GEMINI_KEY",
      ),
      evidence: passedEvidence(key),
      ...SERVER_OWNED_INPUTS,
      now: NOW,
    });
    expect(result.readiness.checkedAt).toBe(CHECKED_AT);
    expect(result.details).toEqual({
      status: "ready",
      checkedAt: CHECKED_AT,
      evidenceStatus: "passed",
      evidenceKeyHash: hashAdmissionEvidenceKeySync(key),
    });
    expect(JSON.stringify(result)).not.toContain("GEMINI_KEY");
    expect(JSON.stringify(result)).not.toContain("3".repeat(64));
    expect(JSON.stringify(result)).not.toContain("generativelanguage.googleapis.com");
  });
});
