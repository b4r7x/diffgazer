import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { atomicWriteFile } from "../fs.js";
import {
  configPath,
  diffgazerHome,
  fsHooks,
  loadStore,
  loadStoreFactory,
  readJson,
  secretsPath,
  writeJson,
} from "./store.test-support.js";

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

const supportedRecord = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 2,
  status: "supported",
  configurationId: "cfg-existing",
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

const literalSecretPathFor = (configurationId: string, revision: number): string =>
  join(diffgazerHome, "credentials", `${configurationId}-${revision}.key`);

describe("config store recovery", () => {
  it("sweeps the temp files an interrupted write stranded beside the store documents", async () => {
    writeJson(configPath(), v2Config([]));
    const strandedSecrets = `${secretsPath()}.${randomUUID()}.tmp`;
    const strandedJournal = `${secretsPath()}.recovery.${randomUUID()}.tmp`;
    const activeLockStaging = `${secretsPath()}.lock.${randomUUID()}.tmp`;
    writeFileSync(strandedSecrets, '{"providers":{"gemini":"sk-stranded-plaintext"}}', {
      mode: 0o600,
    });
    writeFileSync(strandedJournal, "stranded-journal", { mode: 0o600 });
    writeFileSync(activeLockStaging, "another process is staging this", { mode: 0o600 });

    const store = await loadStore();
    await expect(store.ready()).resolves.toEqual({ ok: true, value: undefined });

    expect(existsSync(strandedSecrets)).toBe(false);
    expect(existsSync(strandedJournal)).toBe(false);
    expect(existsSync(activeLockStaging)).toBe(true);
    unlinkSync(activeLockStaging);
  });

  it("waits for journal recovery before the first immediate mutation from a malformed current config", async () => {
    writeJson(configPath(), v2Config([]));
    const previousConfig = readFileSync(configPath());
    const recoveryPath = `${secretsPath()}.recovery`;
    writeFileSync(configPath(), "{ malformed current config\n");
    writeFileSync(
      recoveryPath,
      `${JSON.stringify({
        version: 2,
        previousConfig: {
          existed: true,
          base64: Buffer.from(previousConfig).toString("base64"),
        },
        previousSecrets: { existed: false, base64: null },
      })}\n`,
      { mode: 0o600 },
    );

    const createStore = await loadStoreFactory();
    const store = createStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "test-placeholder-startup-recovery-create" }),
    );

    expect(created).toMatchObject({ ok: true, value: { action: "create", status: "succeeded" } });
    expect(existsSync(recoveryPath)).toBe(false);
    const persisted = readJson<{ configurations: unknown[] }>(configPath());
    expect(persisted.configurations).toHaveLength(1);
    expect(readFileSync(configPath(), "utf8")).not.toContain("malformed current config");
  });

  it("restores exact prior bytes, revisions, and bindings when a delete fails during persistence and stays consistent on restart", async () => {
    const bindingPath = literalSecretPathFor("cfg-existing", 1);
    writeJson(configPath(), v2Config([supportedRecord()]));
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-existing",
          revision: 1,
          kind: "file-0600",
          filePath: bindingPath,
          status: "active",
        },
      ]),
    );
    mkdirSync(dirname(bindingPath), { recursive: true });
    writeFileSync(bindingPath, "sk-proj-recovery-delete-secret", { mode: 0o600 });
    const store = await loadStore();
    const configBefore = readFileSync(configPath(), "utf8");
    const secretsBefore = readFileSync(secretsPath(), "utf8");
    fsHooks.removeFileSyncHook = (filePath) => {
      if (filePath === secretsPath()) throw new Error("Injected secrets removal failure");
      return false;
    };

    const deleted = await store.runConfigurationAction({
      action: "delete",
      configurationId: "cfg-existing",
      expectedRevision: 1,
    });

    expect(deleted.ok).toBe(false);
    if (!deleted.ok) {
      expect(deleted.error.code).toBe("PERSIST_FAILED");
      expect(deleted.error.message).toBe("Failed to persist configuration");
      expect(deleted.error.message).not.toContain(diffgazerHome);
      expect(deleted.error.message).not.toContain("secrets.json");
      expect(deleted.error.message).not.toContain("sk-proj-recovery-delete-secret");
    }
    expect(readFileSync(configPath(), "utf8")).toBe(configBefore);
    expect(readFileSync(secretsPath(), "utf8")).toBe(secretsBefore);
    expect(readFileSync(bindingPath, "utf8")).toBe("sk-proj-recovery-delete-secret");
    const persisted = readJson<{ configurations: Array<{ revision: number }> }>(configPath());
    expect(persisted.configurations[0]?.revision).toBe(1);

    fsHooks.removeFileSyncHook = null;
    const restarted = (await loadStoreFactory())();
    const inspected = await restarted.runConfigurationAction({
      action: "inspect",
      configurationId: "cfg-existing",
    });
    expect(inspected).toMatchObject({
      ok: true,
      value: {
        status: "succeeded",
        configuration: { configurationId: "cfg-existing", revision: 1 },
      },
    });

    const retried = await restarted.runConfigurationAction({
      action: "delete",
      configurationId: "cfg-existing",
      expectedRevision: 1,
    });
    expect(retried).toMatchObject({ ok: true, value: { action: "delete", status: "succeeded" } });
    expect(existsSync(secretsPath())).toBe(false);
    expect(existsSync(bindingPath)).toBe(false);
  });

  it("fails a mutation queued behind fatal startup recovery before writing", async () => {
    const literalCredential = "test-placeholder-startup-race";
    const credentialsPath = join(diffgazerHome, "credentials");
    writeJson(configPath(), v2Config([]));
    const configBefore = readFileSync(configPath());
    writeFileSync(`${secretsPath()}.recovery`, '{"version":1}\n', { mode: 0o600 });

    const createStore = await loadStoreFactory();
    const store = createStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: literalCredential }),
    );

    expect(created).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    if (!created.ok) {
      expect(created.error.message).toBe(
        "Failed to restore secrets after a partial persistence failure",
      );
      expect(created.error.message).not.toContain(diffgazerHome);
      expect(created.error.message).not.toContain(process.cwd());
      if (process.env.HOME) expect(created.error.message).not.toContain(process.env.HOME);
      expect(created.error.message).not.toContain(credentialsPath);
      expect(created.error.message).not.toContain("credentials");
      expect(created.error.message).not.toContain(".backup");
    }
    expect(existsSync(`${secretsPath()}.recovery`)).toBe(false);
    expect(
      readdirSync(diffgazerHome).filter(
        (entry) => entry.startsWith("secrets.json.recovery.") && entry.endsWith(".backup"),
      ),
    ).toHaveLength(1);
    expect(readFileSync(configPath())).toEqual(configBefore);
    expect(readFileSync(configPath(), "utf8")).not.toContain(literalCredential);
    expect(existsSync(secretsPath())).toBe(false);
    expect(existsSync(credentialsPath)).toBe(false);
  });

  it("preserves the retired credential when an update rotation fails during persistence", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "test-placeholder-rotation-original" }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    const originalPath = literalSecretPathFor(configurationId, 1);
    expect(readFileSync(originalPath, "utf8")).toBe("test-placeholder-rotation-original");
    const configBefore = readFileSync(configPath(), "utf8");
    const secretsBefore = readFileSync(secretsPath(), "utf8");

    let secretsWriteAttempts = 0;
    fsHooks.atomicWriteFileHook = async (filePath, content, mode) => {
      if (filePath === secretsPath()) {
        secretsWriteAttempts += 1;
        if (secretsWriteAttempts === 1) {
          throw new Error("Injected secrets write failure");
        }
      }
      return atomicWriteFile(filePath, content, mode);
    };

    const update = await store.runConfigurationAction({
      action: "update",
      configurationId,
      expectedRevision: 1,
      input: {
        transportFamily: "hosted-api",
        productId: "gemini",
        endpoint: GEMINI_ENDPOINT,
        credential: { kind: "literal", value: "test-placeholder-rotation-replacement" },
      },
      acknowledgement: {
        status: "accepted",
        noticeId: "gemini-hosted-api",
        noticeVersion: 1,
        acceptedAt: "2026-01-02T00:00:00.000Z",
      },
    });

    expect(update).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(readFileSync(configPath(), "utf8")).toBe(configBefore);
    expect(readFileSync(secretsPath(), "utf8")).toBe(secretsBefore);
    expect(readFileSync(originalPath, "utf8")).toBe("test-placeholder-rotation-original");
    expect(existsSync(literalSecretPathFor(configurationId, 2))).toBe(false);

    fsHooks.atomicWriteFileHook = null;
  });

  it("reconciles a journal left behind by a failed journal write before returning PERSIST_FAILED", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "test-placeholder-journal-write-original" }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    const configBefore = readFileSync(configPath());
    const secretsBefore = readFileSync(secretsPath());
    const recoveryPath = `${secretsPath()}.recovery`;
    let journalWriteFailed = false;
    fsHooks.atomicWriteFileHook = async (filePath, content, mode) => {
      if (filePath === recoveryPath && !journalWriteFailed) {
        journalWriteFailed = true;
        await atomicWriteFile(filePath, content, mode);
        throw new Error("Injected journal write completion failure");
      }
      return atomicWriteFile(filePath, content, mode);
    };

    const updated = await store.runConfigurationAction({
      action: "update",
      configurationId,
      expectedRevision: 1,
      input: {
        transportFamily: "hosted-api",
        productId: "gemini",
        endpoint: GEMINI_ENDPOINT,
        credential: { kind: "literal", value: "test-placeholder-journal-write-replacement" },
      },
      acknowledgement: {
        status: "accepted",
        noticeId: "gemini-hosted-api",
        noticeVersion: 1,
        acceptedAt: "2026-01-02T00:00:00.000Z",
      },
    });

    expect(updated).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(journalWriteFailed).toBe(true);
    expect(readFileSync(configPath())).toEqual(configBefore);
    expect(readFileSync(secretsPath())).toEqual(secretsBefore);
    expect(existsSync(recoveryPath)).toBe(false);
  });

  it("returns PERSIST_FAILED after a one-shot final journal unlink failure restores O", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "test-placeholder-final-unlink-once-original" }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    const configBefore = readFileSync(configPath());
    const secretsBefore = readFileSync(secretsPath());
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

    const updated = await store.runConfigurationAction({
      action: "update",
      configurationId,
      expectedRevision: 1,
      input: {
        transportFamily: "hosted-api",
        productId: "gemini",
        endpoint: GEMINI_ENDPOINT,
        credential: {
          kind: "literal",
          value: "test-placeholder-final-unlink-once-replacement",
        },
      },
      acknowledgement: {
        status: "accepted",
        noticeId: "gemini-hosted-api",
        noticeVersion: 1,
        acceptedAt: "2026-01-02T00:00:00.000Z",
      },
    });

    expect(updated).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(unlinkFailed).toBe(true);
    expect(readFileSync(configPath())).toEqual(configBefore);
    expect(readFileSync(secretsPath())).toEqual(secretsBefore);
    expect(existsSync(recoveryPath)).toBe(false);
  });

  it("latches ROLLBACK_FAILED and refuses later writes when the final journal unlink stays failed", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({
        kind: "literal",
        value: "test-placeholder-final-unlink-persistent-original",
      }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    const configBefore = readFileSync(configPath());
    const secretsBefore = readFileSync(secretsPath());
    const recoveryPath = `${secretsPath()}.recovery`;
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath === recoveryPath) throw new Error("Injected persistent recovery unlink failure");
      return false;
    };

    const updated = await store.runConfigurationAction({
      action: "update",
      configurationId,
      expectedRevision: 1,
      input: {
        transportFamily: "hosted-api",
        productId: "gemini",
        endpoint: GEMINI_ENDPOINT,
        credential: {
          kind: "literal",
          value: "test-placeholder-final-unlink-persistent-replacement",
        },
      },
      acknowledgement: {
        status: "accepted",
        noticeId: "gemini-hosted-api",
        noticeVersion: 1,
        acceptedAt: "2026-01-02T00:00:00.000Z",
      },
    });

    expect(updated).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(readFileSync(configPath())).toEqual(configBefore);
    expect(readFileSync(secretsPath())).toEqual(secretsBefore);
    expect(existsSync(recoveryPath)).toBe(true);

    const later = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "test-placeholder-must-not-write" }),
    );
    expect(later).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(readFileSync(configPath())).toEqual(configBefore);
    expect(readFileSync(secretsPath())).toEqual(secretsBefore);
  });

  it("durably restores an absent first-create snapshot after an ambiguous journal unlink", async () => {
    const store = await loadStore();
    const recoveryPath = `${secretsPath()}.recovery`;
    let unlinkAttempted = false;
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath !== recoveryPath) return false;
      unlinkAttempted = true;
      unlinkSync(filePath);
      fsHooks.removeFileSyncDurableHook = null;
      throw new Error("Injected recovery directory fsync failure");
    };

    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "test-placeholder-first-create-fsync" }),
    );

    expect(created).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(unlinkAttempted).toBe(true);
    expect(existsSync(configPath())).toBe(false);
    expect(existsSync(secretsPath())).toBe(false);
    expect(existsSync(recoveryPath)).toBe(false);
  });

  it("re-establishes the WAL before a partial compensation so a second store finishes recovery", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "test-placeholder-double-fault-original" }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    const configBefore = readFileSync(configPath());
    const secretsBefore = readFileSync(secretsPath());
    const recoveryPath = `${secretsPath()}.recovery`;
    let clearBecameAmbiguous = false;
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath !== recoveryPath) return false;
      clearBecameAmbiguous = true;
      unlinkSync(filePath);
      fsHooks.removeFileSyncDurableHook = null;
      throw new Error("Injected recovery directory fsync failure");
    };
    fsHooks.atomicWriteFileHook = async (filePath, content, mode) => {
      if (clearBecameAmbiguous && filePath === secretsPath()) {
        throw new Error("Injected secrets rollback failure");
      }
      return atomicWriteFile(filePath, content, mode);
    };

    const updated = await store.runConfigurationAction({
      action: "update",
      configurationId,
      expectedRevision: 1,
      input: {
        transportFamily: "hosted-api",
        productId: "gemini",
        endpoint: GEMINI_ENDPOINT,
        credential: { kind: "literal", value: "test-placeholder-double-fault-replacement" },
      },
      acknowledgement: {
        status: "accepted",
        noticeId: "gemini-hosted-api",
        noticeVersion: 1,
        acceptedAt: "2026-01-02T00:00:00.000Z",
      },
    });

    expect(updated).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(existsSync(recoveryPath)).toBe(true);
    expect(readFileSync(configPath())).toEqual(configBefore);
    expect(readFileSync(secretsPath())).not.toEqual(secretsBefore);

    fsHooks.atomicWriteFileHook = null;
    const restarted = (await loadStoreFactory())();
    expect(await restarted.ready()).toEqual({ ok: true, value: undefined });
    expect(existsSync(recoveryPath)).toBe(false);
    expect(readFileSync(configPath())).toEqual(configBefore);
    expect(readFileSync(secretsPath())).toEqual(secretsBefore);
    expect(
      await restarted.runConfigurationAction({ action: "inspect", configurationId }),
    ).toMatchObject({ ok: true, value: { status: "succeeded" } });
  });

  it("latches when an ambiguous clear cannot re-establish its WAL", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({
        kind: "literal",
        value: "test-placeholder-reestablish-failure-original",
      }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    const recoveryPath = `${secretsPath()}.recovery`;
    let clearBecameAmbiguous = false;
    fsHooks.removeFileSyncDurableHook = (filePath) => {
      if (filePath !== recoveryPath) return false;
      clearBecameAmbiguous = true;
      unlinkSync(filePath);
      fsHooks.removeFileSyncDurableHook = null;
      throw new Error("Injected recovery directory fsync failure");
    };
    fsHooks.atomicWriteFileHook = async (filePath, content, mode) => {
      if (clearBecameAmbiguous && filePath === recoveryPath) {
        throw new Error("Injected WAL re-establish failure");
      }
      return atomicWriteFile(filePath, content, mode);
    };

    const updated = await store.runConfigurationAction({
      action: "select",
      configurationId,
      modelId: "gemini-2.5-flash",
    });

    expect(updated).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
    expect(existsSync(recoveryPath)).toBe(false);
    const later = await store.runConfigurationAction({
      action: "select",
      configurationId,
      modelId: "gemini-2.5-pro",
    });
    expect(later).toMatchObject({ ok: false, error: { code: "ROLLBACK_FAILED" } });
  });

  it("keeps an uninterpretable record's secret binding and key file across a neighboring create", async () => {
    const futureKeyPath = literalSecretPathFor("cfg-future", 1);
    const unknownRecord =
      '{"schemaVersion":99,"configurationId":"cfg-future","futureField":{"nested":true}}';
    mkdirSync(dirname(configPath()), { recursive: true });
    writeFileSync(
      configPath(),
      `{"schemaVersion":2,"settings":{},"selectedConfigurationId":null,"configurations":[${unknownRecord}]}\n`,
    );
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-future",
          revision: 1,
          kind: "file-0600",
          filePath: futureKeyPath,
          status: "active",
        },
      ]),
    );
    mkdirSync(dirname(futureKeyPath), { recursive: true });
    writeFileSync(futureKeyPath, "sk-future-secret", { mode: 0o600 });
    const store = await loadStore();

    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-active-secret" }),
    );
    expect(created.ok).toBe(true);

    expect(readFileSync(configPath(), "utf8")).toContain(unknownRecord);
    expect(existsSync(futureKeyPath)).toBe(true);
    expect(readFileSync(futureKeyPath, "utf8")).toBe("sk-future-secret");
    const bindings = readJson<{ bindings: Array<{ configurationId: string; filePath: string }> }>(
      secretsPath(),
    ).bindings;
    expect(bindings).toContainEqual(
      expect.objectContaining({ configurationId: "cfg-future", filePath: futureKeyPath }),
    );
  });

  it("deletes a configuration whose product this build no longer recognises", async () => {
    const retiredKeyPath = literalSecretPathFor("cfg-retired", 1);
    const retiredRecord = JSON.stringify(
      supportedRecord({ configurationId: "cfg-retired", productId: "retired-product" }),
    );
    writeFileSync(
      configPath(),
      `{"schemaVersion":2,"settings":{},"configurations":[${retiredRecord}]}\n`,
    );
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-retired",
          revision: 1,
          kind: "file-0600",
          filePath: retiredKeyPath,
          status: "active",
        },
      ]),
    );
    mkdirSync(dirname(retiredKeyPath), { recursive: true });
    writeFileSync(retiredKeyPath, "sk-retired-secret", { mode: 0o600 });
    const store = await loadStore();

    // The record has to be visible before it can be removed: it is listed as an
    // unrecognized id, described no further, and never as a configuration.
    const listed = await store.readConfigurationSnapshot();
    expect(listed).toMatchObject({
      ok: true,
      value: {
        configurations: [],
        unrecognizedConfigurations: [{ configurationId: "cfg-retired" }],
      },
    });

    // The list showed no revision, so the delete asserts none.
    const deleted = await store.runConfigurationAction({
      action: "delete",
      configurationId: "cfg-retired",
    });

    expect(deleted.ok).toBe(true);
    expect(readFileSync(configPath(), "utf8")).not.toContain("cfg-retired");
    expect(existsSync(retiredKeyPath)).toBe(false);
    await expect(store.readConfigurationSnapshot()).resolves.toMatchObject({
      ok: true,
      value: { unrecognizedConfigurations: [] },
    });
  });

  it("refuses to delete a described configuration when the client asserts no revision", async () => {
    writeJson(configPath(), v2Config([supportedRecord({ configurationId: "cfg-existing" })]));
    writeJson(secretsPath(), v2Secrets());
    const store = await loadStore();

    const deleted = await store.runConfigurationAction({
      action: "delete",
      configurationId: "cfg-existing",
    });

    expect(deleted).toMatchObject({ ok: false, error: { code: "CONFIGURATION_CONFLICT" } });
    expect(readFileSync(configPath(), "utf8")).toContain("cfg-existing");
  });

  it("recovered state exposes no secret values, environment names, or credential paths", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-recovery-secret" }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    fsHooks.removeFileSyncHook = (filePath) => {
      if (filePath === secretsPath()) throw new Error("Injected secrets removal failure");
      return false;
    };
    const failed = await store.runConfigurationAction({
      action: "delete",
      configurationId,
      expectedRevision: 1,
    });
    expect(failed).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    fsHooks.removeFileSyncHook = null;

    const restarted = (await loadStoreFactory())();
    const inspected = await restarted.runConfigurationAction({
      action: "inspect",
      configurationId,
    });
    expect(inspected).toMatchObject({ ok: true, value: { status: "succeeded" } });
    const selected = await restarted.runConfigurationAction({
      action: "select",
      configurationId,
      modelId: "gemini-2.5-flash",
    });
    expect(selected.ok).toBe(true);

    const serialized = JSON.stringify([failed, inspected, selected]);
    expect(serialized).not.toContain("sk-proj-recovery-secret");
    expect(serialized).not.toContain("GOOGLE_API_KEY");
    expect(serialized).not.toContain("credentials/");
    expect(serialized).not.toContain(diffgazerHome);
    expect(serialized).not.toContain("file-0600");
    expect(serialized).not.toContain("keyId");
    expect(serialized).not.toContain("evidenceReference");
    expect(serialized).not.toContain("credentialReferenceIdentity");

    const configText = readFileSync(configPath(), "utf8");
    expect(configText).not.toContain("sk-proj-recovery-secret");
    expect(readFileSync(secretsPath(), "utf8")).not.toContain("sk-proj-recovery-secret");
  });
});
