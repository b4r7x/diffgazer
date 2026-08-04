import { afterEach, describe, expect, it, vi } from "vitest";
import { hashAdmissionEvidenceKeySync } from "../../config/admission-evidence.js";
import type { ConfigurationConformanceSubject } from "../../config/conformance.js";
import {
  type SupportedProviderConfigurationRecord,
  SupportedProviderConfigurationRecordSchema,
} from "../../config/provider-config.js";
import { buildExpectedEvidenceKey } from "../admission/service.js";
import { RUNTIME_IDENTITY, STRUCTURED_OUTPUT_SCHEMA_SHA256 } from "../client/initialize.js";
import { createHostedConformanceProbe } from "./conformance-probe.js";

const CREDENTIAL_ENV = "DIFFGAZER_TEST_CONFORMANCE_KEY";
const CREDENTIAL = "sk-test-conformance-credential";
const TIMESTAMP = "2026-01-01T00:00:00.000Z";

const BUDGET = {
  inputTokens: 200_000,
  outputTokens: 40_000,
  responseBytes: 8_000_000,
  wallTimeMs: 300_000,
  retries: 0,
  concurrency: 1,
  perReview: 5,
};

const RECORD_BASE = {
  schemaVersion: 2,
  status: "supported",
  configurationId: "cfg-conformance-probe",
  revision: 1,
  acknowledgement: { noticeVersion: 1, acceptedAt: TIMESTAMP },
  evidenceReference: null,
  budget: BUDGET,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
};

function geminiRecord(patch: Record<string, unknown> = {}): SupportedProviderConfigurationRecord {
  return SupportedProviderConfigurationRecordSchema.parse({
    ...RECORD_BASE,
    transportFamily: "hosted-api",
    productId: "gemini",
    input: {
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
    },
    selectedModelId: "gemini-2.5-flash",
    ...patch,
  });
}

function localCliRecord(): SupportedProviderConfigurationRecord {
  return SupportedProviderConfigurationRecordSchema.parse({
    ...RECORD_BASE,
    transportFamily: "local-cli",
    productId: "codex-cli",
    input: {
      transportFamily: "local-cli",
      productId: "codex-cli",
      installationId: "codex-installation-1",
    },
    selectedModelId: null,
  });
}

function subjectFor(
  record: SupportedProviderConfigurationRecord,
  overrides: Partial<ConfigurationConformanceSubject> = {},
): ConfigurationConformanceSubject {
  return {
    record,
    binding: {
      configurationId: record.configurationId,
      revision: record.revision,
      kind: "environment-reference",
      varName: CREDENTIAL_ENV,
      status: "active",
    },
    credentialReferenceIdentity: "a".repeat(64),
    workspaceAccountReference: null,
    ...overrides,
  };
}

const googleReviewBody = JSON.stringify({
  candidates: [
    { content: { parts: [{ text: JSON.stringify({ issues: [] }) }] }, finishReason: "STOP" },
  ],
  usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8, totalTokenCount: 20 },
});

function stubFetch(createResponse: () => Response) {
  const fetchMock = vi.fn(async () => createResponse());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("createHostedConformanceProbe", () => {
  it("passes with tuple-exact admission evidence when the hosted request completes", async () => {
    vi.stubEnv(CREDENTIAL_ENV, CREDENTIAL);
    const fetchMock = stubFetch(() => jsonResponse(googleReviewBody));
    const record = geminiRecord();
    const subject = subjectFor(record);

    const observation = await createHostedConformanceProbe()({
      subject,
      signal: new AbortController().signal,
    });

    if (observation.status !== "passed") {
      throw new Error(`expected a passed observation, got ${observation.status}`);
    }
    expect(observation.evidence.status).toBe("passed");
    expect(observation.evidence.evidenceKeyHash).toBe(
      hashAdmissionEvidenceKeySync(
        buildExpectedEvidenceKey({
          record,
          structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
          runtime: RUNTIME_IDENTITY,
          credentialReferenceIdentity: subject.credentialReferenceIdentity,
          workspaceAccountReference: subject.workspaceAccountReference,
        }),
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails with a credential-safe reason when the provider rejects the request", async () => {
    vi.stubEnv(CREDENTIAL_ENV, CREDENTIAL);
    stubFetch(() => jsonResponse(JSON.stringify({ error: `invalid key ${CREDENTIAL}` }), 401));

    const observation = await createHostedConformanceProbe()({
      subject: subjectFor(geminiRecord()),
      signal: new AbortController().signal,
    });

    if (observation.status !== "failed") {
      throw new Error(`expected a failed observation, got ${observation.status}`);
    }
    expect(observation.reason).not.toContain(CREDENTIAL);
  });

  it("fails without dispatching when no credential binding is active", async () => {
    const fetchMock = stubFetch(() => jsonResponse(googleReviewBody));

    const observation = await createHostedConformanceProbe()({
      subject: subjectFor(geminiRecord(), { binding: null, credentialReferenceIdentity: null }),
      signal: new AbortController().signal,
    });

    expect(observation).toEqual({ status: "failed", reason: "No active credential binding" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips without dispatching when no exact model is selected", async () => {
    const fetchMock = stubFetch(() => jsonResponse(googleReviewBody));

    const observation = await createHostedConformanceProbe()({
      subject: subjectFor(geminiRecord({ selectedModelId: null })),
      signal: new AbortController().signal,
    });

    expect(observation).toEqual({ status: "skipped", reason: "No exact model is selected" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips local transports instead of failing them", async () => {
    const fetchMock = stubFetch(() => jsonResponse(googleReviewBody));

    const observation = await createHostedConformanceProbe()({
      subject: subjectFor(localCliRecord(), { binding: null, credentialReferenceIdentity: null }),
      signal: new AbortController().signal,
    });

    expect(observation).toEqual({
      status: "skipped",
      reason: "Conformance probing is not implemented for this transport family",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
