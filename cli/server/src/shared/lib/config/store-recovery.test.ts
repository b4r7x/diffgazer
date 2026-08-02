import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { REMOVED_PRODUCT_IDS } from "@diffgazer/core/schemas/config";

const REMOVED_PRODUCT_ID = REMOVED_PRODUCT_IDS[0];

import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
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
  acknowledgement: { noticeVersion: 1, acceptedAt: null },
  evidenceReference: null,
  budget: DEFAULT_BUDGET,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  ...overrides,
});

const removedRecord = () => ({
  schemaVersion: 2,
  status: "removed",
  configurationId: "cfg-removed",
  revision: 1,
  productId: REMOVED_PRODUCT_ID,
  transportFamily: "hosted-api",
  selectedModelId: null,
  acknowledgement: null,
  evidenceReference: null,
  budget: null,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
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

  it("keeps a removed record's secret binding until the explicit delete action", async () => {
    const removedKeyPath = literalSecretPathFor("cfg-removed", 1);
    writeJson(configPath(), v2Config([removedRecord()]));
    writeJson(
      secretsPath(),
      v2Secrets([
        {
          configurationId: "cfg-removed",
          revision: 1,
          kind: "file-0600",
          filePath: removedKeyPath,
          status: "removed",
        },
      ]),
    );
    mkdirSync(dirname(removedKeyPath), { recursive: true });
    writeFileSync(removedKeyPath, "sk-zai-coding-secret", { mode: 0o600 });
    const store = await loadStore();

    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-active-secret" }),
    );
    expect(created.ok).toBe(true);

    expect(existsSync(removedKeyPath)).toBe(true);
    expect(readFileSync(removedKeyPath, "utf8")).toBe("sk-zai-coding-secret");
    const secretsAfterCreate = readJson<{
      bindings: Array<{ configurationId: string; status: string }>;
    }>(secretsPath());
    expect(
      secretsAfterCreate.bindings.some(
        (binding) => binding.configurationId === "cfg-removed" && binding.status === "removed",
      ),
    ).toBe(true);

    const inspected = await store.runConfigurationAction({
      action: "inspect",
      configurationId: "cfg-removed",
    });
    expect(inspected).toMatchObject({
      ok: true,
      value: {
        status: "succeeded",
        configuration: { status: "removed", productId: REMOVED_PRODUCT_ID },
      },
    });
    expect(JSON.stringify(inspected)).not.toContain("sk-zai-coding-secret");
    expect(JSON.stringify(inspected)).not.toContain("credentials/");

    const deleted = await store.runConfigurationAction({
      action: "delete",
      configurationId: "cfg-removed",
      expectedRevision: 1,
    });
    expect(deleted).toMatchObject({ ok: true, value: { action: "delete", status: "succeeded" } });
    expect(existsSync(removedKeyPath)).toBe(false);
    const secretsAfterDelete = readJson<{ bindings: Array<{ configurationId: string }> }>(
      secretsPath(),
    );
    expect(
      secretsAfterDelete.bindings.some((binding) => binding.configurationId === "cfg-removed"),
    ).toBe(false);
    const persisted = readJson<{ configurations: Array<{ configurationId: string }> }>(
      configPath(),
    );
    expect(
      persisted.configurations.some((record) => record.configurationId === "cfg-removed"),
    ).toBe(false);
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
