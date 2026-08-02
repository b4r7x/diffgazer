import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { REMOVED_PRODUCT_IDS } from "@diffgazer/core/schemas/config";

const REMOVED_PRODUCT_ID = REMOVED_PRODUCT_IDS[0];

import { dirname, join } from "node:path";
import type { Result } from "@diffgazer/core/result";
import type { ClientConfigurationAction } from "@diffgazer/core/schemas/config";
import { type EvidenceKey, sha256CanonicalJsonSync } from "@diffgazer/core/schemas/review";
import { describe, expect, it } from "vitest";
import { executionLimitsFromBudget } from "../ai/admission/service.js";
import { createAdmissionEvidence } from "./admission-evidence.js";
import { DEFAULT_CONFIGURATION_BUDGET } from "./store.js";
import {
  configPath,
  diffgazerHome,
  fsHooks,
  loadStore,
  secretsPath,
  writeJson,
} from "./store.test-support.js";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const QWEN_ENDPOINT = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
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
      acceptedAt: "2026-01-02T00:00:00.000Z",
    },
  }) as const;

const literalSecretPathFor = (configurationId: string, revision: number): string =>
  join(diffgazerHome, "credentials", `${configurationId}-${revision}.key`);

const fileBinding = (configurationId: string, revision: number) => ({
  configurationId,
  revision,
  kind: "file-0600",
  filePath: literalSecretPathFor(configurationId, revision),
  status: "active",
});

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

const recordFailure = <T, E>(target: unknown[], result: Result<T, E>): void => {
  if (!result.ok) target.push(result);
};

describe("config store errors", () => {
  it("fails stale revisions, removed records, and unknown records with exact error codes and byte-identical state", async () => {
    const unknownRecord =
      '{"schemaVersion":99,"configurationId":"cfg-future","future":{"nested":true}}';
    mkdirSync(dirname(configPath()), { recursive: true });
    writeFileSync(
      configPath(),
      `{"schemaVersion":2,"settings":{},"selectedConfigurationId":null,"configurations":[${JSON.stringify(supportedRecord())},${JSON.stringify(removedRecord())},${unknownRecord}]}\n`,
    );
    writeJson(secretsPath(), v2Secrets([fileBinding("cfg-existing", 1)]));
    const store = await loadStore();
    const configBefore = readFileSync(configPath(), "utf8");
    const secretsBefore = readFileSync(secretsPath(), "utf8");

    await expect(
      store.runConfigurationAction(updateGeminiAction("cfg-existing", 99)),
    ).resolves.toMatchObject({ ok: false, error: { code: "CONFIGURATION_CONFLICT" } });
    await expect(
      store.runConfigurationAction({
        action: "delete",
        configurationId: "cfg-existing",
        expectedRevision: 99,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "CONFIGURATION_CONFLICT" } });
    await expect(
      store.runConfigurationAction(updateGeminiAction("cfg-removed", 1)),
    ).resolves.toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });
    await expect(
      store.runConfigurationAction({
        action: "select",
        configurationId: "cfg-removed",
        modelId: "gemini-2.5-flash",
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });
    await expect(
      store.runConfigurationAction({ action: "test", configurationId: "cfg-removed" }),
    ).resolves.toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });
    await expect(
      store.runConfigurationAction({ action: "inspect", configurationId: "cfg-future" }),
    ).resolves.toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });
    await expect(
      store.runConfigurationAction(updateGeminiAction("cfg-future", 1)),
    ).resolves.toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });
    await expect(
      store.runConfigurationAction({
        action: "delete",
        configurationId: "cfg-future",
        expectedRevision: 1,
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });
    await expect(
      store.runConfigurationAction({ action: "inspect", configurationId: "cfg-never-created" }),
    ).resolves.toMatchObject({ ok: false, error: { code: "CONFIGURATION_NOT_FOUND" } });

    expect(readFileSync(configPath(), "utf8")).toBe(configBefore);
    expect(readFileSync(secretsPath(), "utf8")).toBe(secretsBefore);
  });

  it("rejects a secret-like workspace on update and preserves the prior record and binding exactly", async () => {
    writeJson(
      configPath(),
      v2Config([
        supportedRecord({
          configurationId: "cfg-qwen",
          productId: "qwen",
          input: {
            transportFamily: "hosted-api",
            productId: "qwen",
            endpoint: QWEN_ENDPOINT,
            region: "international",
            workspace: "workspace-alpha",
          },
        }),
      ]),
    );
    writeJson(secretsPath(), v2Secrets([fileBinding("cfg-qwen", 1)]));
    const store = await loadStore();
    const configBefore = readFileSync(configPath(), "utf8");
    const secretsBefore = readFileSync(secretsPath(), "utf8");

    const result = await store.runConfigurationAction({
      action: "update",
      configurationId: "cfg-qwen",
      expectedRevision: 1,
      input: {
        transportFamily: "hosted-api",
        productId: "qwen",
        endpoint: QWEN_ENDPOINT,
        region: "international",
        workspace: "sk-proj-workspace-secret",
      },
      acknowledgement: {
        status: "accepted",
        noticeId: "qwen-international-payg",
        noticeVersion: 1,
        acceptedAt: "2026-01-02T00:00:00.000Z",
      },
    });

    expect(result).toMatchObject({ ok: false, error: { code: "CONFIGURATION_UNSUPPORTED" } });
    expect(JSON.stringify(result)).not.toContain("sk-proj-workspace-secret");
    expect(readFileSync(configPath(), "utf8")).toBe(configBefore);
    expect(readFileSync(secretsPath(), "utf8")).toBe(secretsBefore);
  });

  it("rolls back a failed delete with a scrubbed persist error and byte-identical files", async () => {
    const store = await loadStore();
    const created = await store.runConfigurationAction(
      createGeminiAction({ kind: "literal", value: "sk-proj-delete-redaction" }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const configurationId = created.value.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");
    const configBefore = readFileSync(configPath(), "utf8");
    const secretsBefore = readFileSync(secretsPath(), "utf8");
    fsHooks.removeFileSyncHook = (filePath) => {
      if (filePath === secretsPath()) throw new Error(`Injected removal failure at ${filePath}`);
      return false;
    };

    const deleted = await store.runConfigurationAction({
      action: "delete",
      configurationId,
      expectedRevision: 1,
    });

    expect(deleted.ok).toBe(false);
    if (!deleted.ok) {
      expect(deleted.error.code).toBe("PERSIST_FAILED");
      expect(deleted.error.message).toBe("Failed to persist configuration");
      expect(deleted.error.message).not.toContain(diffgazerHome);
      expect(deleted.error.message).not.toContain("secrets.json");
      expect(deleted.error.message).not.toContain("sk-proj-delete-redaction");
      expect(JSON.stringify(deleted.error)).toBe(
        '{"code":"PERSIST_FAILED","message":"Failed to persist configuration"}',
      );
    }
    expect(readFileSync(configPath(), "utf8")).toBe(configBefore);
    expect(readFileSync(secretsPath(), "utf8")).toBe(secretsBefore);

    fsHooks.removeFileSyncHook = null;
    const retried = await store.runConfigurationAction({
      action: "delete",
      configurationId,
      expectedRevision: 1,
    });
    expect(retried).toMatchObject({ ok: true, value: { action: "delete", status: "succeeded" } });
  });

  it("redacts secret values, environment names, paths, and evidence details from every action error", async () => {
    const unknownRecord = '{"schemaVersion":99,"configurationId":"cfg-future"}';
    mkdirSync(dirname(configPath()), { recursive: true });
    writeFileSync(
      configPath(),
      `{"schemaVersion":2,"settings":{},"selectedConfigurationId":null,"configurations":[${JSON.stringify(supportedRecord())},${JSON.stringify(removedRecord())},${unknownRecord}]}\n`,
    );
    writeJson(secretsPath(), v2Secrets([fileBinding("cfg-existing", 1)]));
    const store = await loadStore();
    const failures: unknown[] = [];

    recordFailure(
      failures,
      await store.runConfigurationAction({
        action: "create",
        input: {
          transportFamily: "hosted-api",
          productId: REMOVED_PRODUCT_ID,
          endpoint: "https://api.example.invalid/v1",
          credential: { kind: "literal", value: "sk-zai-coding-never-created" },
        },
      } as unknown as ClientConfigurationAction),
    );
    recordFailure(
      failures,
      await store.runConfigurationAction(updateGeminiAction("cfg-existing", 99)),
    );
    recordFailure(
      failures,
      await store.runConfigurationAction({
        action: "delete",
        configurationId: "cfg-existing",
        expectedRevision: 99,
      }),
    );
    recordFailure(
      failures,
      await store.runConfigurationAction({
        action: "select",
        configurationId: "cfg-removed",
        modelId: "gemini-2.5-flash",
      }),
    );
    recordFailure(
      failures,
      await store.runConfigurationAction({ action: "test", configurationId: "cfg-removed" }),
    );
    recordFailure(
      failures,
      await store.runConfigurationAction({ action: "inspect", configurationId: "cfg-future" }),
    );
    recordFailure(
      failures,
      await store.runConfigurationAction({
        action: "delete",
        configurationId: "cfg-future",
        expectedRevision: 1,
      }),
    );
    recordFailure(
      failures,
      await store.runConfigurationAction({
        action: "create",
        input: {
          transportFamily: "hosted-api",
          productId: "qwen",
          endpoint: QWEN_ENDPOINT,
          region: "international",
          workspace: "sk-proj-workspace-secret",
          credential: { kind: "literal", value: "sk-proj-workspace-test" },
        },
      }),
    );
    fsHooks.removeFileSyncHook = (filePath) => {
      if (filePath === secretsPath()) throw new Error(`Injected removal failure at ${filePath}`);
      return false;
    };
    recordFailure(
      failures,
      await store.runConfigurationAction({
        action: "delete",
        configurationId: "cfg-existing",
        expectedRevision: 1,
      }),
    );
    fsHooks.removeFileSyncHook = null;
    writeFileSync(join(diffgazerHome, "credentials"), "not a directory");
    recordFailure(
      failures,
      await store.runConfigurationAction(
        createGeminiAction({ kind: "literal", value: "sk-proj-binding-failed" }),
      ),
    );
    recordFailure(
      failures,
      await store.recordConfigurationEvidence(
        "cfg-existing",
        createAdmissionEvidence({
          evidenceKey: { ...evidenceKeyFor("cfg-existing"), modelId: "gemini-2.5-pro" },
          checkedAt: "2026-01-02T00:00:00.000Z",
          status: "passed",
        }),
      ),
    );

    expect(failures.length).toBe(11);
    const serialized = JSON.stringify(failures);
    expect(serialized).not.toContain("sk-proj-");
    expect(serialized).not.toContain("GOOGLE_API_KEY");
    expect(serialized).not.toContain(diffgazerHome);
    expect(serialized).not.toContain("credentials/");
    expect(serialized).not.toContain(".key");
    expect(serialized).not.toContain("evidenceKey");
    expect(serialized).not.toContain("credentialReferenceIdentity");
    expect(serialized).not.toContain("structuredOutputSchemaSha256");
    expect(serialized).not.toContain("evidenceReference");
  });
});
