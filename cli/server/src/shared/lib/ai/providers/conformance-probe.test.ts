import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildExpectedEvidenceKey,
  hashAdmissionEvidenceKeySync,
} from "../../config/admission-evidence.js";
import type { ConfigurationConformanceSubject } from "../../config/conformance.js";
import {
  type SupportedProviderConfigurationRecord,
  SupportedProviderConfigurationRecordSchema,
} from "../../config/provider-config.js";
import { RUNTIME_IDENTITY, STRUCTURED_OUTPUT_SCHEMA_SHA256 } from "../admission/protocol.js";
import { runCliCompatibilityProbe } from "./cli-compatibility/probe.js";
import { createConformanceProbe, createHostedConformanceProbe } from "./conformance-probe.js";

vi.mock("./cli-compatibility/probe.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./cli-compatibility/probe.js")>();
  return {
    ...actual,
    runCliCompatibilityProbe: vi.fn(actual.runCliCompatibilityProbe),
  };
});

const keyringStorage = vi.hoisted(() => new Map<string, string>());

vi.mock("../../config/keyring.js", () => ({
  readKeyringSecret: (key: string) => ({ ok: true, value: keyringStorage.get(key) ?? null }),
  writeKeyringSecret: (key: string, value: string) => {
    keyringStorage.set(key, value);
    return { ok: true, value: undefined };
  },
  deleteKeyringSecret: (key: string) => ({ ok: true, value: keyringStorage.delete(key) }),
  isKeyringAvailable: () => true,
}));

const CREDENTIAL_ENV = "DIFFGAZER_TEST_CONFORMANCE_KEY";
const CREDENTIAL = "sk-test-conformance-credential";
const TIMESTAMP = "2026-01-01T00:00:00.000Z";

const BUDGET = {
  inputTokens: 200_000,
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
  acknowledgement: { noticeId: "gemini-hosted-api", noticeVersion: 1, acceptedAt: TIMESTAMP },
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

function localHttpRecord(
  patch: Record<string, unknown> = {},
): SupportedProviderConfigurationRecord {
  return SupportedProviderConfigurationRecordSchema.parse({
    ...RECORD_BASE,
    transportFamily: "local-http",
    productId: "ollama",
    input: {
      transportFamily: "local-http",
      productId: "ollama",
      endpoint: "http://127.0.0.1:11434",
      authentication: "none",
    },
    selectedModelId: "llama3.2",
    ...patch,
  });
}

/**
 * Local HTTP transports connect through a loopback-bound `node:http` client, so
 * a global `fetch` stub never sees them. The probe is exercised against a real
 * loopback server instead, the same way the local HTTP transport tests do.
 */
async function startOllamaLoopbackServer(): Promise<{
  endpoint: string;
  paths: string[];
  close: () => Promise<void>;
}> {
  const paths: string[] = [];
  const server = createServer((request, response) => {
    const path = request.url ?? "";
    paths.push(path);
    const send = (body: unknown) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (path.startsWith("/api/version")) return send({ version: "0.6.0" });
    if (path.startsWith("/api/tags")) {
      return send({ models: [{ name: "llama3.2", details: { family: "llama" } }] });
    }
    if (request.method === "POST" && path.startsWith("/api/chat")) {
      return send({ message: { content: '{"issues":[]}' } });
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end("{}");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Loopback conformance server did not bind a port");
  }

  return {
    endpoint: `http://127.0.0.1:${address.port}`,
    paths,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
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
    selectedModelId: "gpt-5",
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
  keyringStorage.clear();
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
    // Durable until the tuple changes: the probe stamps no expiry.
    expect(observation.evidence.expiresAt ?? null).toBeNull();
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

  it("resolves keyring-reference credentials through production secret IO", async () => {
    const record = geminiRecord();
    const keyId = `${record.configurationId}/${record.revision}/credential`;
    keyringStorage.set(keyId, CREDENTIAL);
    const fetchMock = stubFetch(() => jsonResponse(googleReviewBody));
    const subject = subjectFor(record, {
      binding: {
        configurationId: record.configurationId,
        revision: record.revision,
        kind: "keyring-reference",
        keyId,
        status: "active",
      },
    });

    const observation = await createHostedConformanceProbe()({
      subject,
      signal: new AbortController().signal,
    });

    if (observation.status !== "passed") {
      throw new Error(`expected a passed observation, got ${observation.status}`);
    }
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
    // A rejected request says nothing about the tuple, so it must not cache a
    // verdict that would fast-fail every later review.
    expect(observation.evidence).toBeUndefined();
  });

  it("carries a tuple-exact failed verdict when the response misses the review schema", async () => {
    vi.stubEnv(CREDENTIAL_ENV, CREDENTIAL);
    stubFetch(() =>
      jsonResponse(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: JSON.stringify({ issues: "not-a-list" }) }] } },
          ],
          usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8, totalTokenCount: 20 },
        }),
      ),
    );
    const record = geminiRecord();
    const subject = subjectFor(record);

    const observation = await createHostedConformanceProbe()({
      subject,
      signal: new AbortController().signal,
    });

    if (observation.status !== "failed") {
      throw new Error(`expected a failed observation, got ${observation.status}`);
    }
    expect(observation.evidence?.status).toBe("failed");
    expect(observation.evidence?.expiresAt ?? null).toBeNull();
    expect(observation.evidence?.evidenceKeyHash).toBe(
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

describe("createConformanceProbe", () => {
  it("passes local-http configurations through the HTTP conformance probe", async () => {
    const runtime = await startOllamaLoopbackServer();
    try {
      const record = localHttpRecord({
        input: {
          transportFamily: "local-http",
          productId: "ollama",
          endpoint: runtime.endpoint,
          authentication: "none",
        },
      });
      const subject = subjectFor(record, { binding: null, credentialReferenceIdentity: null });

      const observation = await createConformanceProbe()({
        subject,
        signal: new AbortController().signal,
      });

      if (observation.status !== "passed") {
        throw new Error(`expected a passed observation, got ${observation.status}`);
      }
      expect(observation.evidence.status).toBe("passed");
      expect(observation.evidence.expiresAt ?? null).toBeNull();
      expect(runtime.paths).toContain("/api/version");
      expect(runtime.paths).toContain("/api/chat");
    } finally {
      await runtime.close();
    }
  });

  it("passes local-cli configurations after exactly one live generation", async () => {
    vi.mocked(runCliCompatibilityProbe).mockResolvedValueOnce({
      status: "positive-passed",
      provider: "codex-cli",
      version: "1.0.0",
    });

    const record = localCliRecord();
    const controller = new AbortController();
    const observation = await createConformanceProbe()({
      subject: subjectFor(record, { binding: null, credentialReferenceIdentity: null }),
      signal: controller.signal,
    });

    if (observation.status !== "passed") {
      throw new Error(`expected a passed observation, got ${observation.status}`);
    }
    expect(observation.evidence.evidenceKey.runtime).toEqual({
      identity: "codex-cli",
      version: "1.0.0",
    });
    // The observation's abort signal reaches the probe, so losing the admitted
    // wall time terminates the vendor CLI instead of leaving it running.
    expect(runCliCompatibilityProbe).toHaveBeenCalledWith({
      provider: "codex-cli",
      modelId: "gpt-5",
      liveOptIn: true,
      fixtures: "positive-only",
      signal: controller.signal,
    });
  });

  it("still routes hosted-api configurations through the hosted adapter", async () => {
    vi.stubEnv(CREDENTIAL_ENV, CREDENTIAL);
    const fetchMock = stubFetch(() => jsonResponse(googleReviewBody));
    const record = geminiRecord();

    const observation = await createConformanceProbe()({
      subject: subjectFor(record),
      signal: new AbortController().signal,
    });

    if (observation.status !== "passed") {
      throw new Error(`expected a passed observation, got ${observation.status}`);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
