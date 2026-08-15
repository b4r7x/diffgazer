import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Result } from "@diffgazer/core/result";
import { READINESS_PRESENTATION } from "@diffgazer/core/schemas/config";
import { describe, expect, it, vi } from "vitest";
import { RUNTIME_IDENTITY, STRUCTURED_OUTPUT_SCHEMA_SHA256 } from "../ai/admission/protocol.js";
import { atomicWriteFile, writeJsonFile } from "../fs.js";
import { buildExpectedEvidenceKey, createAdmissionEvidence } from "./admission-evidence.js";
import type {
  ConfigurationConformanceProbe,
  ConfigurationConformanceSubject,
} from "./conformance.js";
import { getConfigurationSecretName } from "./secrets-store.js";
import {
  configPath,
  diffgazerHome,
  fsHooks,
  keyring,
  loadStore,
  readJson,
  secretsPath,
  writeJson,
} from "./store.test-support.js";

const { mockLog } = vi.hoisted(() => ({ mockLog: vi.fn() }));

// Boundary mock: the structured logger writes process-visible diagnostics and is
// silenced under VITEST, so the credential-safe conformance reason it carries can
// only be asserted through the logging boundary itself.
vi.mock("../log.js", () => ({ log: mockLog }));

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const CREATED_AT = "2026-01-01T00:00:00.000Z";

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

const readEvidence = async (
  store: Awaited<ReturnType<typeof loadStore>>,
  configurationId: string,
) => {
  const current = succeed(await store.readCurrentState());
  return current.evidenceByConfiguration.get(configurationId) ?? null;
};

const readSetupVerdict = async () => {
  const { getSetupVerdict } = await import("./setup-status.js");
  return getSetupVerdict();
};

const passingProbe: ConfigurationConformanceProbe = async ({ subject }) => ({
  status: "passed",
  evidence: createAdmissionEvidence({
    evidenceKey: buildExpectedEvidenceKey({
      record: subject.record,
      structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
      runtime: RUNTIME_IDENTITY,
      credentialReferenceIdentity: subject.credentialReferenceIdentity,
      workspaceAccountReference: subject.workspaceAccountReference,
    }),
    checkedAt: new Date().toISOString(),
    status: "passed",
  }),
});

const registerProbe = async (probe: ConfigurationConformanceProbe): Promise<void> => {
  const { registerConfigSeams } = await import("./seams.js");
  registerConfigSeams({ conformanceProbe: probe });
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
    expect(tested).toMatchObject({ action: "test", status: "succeeded" });
    expect(tested.readiness).toMatchObject({ status: "ready", ready: true });
    expect(existsSync(evidencePathFor(configurationId))).toBe(true);
    expect(await readSetupVerdict()).toMatchObject({
      ok: true,
      value: { status: "ready", ready: true },
    });
    expect(
      readJson<{ configurations: Array<{ evidenceReference: string }> }>(configPath())
        .configurations[0]?.evidenceReference,
    ).toBe(`evidence-${configurationId}`);

    vi.resetModules();
    const restarted = await loadStore();
    await restarted.ready();

    expect(await readEvidence(restarted, configurationId)).toMatchObject({
      status: "passed",
    });
    const inspected = succeed(
      await restarted.runConfigurationAction({ action: "inspect", configurationId }),
    );
    expect(inspected.readiness).toMatchObject({ status: "ready", ready: true });
  });

  it("asks for a re-check when the admitted verdict was proved by an older server protocol", async () => {
    await registerProbe(passingProbe);
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);
    succeed(await store.runConfigurationAction({ action: "test", configurationId }));
    const admitted = await readEvidence(store, configurationId);
    if (!admitted) throw new Error("expected an admitted verdict");

    // What an upgrade leaves behind on disk: the same tuple, proved by the
    // admission protocol the previous release spoke. It is no proof about this one.
    writeJson(
      evidencePathFor(configurationId),
      createAdmissionEvidence({
        evidenceKey: {
          ...admitted.evidenceKey,
          runtime: { ...RUNTIME_IDENTITY, version: "0.9.0" },
        },
        checkedAt: new Date().toISOString(),
        status: "passed",
      }),
    );
    vi.resetModules();
    const restarted = await loadStore();
    await expect(restarted.ready()).resolves.toMatchObject({ ok: true });

    const inspected = succeed(
      await restarted.runConfigurationAction({ action: "inspect", configurationId }),
    );
    expect(inspected.readiness).toMatchObject({ status: "conformance-pending", ready: false });
    expect(await readSetupVerdict()).toMatchObject({
      ok: true,
      value: { status: "conformance-pending", ready: false },
    });
  });

  it("refuses a verdict stamped with a protocol revision or review schema this server does not speak", async () => {
    await registerProbe(passingProbe);
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);
    succeed(await store.runConfigurationAction({ action: "test", configurationId }));
    const admitted = await readEvidence(store, configurationId);
    if (!admitted) throw new Error("expected an admitted verdict");
    const admittedOnDisk = readFileSync(evidencePathFor(configurationId), "utf8");

    // The revision and the review schema a verdict was proved under are this
    // server's to name; a submission that stamps its own would vouch for itself.
    expect(
      await store.recordConfigurationEvidence(
        configurationId,
        createAdmissionEvidence({
          evidenceKey: {
            ...admitted.evidenceKey,
            runtime: { ...RUNTIME_IDENTITY, version: "0.9.0" },
          },
          checkedAt: new Date().toISOString(),
          status: "passed",
        }),
      ),
    ).toMatchObject({ ok: false, error: { code: "CONFIGURATION_CONFLICT" } });
    expect(
      await store.recordConfigurationEvidence(
        configurationId,
        createAdmissionEvidence({
          evidenceKey: { ...admitted.evidenceKey, structuredOutputSchemaSha256: "2".repeat(64) },
          checkedAt: new Date().toISOString(),
          status: "passed",
        }),
      ),
    ).toMatchObject({ ok: false, error: { code: "CONFIGURATION_CONFLICT" } });

    // The verdict the probe genuinely proved is untouched by either refusal.
    expect(readFileSync(evidencePathFor(configurationId), "utf8")).toBe(admittedOnDisk);
    const inspected = succeed(
      await store.runConfigurationAction({ action: "inspect", configurationId }),
    );
    expect(inspected.readiness).toMatchObject({ status: "ready", ready: true });
  });

  it("reports a failed observation as a conformance failure and records no evidence", async () => {
    await registerProbe(async () => ({ status: "failed", reason: "endpoint unreachable" }));
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);

    const tested = succeed(await store.runConfigurationAction({ action: "test", configurationId }));

    expect(tested).toMatchObject({ action: "test", status: "failed" });
    expect(tested.readiness).toMatchObject({
      status: "conformance-failed",
      ready: false,
      evidenceStatus: "failed",
      remediation: { code: "rerun-conformance" },
    });
    expect(mockLog).toHaveBeenCalledWith("warn", "config_conformance_failed", {
      configurationId,
      reason: "endpoint unreachable",
    });
    expect(existsSync(evidencePathFor(configurationId))).toBe(false);
    expect(await readEvidence(store, configurationId)).toBeNull();
    expect(
      readJson<{ configurations: Array<{ evidenceReference: string | null }> }>(configPath())
        .configurations[0]?.evidenceReference,
    ).toBeNull();
    // The persisted verdict never saw the failed observation: with no recorded
    // evidence the setup gate keeps demanding the test the response just
    // reported as failed, so the two must stay in agreement about not-ready.
    expect(await readSetupVerdict()).toMatchObject({
      ok: true,
      value: {
        status: "conformance-pending",
        ready: false,
        remediation: {
          message: READINESS_PRESENTATION["conformance-pending"].remediation.message,
        },
      },
    });
  });

  it("reports a re-test whose probe failed as failed without discarding the admitted verdict", async () => {
    await registerProbe(passingProbe);
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);
    succeed(await store.runConfigurationAction({ action: "test", configurationId }));

    await registerProbe(async () => ({ status: "failed", reason: "Provider rate limited" }));
    const retested = succeed(
      await store.runConfigurationAction({ action: "test", configurationId }),
    );

    // The user paid for a live generation that failed, so the action failed —
    // the verdict already on disk cannot make this test a success.
    expect(retested).toMatchObject({ action: "test", status: "failed" });
    expect(retested.readiness).toMatchObject({ status: "conformance-failed", ready: false });
    // The earlier paid observation survives the failed re-test, so the
    // configuration is still admitted the moment it is read again.
    expect(await readEvidence(store, configurationId)).toMatchObject({ status: "passed" });
    expect(await readSetupVerdict()).toMatchObject({
      ok: true,
      value: { status: "ready", ready: true },
    });
  });

  it("reports a re-test the probe declined to make as failed without discarding the admitted verdict", async () => {
    await registerProbe(passingProbe);
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);
    succeed(await store.runConfigurationAction({ action: "test", configurationId }));

    await registerProbe(async () => ({ status: "skipped", reason: "No exact model is selected" }));
    const retested = succeed(
      await store.runConfigurationAction({ action: "test", configurationId }),
    );

    expect(retested).toMatchObject({ action: "test", status: "failed" });
    expect(retested.readiness).toMatchObject({ status: "skipped", ready: false });
    expect(await readEvidence(store, configurationId)).toMatchObject({ status: "passed" });
    expect(await readSetupVerdict()).toMatchObject({
      ok: true,
      value: { status: "ready", ready: true },
    });
  });

  it("stops reporting ready once the credential file behind the configuration is gone", async () => {
    await registerProbe(passingProbe);
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);
    succeed(await store.runConfigurationAction({ action: "test", configurationId }));
    expect(await readSetupVerdict()).toMatchObject({
      ok: true,
      value: { status: "ready", ready: true },
    });

    rmSync(literalSecretPathFor(configurationId, 1));

    // Removed out of band — exactly what a cleaned-up credentials directory
    // does. A green, review-attemptable configuration would be a lie.
    expect(await readSetupVerdict()).toMatchObject({
      ok: true,
      value: { status: "credential-invalid", ready: false },
    });
  });

  it("keeps a tested tuple red when the observation proves it cannot answer in schema", async () => {
    await registerProbe(async ({ subject }) => ({
      status: "failed",
      reason: "Provider response did not satisfy the structured review contract",
      evidence: createAdmissionEvidence({
        evidenceKey: buildExpectedEvidenceKey({
          record: subject.record,
          structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
          runtime: RUNTIME_IDENTITY,
          credentialReferenceIdentity: subject.credentialReferenceIdentity,
          workspaceAccountReference: subject.workspaceAccountReference,
        }),
        checkedAt: new Date().toISOString(),
        status: "failed",
        expiresAt: null,
      }),
    }));
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);

    const tested = succeed(await store.runConfigurationAction({ action: "test", configurationId }));

    expect(tested).toMatchObject({ action: "test", status: "failed" });
    // The billed observation survives the response it produced: the next read
    // still reports the failure instead of decaying to "check needed".
    expect(await readEvidence(store, configurationId)).toMatchObject({
      status: "failed",
      expiresAt: null,
    });
    expect(await readSetupVerdict()).toMatchObject({
      ok: true,
      value: { status: "conformance-failed", ready: false },
    });
  });

  it("accepts a failed evidence record from the review path and reports it as conformance-failed", async () => {
    let observedKey: ReturnType<typeof buildExpectedEvidenceKey> | null = null;
    await registerProbe(async ({ subject }) => {
      observedKey = buildExpectedEvidenceKey({
        record: subject.record,
        structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
        runtime: RUNTIME_IDENTITY,
        credentialReferenceIdentity: subject.credentialReferenceIdentity,
        workspaceAccountReference: subject.workspaceAccountReference,
      });
      return { status: "skipped", reason: "capture the admitted tuple only" };
    });
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);
    succeed(await store.runConfigurationAction({ action: "test", configurationId }));
    if (!observedKey) throw new Error("probe did not observe the admitted tuple");

    // The review path is the only writer of failed evidence: the store must
    // accept it and readiness must report the cached fast-fail.
    const recorded = succeed(
      await store.recordConfigurationEvidence(
        configurationId,
        createAdmissionEvidence({
          evidenceKey: observedKey,
          checkedAt: new Date().toISOString(),
          status: "failed",
          expiresAt: null,
        }),
      ),
    );

    expect(recorded).toBe(true);
    expect(await readEvidence(store, configurationId)).toMatchObject({
      status: "failed",
      expiresAt: null,
    });
    expect(await readSetupVerdict()).toMatchObject({
      ok: true,
      value: { status: "conformance-failed", ready: false },
    });
  });

  it("reports an observation the probe declined to make as failed with the intentional-skip readiness", async () => {
    await registerProbe(async () => ({ status: "skipped", reason: "No exact model is selected" }));
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);

    const tested = succeed(await store.runConfigurationAction({ action: "test", configurationId }));

    // A skipped observation records no evidence, so the test did not succeed;
    // the readiness still tells skipped apart from failed for messaging.
    expect(tested).toMatchObject({ action: "test", status: "failed" });
    expect(tested.readiness).toMatchObject({
      status: "skipped",
      ready: false,
      evidenceStatus: "skipped",
    });
    expect(existsSync(evidencePathFor(configurationId))).toBe(false);
  });

  it("rejects an observation whose evidence does not match the configuration tuple", async () => {
    await registerProbe(async ({ subject }: { subject: ConfigurationConformanceSubject }) => ({
      status: "passed",
      evidence: createAdmissionEvidence({
        evidenceKey: {
          ...buildExpectedEvidenceKey({
            record: subject.record,
            structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
            runtime: RUNTIME_IDENTITY,
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

    expect(tested).toMatchObject({ action: "test", status: "failed" });
    expect(tested.readiness).toMatchObject({ status: "conformance-failed", ready: false });
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
    expect(await readEvidence(store, configurationId)).toBeNull();
  });

  it("keeps prior admission evidence when a select persistence failure is safely rolled back", async () => {
    await registerProbe(passingProbe);
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);
    succeed(await store.runConfigurationAction({ action: "test", configurationId }));
    const evidencePath = evidencePathFor(configurationId);
    const priorEvidence = readFileSync(evidencePath, "utf8");

    const recoveryPath = `${secretsPath()}.recovery`;
    let unlinkFailed = false;
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath && !unlinkFailed) {
        unlinkFailed = true;
        fsHooks.removeFileSyncDurableHook = null;
        throw new Error("Injected one-shot recovery unlink failure");
      }
      return false;
    };

    const failed = await store.runConfigurationAction({
      action: "select",
      configurationId,
      modelId: "gemini-2.5-pro",
    });

    expect(failed).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(readFileSync(evidencePath, "utf8")).toBe(priorEvidence);
    expect(existsSync(recoveryPath)).toBe(false);
    expect(
      readJson<{ configurations: Array<{ selectedModelId: string }> }>(configPath())
        .configurations[0]?.selectedModelId,
    ).toBe("gemini-2.5-flash");
  });

  it("retains prior admission evidence when a select commit cannot be rolled back", async () => {
    await registerProbe(passingProbe);
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);
    succeed(await store.runConfigurationAction({ action: "test", configurationId }));
    const evidencePath = evidencePathFor(configurationId);
    const priorEvidence = readFileSync(evidencePath, "utf8");

    const recoveryPath = `${secretsPath()}.recovery`;
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath) throw new Error("Injected persistent recovery unlink failure");
      return false;
    };

    const failed = await store.runConfigurationAction({
      action: "select",
      configurationId,
      modelId: "gemini-2.5-pro",
    });

    expect(failed).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(readFileSync(evidencePath, "utf8")).toBe(priorEvidence);
    expect(existsSync(recoveryPath)).toBe(true);
  });

  it("records no new verdict when its document commit cannot be rolled back", async () => {
    let observation = 0;
    await registerProbe(async ({ subject }) => ({
      status: "passed",
      evidence: createAdmissionEvidence({
        evidenceKey: buildExpectedEvidenceKey({
          record: subject.record,
          structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
          runtime: RUNTIME_IDENTITY,
          credentialReferenceIdentity: subject.credentialReferenceIdentity,
          workspaceAccountReference: subject.workspaceAccountReference,
        }),
        checkedAt: `2026-01-01T00:00:0${observation++}.000Z`,
        status: "passed",
      }),
    }));
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);

    succeed(await store.runConfigurationAction({ action: "test", configurationId }));
    const evidencePath = evidencePathFor(configurationId);
    const priorEvidence = readFileSync(evidencePath, "utf8");

    const recoveryPath = `${secretsPath()}.recovery`;
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath) throw new Error("Injected persistent recovery unlink failure");
      return false;
    };

    const failed = await store.runConfigurationAction({ action: "test", configurationId });

    expect(failed).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(readFileSync(evidencePath, "utf8")).toBe(priorEvidence);
  });

  it("leaves no verdict behind when a first test result cannot be persisted", async () => {
    await registerProbe(passingProbe);
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);
    const evidencePath = evidencePathFor(configurationId);
    expect(existsSync(evidencePath)).toBe(false);

    const recoveryPath = `${secretsPath()}.recovery`;
    let unlinkFailed = false;
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath && !unlinkFailed) {
        unlinkFailed = true;
        fsHooks.removeFileSyncDurableHook = null;
        throw new Error("Injected one-shot recovery unlink failure");
      }
      return false;
    };

    const tested = await store.runConfigurationAction({ action: "test", configurationId });

    expect(tested).toMatchObject({
      ok: true,
      value: { action: "test", status: "failed" },
    });
    expect(existsSync(evidencePath)).toBe(false);
    expect(
      readJson<{ configurations: Array<{ evidenceReference: string | null }> }>(configPath())
        .configurations[0]?.evidenceReference,
    ).toBeNull();

    vi.resetModules();
    const restarted = await loadStore();
    await expect(restarted.ready()).resolves.toMatchObject({ ok: true });
    expect(await readEvidence(restarted, configurationId)).toBeNull();
    expect(existsSync(evidencePath)).toBe(false);
  });

  it("keeps the prior verdict byte-identical when new evidence cannot be persisted", async () => {
    let observation = 0;
    await registerProbe(async ({ subject }) => ({
      status: "passed",
      evidence: createAdmissionEvidence({
        evidenceKey: buildExpectedEvidenceKey({
          record: subject.record,
          structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
          runtime: RUNTIME_IDENTITY,
          credentialReferenceIdentity: subject.credentialReferenceIdentity,
          workspaceAccountReference: subject.workspaceAccountReference,
        }),
        checkedAt: `2026-01-01T00:00:0${observation++}.000Z`,
        status: "passed",
      }),
    }));
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);
    succeed(await store.runConfigurationAction({ action: "test", configurationId }));
    const previousEvidence = await readEvidence(store, configurationId);
    if (!previousEvidence) throw new Error("expected prior admission evidence");
    const evidencePath = evidencePathFor(configurationId);
    const priorEvidenceValue = JSON.parse(readFileSync(evidencePath, "utf8")) as Record<
      string,
      unknown
    >;
    const priorEvidence = `  ${JSON.stringify(priorEvidenceValue, null, 4)}\n`;
    writeFileSync(evidencePath, priorEvidence);

    const recoveryPath = `${secretsPath()}.recovery`;
    let unlinkFailed = false;
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath && !unlinkFailed) {
        unlinkFailed = true;
        fsHooks.removeFileSyncDurableHook = null;
        throw new Error("Injected one-shot recovery unlink failure");
      }
      return false;
    };

    const tested = await store.recordConfigurationEvidence(
      configurationId,
      createAdmissionEvidence({
        evidenceKey: previousEvidence.evidenceKey,
        checkedAt: "2026-01-01T00:00:01.000Z",
        status: "passed",
      }),
    );

    expect(tested).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(readFileSync(evidencePath, "utf8")).toBe(priorEvidence);
    expect(existsSync(recoveryPath)).toBe(false);
    vi.resetModules();
    const restarted = await loadStore();
    await expect(restarted.ready()).resolves.toMatchObject({ ok: true });
    expect(readFileSync(evidencePath, "utf8")).toBe(priorEvidence);
    expect(await readEvidence(restarted, configurationId)).toMatchObject({
      checkedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("reports a failed test and admits nothing when the verdict cannot be written", async () => {
    await registerProbe(passingProbe);
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);
    const evidencePath = evidencePathFor(configurationId);
    fsHooks.writeJsonFileHook = async (filePath, data, mode) => {
      if (filePath === evidencePath) throw new Error("Injected evidence write failure");
      return writeJsonFile(filePath, data, mode);
    };

    const tested = await store.runConfigurationAction({ action: "test", configurationId });

    expect(tested).toMatchObject({ ok: true, value: { action: "test", status: "failed" } });
    expect(existsSync(evidencePath)).toBe(false);
    expect(await readEvidence(store, configurationId)).toBeNull();

    fsHooks.writeJsonFileHook = null;
    vi.resetModules();
    const restarted = await loadStore();
    await expect(restarted.ready()).resolves.toMatchObject({ ok: true });
    expect(await readEvidence(restarted, configurationId)).toBeNull();
  });
});

describe("configuration credential lifecycle", () => {
  it("discards a newly created credential when its document commit cannot be rolled back", async () => {
    writeJson(configPath(), {
      schemaVersion: 2,
      settings: {},
      selectedConfigurationId: null,
      configurations: [],
    });
    writeJson(secretsPath(), { schemaVersion: 2, bindings: [] });
    const store = await loadStore();
    const recoveryPath = `${secretsPath()}.recovery`;
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath) throw new Error("Injected persistent recovery unlink failure");
      return false;
    };

    const failed = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-indeterminate-create" }),
    );

    expect(failed).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    // config.json never recorded the configuration, so no binding can ever reach
    // this credential again and nothing else would sweep it.
    expect(readdirSync(join(diffgazerHome, "credentials"))).toEqual([]);
    expect(readJson<{ configurations: unknown[] }>(configPath()).configurations).toEqual([]);
  });

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

  it("keeps the old credential and discards the new one when an update commit cannot be rolled back", async () => {
    await registerProbe(passingProbe);
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);
    succeed(await store.runConfigurationAction({ action: "test", configurationId }));
    const evidencePath = evidencePathFor(configurationId);
    const priorEvidence = readFileSync(evidencePath, "utf8");

    const recoveryPath = `${secretsPath()}.recovery`;
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath) throw new Error("Injected persistent recovery unlink failure");
      return false;
    };

    const failed = await store.runConfigurationAction(
      updateGeminiAction(configurationId, 2, {
        kind: "literal",
        value: "sk-proj-indeterminate-update",
      }),
    );

    expect(failed).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(readFileSync(literalSecretPathFor(configurationId, 1), "utf8")).toBe(
      "sk-proj-conformance-secret",
    );
    expect(existsSync(literalSecretPathFor(configurationId, 3))).toBe(false);
    expect(readFileSync(evidencePath, "utf8")).toBe(priorEvidence);
  });

  it("keeps the retired credential and discards the new one when restoring the old document also fails", async () => {
    await registerProbe(passingProbe);
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);
    succeed(await store.runConfigurationAction({ action: "test", configurationId }));
    const evidencePath = evidencePathFor(configurationId);
    const priorEvidence = readFileSync(evidencePath, "utf8");
    const recoveryPath = `${secretsPath()}.recovery`;
    let journalWrites = 0;
    let configWrites = 0;
    let secretsWrites = 0;
    fsHooks.atomicWriteFileHook = async (filePath, content, mode) => {
      if (filePath === recoveryPath) {
        journalWrites += 1;
        return atomicWriteFile(filePath, content, mode);
      }
      if (filePath === configPath()) {
        configWrites += 1;
        if (configWrites === 2) throw new Error("Injected configuration restore failure");
      }
      if (filePath === secretsPath()) {
        secretsWrites += 1;
        if (secretsWrites === 1) throw new Error("Injected secrets persist failure");
      }
      return atomicWriteFile(filePath, content, mode);
    };
    keyring.deleteKeyringSecret.mockClear();

    const failed = await store.runConfigurationAction(
      updateGeminiAction(configurationId, 2, {
        kind: "literal",
        value: "sk-proj-restore-failure",
      }),
    );

    expect(failed).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(journalWrites).toBe(1);
    expect(configWrites).toBe(2);
    expect(secretsWrites).toBe(1);
    expect(existsSync(recoveryPath)).toBe(true);
    expect(readFileSync(literalSecretPathFor(configurationId, 1), "utf8")).toBe(
      "sk-proj-conformance-secret",
    );
    expect(existsSync(literalSecretPathFor(configurationId, 3))).toBe(false);
    expect(readFileSync(evidencePath, "utf8")).toBe(priorEvidence);
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
  });

  it("discards only the new credential after a one-shot persistence rollback", async () => {
    await registerProbe(passingProbe);
    const store = await loadStore();
    const configurationId = await createAdmittedConfiguration(store);
    succeed(await store.runConfigurationAction({ action: "test", configurationId }));
    const evidencePath = evidencePathFor(configurationId);
    const priorEvidence = readFileSync(evidencePath, "utf8");

    const recoveryPath = `${secretsPath()}.recovery`;
    let unlinkFailed = false;
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath && !unlinkFailed) {
        unlinkFailed = true;
        fsHooks.removeFileSyncDurableHook = null;
        throw new Error("Injected one-shot recovery unlink failure");
      }
      return false;
    };

    const failed = await store.runConfigurationAction(
      updateGeminiAction(configurationId, 2, {
        kind: "literal",
        value: "sk-proj-one-shot-update",
      }),
    );

    expect(failed).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(readFileSync(literalSecretPathFor(configurationId, 1), "utf8")).toBe(
      "sk-proj-conformance-secret",
    );
    expect(existsSync(literalSecretPathFor(configurationId, 3))).toBe(false);
    expect(readFileSync(evidencePath, "utf8")).toBe(priorEvidence);
    expect(existsSync(recoveryPath)).toBe(false);
    expect(
      readJson<{ configurations: Array<{ revision: number }> }>(configPath()).configurations[0]
        ?.revision,
    ).toBe(2);

    vi.resetModules();
    const restarted = await loadStore();
    await expect(restarted.ready()).resolves.toMatchObject({ ok: true });
    expect(readFileSync(evidencePath, "utf8")).toBe(priorEvidence);
    expect(await readEvidence(restarted, configurationId)).not.toBeNull();
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
          acknowledgement: { noticeId: "gemini-hosted-api", noticeVersion: 1, acceptedAt: null },
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

    const deleted = await store.runConfigurationAction({
      action: "delete",
      configurationId: "cfg-keyring",
      expectedRevision: 1,
    });

    expect(deleted.ok).toBe(false);
    if (!deleted.ok) {
      expect(deleted.error.code).toBe("SECRET_BINDING_FAILED");
    }
    expect(readJson(configPath())).toMatchObject({
      configurations: [expect.objectContaining({ configurationId: "cfg-keyring" })],
    });
    expect(readJson(secretsPath())).toMatchObject({
      bindings: [expect.objectContaining({ configurationId: "cfg-keyring" })],
    });

    keyring.deleteKeyringSecret.mockReturnValue({ ok: true, value: true });
    const retried = await store.runConfigurationAction({
      action: "delete",
      configurationId: "cfg-keyring",
      expectedRevision: 1,
    });
    expect(retried).toMatchObject({ ok: true, value: { action: "delete", status: "succeeded" } });
  });

  it("records a removed tombstone and keeps credential material when keyring cleanup fails after a rotation", async () => {
    const oldKeyId = "diffgazer/cfg-keyring/1";
    const keyringValues = new Map<string, string>([[oldKeyId, "sk-proj-rotation-original"]]);
    const cleanupEvents: string[] = [];
    let secretsDocumentAtCleanup: unknown;
    keyring.readKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.get(key) ?? null,
    }));
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      keyringValues.set(key, value);
      return { ok: true, value: undefined };
    });
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
          acknowledgement: { noticeId: "gemini-hosted-api", noticeVersion: 1, acceptedAt: null },
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
          keyId: oldKeyId,
          status: "active",
        },
      ],
    });
    keyring.deleteKeyringSecret.mockImplementation((key: string) => {
      cleanupEvents.push(`keyring-delete:${key}`);
      secretsDocumentAtCleanup = readJson(secretsPath());
      if (key === oldKeyId) {
        return {
          ok: false,
          error: { code: "KEYRING_UNAVAILABLE", message: "keyring is locked" },
        };
      }
      return { ok: true, value: true };
    });
    const store = await loadStore();

    const updated = await store.runConfigurationAction(
      updateGeminiAction("cfg-keyring", 1, {
        kind: "literal",
        value: "sk-proj-rotation-replacement",
      }),
    );

    expect(updated).toMatchObject({
      ok: true,
      value: { action: "update", status: "succeeded" },
    });
    expect(cleanupEvents).toEqual([`keyring-delete:${oldKeyId}`]);
    expect(secretsDocumentAtCleanup).toMatchObject({
      bindings: expect.arrayContaining([
        expect.objectContaining({
          configurationId: "cfg-keyring",
          revision: 1,
          status: "removed",
          keyId: oldKeyId,
        }),
      ]),
    });
    expect(readJson(configPath())).toMatchObject({
      configurations: [expect.objectContaining({ configurationId: "cfg-keyring", revision: 2 })],
    });
    expect(readJson(secretsPath())).toMatchObject({
      bindings: expect.arrayContaining([
        expect.objectContaining({
          configurationId: "cfg-keyring",
          revision: 2,
          status: "active",
          kind: "keyring-reference",
        }),
        expect.objectContaining({
          configurationId: "cfg-keyring",
          revision: 1,
          status: "removed",
          keyId: oldKeyId,
        }),
      ]),
    });
    expect(keyringValues.get(oldKeyId)).toBe("sk-proj-rotation-original");
  });

  it("retains active credential material when tombstone cleanup fails during delete after rotation", async () => {
    const oldKeyId = "diffgazer/cfg-keyring/1";
    const newKeyId = getConfigurationSecretName("cfg-keyring", 2);
    const keyringValues = new Map<string, string>([[oldKeyId, "sk-proj-rotation-original"]]);
    keyring.readKeyringSecret.mockImplementation((key: string) => ({
      ok: true,
      value: keyringValues.get(key) ?? null,
    }));
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      keyringValues.set(key, value);
      return { ok: true, value: undefined };
    });
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
          acknowledgement: { noticeId: "gemini-hosted-api", noticeVersion: 1, acceptedAt: null },
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
          keyId: oldKeyId,
          status: "active",
        },
      ],
    });
    keyring.deleteKeyringSecret.mockImplementation((key: string) => {
      if (key === oldKeyId) {
        return {
          ok: false,
          error: { code: "KEYRING_UNAVAILABLE", message: "keyring is locked" },
        };
      }
      return { ok: true, value: true };
    });
    const store = await loadStore();

    const updated = await store.runConfigurationAction(
      updateGeminiAction("cfg-keyring", 1, {
        kind: "literal",
        value: "sk-proj-rotation-replacement",
      }),
    );
    expect(updated).toMatchObject({
      ok: true,
      value: { action: "update", status: "succeeded" },
    });

    keyring.deleteKeyringSecret.mockImplementation((key: string) => {
      if (key === oldKeyId) {
        return {
          ok: false,
          error: { code: "KEYRING_UNAVAILABLE", message: "keyring is locked" },
        };
      }
      return { ok: true, value: true };
    });

    const deleted = await store.runConfigurationAction({
      action: "delete",
      configurationId: "cfg-keyring",
      expectedRevision: 2,
    });

    expect(deleted.ok).toBe(false);
    if (!deleted.ok) {
      expect(deleted.error.code).toBe("SECRET_BINDING_FAILED");
    }
    expect(readJson(configPath())).toMatchObject({
      configurations: [expect.objectContaining({ configurationId: "cfg-keyring", revision: 2 })],
    });
    expect(keyringValues.get(newKeyId)).toBe("sk-proj-rotation-replacement");
    expect(keyring.readKeyringSecret(newKeyId)).toMatchObject({
      ok: true,
      value: "sk-proj-rotation-replacement",
    });
  });
});
