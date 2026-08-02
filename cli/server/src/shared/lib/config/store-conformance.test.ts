import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Result } from "@diffgazer/core/result";
import { describe, expect, it, vi } from "vitest";
import { buildExpectedEvidenceKey } from "../ai/admission/service.js";
import { createAdmissionEvidence } from "./admission-evidence.js";
import type {
  ConfigurationConformanceProbe,
  ConfigurationConformanceSubject,
} from "./conformance.js";
import {
  configPath,
  diffgazerHome,
  keyring,
  loadStore,
  readJson,
  secretsPath,
  writeJson,
} from "./store.test-support.js";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const CREATED_AT = "2026-01-01T00:00:00.000Z";
const RUNTIME = { identity: "diffgazer-server", version: "1.0.0" } as const;
const SCHEMA_SHA256 = "1".repeat(64);

const DEFAULT_BUDGET = {
  inputTokens: 200_000,
  outputTokens: 40_000,
  responseBytes: 8_000_000,
  wallTimeMs: 300_000,
  retries: 0,
  concurrency: 1,
  perReview: 5,
};

const literalSecretPathFor = (configurationId: string, revision: number): string =>
  join(diffgazerHome, "credentials", `${configurationId}-${revision}.key`);

const evidencePathFor = (configurationId: string): string =>
  join(diffgazerHome, "evidence", `evidence-${configurationId}.json`);

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

const updateGeminiAction = (
  configurationId: string,
  expectedRevision: number,
  credential?: { kind: "literal"; value: string },
) =>
  ({
    action: "update",
    configurationId,
    expectedRevision,
    input: {
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: GEMINI_ENDPOINT,
      ...(credential ? { credential } : {}),
    },
    acknowledgement: {
      status: "accepted",
      noticeId: "gemini-hosted-api",
      noticeVersion: 1,
      acceptedAt: "2026-01-02T00:00:00.000Z",
    },
  }) as const;

const succeed = <T>(result: Result<T, unknown>): T => {
  if (!result.ok) throw new Error("expected a succeeded configuration action");
  return result.value;
};

const passingProbe: ConfigurationConformanceProbe = async ({ subject }) => ({
  status: "passed",
  evidence: createAdmissionEvidence({
    evidenceKey: buildExpectedEvidenceKey({
      record: subject.record,
      structuredOutputSchemaSha256: SCHEMA_SHA256,
      runtime: RUNTIME,
      credentialReferenceIdentity: subject.credentialReferenceIdentity,
      workspaceAccountReference: subject.workspaceAccountReference,
    }),
    checkedAt: new Date().toISOString(),
    status: "passed",
  }),
});

const registerProbe = async (probe: ConfigurationConformanceProbe): Promise<void> => {
  const { setConfigurationConformanceProbe } = await import("./conformance.js");
  setConfigurationConformanceProbe(probe);
};

const createAdmittedConfiguration = async (
  store: Awaited<ReturnType<typeof loadStore>>,
): Promise<string> => {
  const created = succeed(
    await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-conformance-secret" }),
    ),
  );
  const configurationId = created.configuration?.configurationId;
  if (!configurationId) throw new Error("create response requires a configuration");

  succeed(
    await store.runConfigurationAction({
      action: "select",
      configurationId,
      modelId: "gemini-2.5-flash",
    }),
  );
  succeed(await store.runConfigurationAction(updateGeminiAction(configurationId, 1)));
  return configurationId;
};

describe("configuration test action", () => {
  it("admits a configuration from a passed observation and keeps it admitted after a restart", async () => {
    await registerProbe(passingProbe);
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);

    const tested = succeed(await store.runConfigurationAction({ action: "test", configurationId }));
    expect(tested.readiness).toMatchObject({ status: "ready", ready: true });
    expect(existsSync(evidencePathFor(configurationId))).toBe(true);
    expect(
      readJson<{ configurations: Array<{ evidenceReference: string }> }>(configPath())
        .configurations[0]?.evidenceReference,
    ).toBe(`evidence-${configurationId}`);

    vi.resetModules();
    const restarted = await loadStore();
    await restarted.ready();

    expect(restarted.getConfigurationAdmissionEvidence(configurationId)).toMatchObject({
      status: "passed",
    });
    const inspected = succeed(
      await restarted.runConfigurationAction({ action: "inspect", configurationId }),
    );
    expect(inspected.readiness).toMatchObject({ status: "ready", ready: true });
  });

  it("records no evidence when the observation does not pass", async () => {
    await registerProbe(async () => ({ status: "failed", reason: "endpoint unreachable" }));
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);

    const tested = succeed(await store.runConfigurationAction({ action: "test", configurationId }));

    expect(tested.readiness).toMatchObject({ status: "skipped", ready: false });
    expect(existsSync(evidencePathFor(configurationId))).toBe(false);
    expect(store.getConfigurationAdmissionEvidence(configurationId)).toBeNull();
  });

  it("rejects an observation whose evidence does not match the configuration tuple", async () => {
    await registerProbe(async ({ subject }: { subject: ConfigurationConformanceSubject }) => ({
      status: "passed",
      evidence: createAdmissionEvidence({
        evidenceKey: {
          ...buildExpectedEvidenceKey({
            record: subject.record,
            structuredOutputSchemaSha256: SCHEMA_SHA256,
            runtime: RUNTIME,
            credentialReferenceIdentity: subject.credentialReferenceIdentity,
            workspaceAccountReference: subject.workspaceAccountReference,
          }),
          modelId: "gemini-2.5-pro",
        },
        checkedAt: new Date().toISOString(),
        status: "passed",
      }),
    }));
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);

    const tested = succeed(await store.runConfigurationAction({ action: "test", configurationId }));

    expect(tested.readiness).toMatchObject({ status: "skipped", ready: false });
    expect(existsSync(evidencePathFor(configurationId))).toBe(false);
  });

  it("drops admission evidence when the selected model changes", async () => {
    await registerProbe(passingProbe);
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);
    succeed(await store.runConfigurationAction({ action: "test", configurationId }));

    succeed(
      await store.runConfigurationAction({
        action: "select",
        configurationId,
        modelId: "gemini-2.5-pro",
      }),
    );

    expect(existsSync(evidencePathFor(configurationId))).toBe(false);
    expect(store.getConfigurationAdmissionEvidence(configurationId)).toBeNull();
  });
});

describe("configuration credential lifecycle", () => {
  it("deletes the previous revision's secret material when a credential is rotated", async () => {
    const store = await loadStore();
    const created = succeed(
      await store.runConfigurationAction(
        createGeminiAction({ kind: "literal", value: "sk-proj-leaked-credential" }),
      ),
    );
    const configurationId = created.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");
    expect(existsSync(literalSecretPathFor(configurationId, 1))).toBe(true);

    succeed(
      await store.runConfigurationAction(
        updateGeminiAction(configurationId, 1, {
          kind: "literal",
          value: "sk-proj-rotated-credential",
        }),
      ),
    );

    expect(existsSync(literalSecretPathFor(configurationId, 1))).toBe(false);
    expect(existsSync(literalSecretPathFor(configurationId, 2))).toBe(true);
  });

  it("keeps the secret material of a credential carried forward across an update", async () => {
    const store = await loadStore();
    const created = succeed(
      await store.runConfigurationAction(
        createGeminiAction({ kind: "literal", value: "sk-proj-carried-credential" }),
      ),
    );
    const configurationId = created.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    succeed(await store.runConfigurationAction(updateGeminiAction(configurationId, 1)));

    expect(existsSync(literalSecretPathFor(configurationId, 1))).toBe(true);
  });

  it("reports a failed delete when credential material cannot be removed", async () => {
    writeJson(configPath(), {
      schemaVersion: 2,
      settings: { secretsStorage: "keyring" },
      selectedConfigurationId: null,
      configurations: [
        {
          schemaVersion: 2,
          status: "supported",
          configurationId: "cfg-keyring",
          revision: 1,
          transportFamily: "hosted-api",
          productId: "gemini",
          input: { transportFamily: "hosted-api", productId: "gemini", endpoint: GEMINI_ENDPOINT },
          selectedModelId: null,
          acknowledgement: { noticeVersion: 1, acceptedAt: null },
          evidenceReference: null,
          budget: DEFAULT_BUDGET,
          createdAt: CREATED_AT,
          updatedAt: CREATED_AT,
        },
      ],
    });
    writeJson(secretsPath(), {
      schemaVersion: 2,
      bindings: [
        {
          configurationId: "cfg-keyring",
          revision: 1,
          kind: "keyring-reference",
          keyId: "diffgazer/cfg-keyring/1",
          status: "active",
        },
      ],
    });
    keyring.deleteKeyringSecret.mockReturnValue({
      ok: false,
      error: { code: "KEYRING_UNAVAILABLE", message: "keyring is locked" },
    });
    const store = await loadStore();

    const deleted = succeed(
      await store.runConfigurationAction({
        action: "delete",
        configurationId: "cfg-keyring",
        expectedRevision: 1,
      }),
    );

    expect(deleted).toMatchObject({ action: "delete", status: "failed" });
  });
});
