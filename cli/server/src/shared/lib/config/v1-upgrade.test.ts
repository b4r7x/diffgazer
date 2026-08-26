import { lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "@diffgazer/core/schemas/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertTempHome } from "../testing/temp-home.js";
import type { SecretEntry, SecretsState } from "./types.js";

const keyring = vi.hoisted(() => ({
  deleteKeyringSecret: vi.fn(),
  isKeyringAvailable: vi.fn(),
  readKeyringSecret: vi.fn(),
  writeKeyringSecret: vi.fn(),
}));

vi.mock("./keyring.js", () => keyring);

const { decodeConfigV1 } = await import("./persistence/config.js");
const { literalCredentialFilePath } = await import("./persistence/credential-file-path.js");
const { getConfigurationSecretName } = await import("./secrets-store.js");
const { upgradeV1Documents } = await import("./v1-upgrade.js");

const encoder = new TextEncoder();

const budget = {
  inputTokens: 32_000,
  outputTokens: 8_000,
  responseBytes: 65_536,
  wallTimeMs: 60_000,
  retries: 2,
  concurrency: 1,
  perReview: 40_000,
};

const v1Config = (
  providers: readonly Record<string, unknown>[],
  settings: Record<string, unknown> = { secretsStorage: "file" },
) => decodeConfigV1(encoder.encode(JSON.stringify({ settings, providers })));

const v1Gemini = (overrides: Record<string, unknown> = {}) => ({
  provider: "gemini",
  [LEGACY_V1_HAS_API_KEY_PROPERTY]: true,
  isActive: true,
  model: "gemini-2.5-flash",
  ...overrides,
});

const fixedFailure = {
  ok: false,
  error: {
    code: "SECRETS_MIGRATION_FAILED",
    message: "Legacy configuration requires manual migration",
  },
} as const;

const secretsState = (providers: SecretsState["providers"]): SecretsState => ({ providers });

let home: string;
let keyringValues: Map<string, string>;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "diffgazer-v1-upgrade-"));
  assertTempHome(home);
  process.env.DIFFGAZER_HOME = home;
  vi.clearAllMocks();
  keyringValues = new Map<string, string>();
  keyring.readKeyringSecret.mockImplementation((key: string) => ({
    ok: true,
    value: keyringValues.get(key) ?? null,
  }));
  keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
    keyringValues.set(key, value);
    return { ok: true, value: undefined };
  });
});

// `upgradeV1Documents` is awaited by every test and starts no background writer, so the
// temp home only has to fall before DIFFGAZER_HOME is dropped.
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
  delete process.env.DIFFGAZER_HOME;
});

const bindingsOf = (result: Awaited<ReturnType<typeof upgradeV1Documents>>) => {
  if (!result.ok) throw new Error("upgrade must succeed");
  return result.value.secretsDocument.bindings.map((entry) => entry.binding);
};

describe("upgradeV1Documents", () => {
  it("uses the validated environment binding without reading the legacy entry again", async () => {
    let reads = 0;
    const providers = {
      get gemini(): SecretEntry {
        reads += 1;
        return reads === 1
          ? { kind: "env", varName: "GOOGLE_API_KEY" }
          : "literal-secret-must-not-leak";
      },
    } satisfies Record<string, SecretEntry>;

    const result = await upgradeV1Documents(v1Config([v1Gemini()]), { providers }, { budget });

    expect(result).toMatchObject({
      ok: true,
      value: {
        configDocument: { schemaVersion: 2, selectedConfigurationId: "cfg-v1-gemini" },
        secretsDocument: {
          schemaVersion: 2,
          bindings: [
            {
              status: "supported",
              binding: {
                configurationId: "cfg-v1-gemini",
                revision: 1,
                status: "active",
                kind: "environment-reference",
                varName: "GOOGLE_API_KEY",
              },
            },
          ],
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain("literal-secret-must-not-leak");
  });

  it("upgrades an explicit no-secret record without credential I/O", async () => {
    const result = await upgradeV1Documents(
      v1Config([v1Gemini({ [LEGACY_V1_HAS_API_KEY_PROPERTY]: false })]),
      secretsState({}),
      { budget },
    );

    expect(bindingsOf(result)).toEqual([
      { configurationId: "cfg-v1-gemini", revision: 1, status: "active", kind: "none" },
    ]);
    expect(keyring.readKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
  });

  it("moves a file-install literal into a contained 0600 credential file", async () => {
    const result = await upgradeV1Documents(
      v1Config([v1Gemini()]),
      secretsState({ gemini: "sk-v1-file-literal" }),
      { budget },
    );

    const credentialPath = literalCredentialFilePath("cfg-v1-gemini", 1);
    expect(bindingsOf(result)).toEqual([
      {
        configurationId: "cfg-v1-gemini",
        revision: 1,
        status: "active",
        kind: "file-0600",
        filePath: credentialPath,
      },
    ]);
    await expect(readFile(credentialPath, "utf8")).resolves.toBe("sk-v1-file-literal");
    expect((await lstat(credentialPath)).mode & 0o777).toBe(0o600);
    expect(JSON.stringify(result)).not.toContain("sk-v1-file-literal");
  });

  it("copies a keyring-install secret to its canonical key and keeps the legacy source", async () => {
    keyringValues.set("api_key_gemini", "sk-v1-keyring-literal");

    const result = await upgradeV1Documents(
      v1Config([v1Gemini()], { secretsStorage: "keyring" }),
      secretsState({}),
      { budget },
    );

    const destinationKey = getConfigurationSecretName("cfg-v1-gemini", 1);
    expect(bindingsOf(result)).toEqual([
      {
        configurationId: "cfg-v1-gemini",
        revision: 1,
        status: "active",
        kind: "keyring-reference",
        keyId: destinationKey,
      },
    ]);
    expect(keyringValues.get(destinationKey)).toBe("sk-v1-keyring-literal");
    expect(keyringValues.get("api_key_gemini")).toBe("sk-v1-keyring-literal");
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("sk-v1-keyring-literal");
  });

  it.each([
    { storage: "file", secrets: () => secretsState({ gemini: "sk-v1-file-literal" }) },
    { storage: "keyring", secrets: () => secretsState({}) },
  ] as const)("repeats a $storage upgrade identically when the first attempt never committed", async ({
    storage,
    secrets,
  }) => {
    keyringValues.set("api_key_gemini", "sk-v1-keyring-literal");
    const config = () => v1Config([v1Gemini()], { secretsStorage: storage });

    const first = await upgradeV1Documents(config(), secrets(), { budget });
    keyring.writeKeyringSecret.mockClear();
    const second = await upgradeV1Documents(config(), secrets(), { budget });

    expect(bindingsOf(second)).toEqual(bindingsOf(first));
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
    if (storage === "file") {
      await expect(readFile(literalCredentialFilePath("cfg-v1-gemini", 1), "utf8")).resolves.toBe(
        "sk-v1-file-literal",
      );
    } else {
      expect(keyringValues.get(getConfigurationSecretName("cfg-v1-gemini", 1))).toBe(
        "sk-v1-keyring-literal",
      );
    }
  });

  it.each([
    {
      name: "multiple active providers",
      config: () =>
        v1Config([
          v1Gemini({ [LEGACY_V1_HAS_API_KEY_PROPERTY]: false }),
          v1Gemini({ provider: "zai", model: undefined, [LEGACY_V1_HAS_API_KEY_PROPERTY]: false }),
        ]),
      secrets: secretsState({}),
      sentinel: "active",
    },
    {
      name: "a duplicate provider identity",
      config: () =>
        v1Config([
          v1Gemini({ isActive: false, [LEGACY_V1_HAS_API_KEY_PROPERTY]: false }),
          v1Gemini({ isActive: false, [LEGACY_V1_HAS_API_KEY_PROPERTY]: false }),
        ]),
      secrets: secretsState({}),
      sentinel: "gemini",
    },
    {
      name: "an invalid storage setting",
      config: () =>
        v1Config([v1Gemini({ isActive: false, [LEGACY_V1_HAS_API_KEY_PROPERTY]: false })], {
          secretsStorage: "invalid-storage-sentinel",
        }),
      secrets: secretsState({}),
      sentinel: "invalid-storage-sentinel",
    },
    {
      name: "a file install with no literal source",
      config: () => v1Config([v1Gemini()]),
      secrets: secretsState({}),
      sentinel: "cfg-v1-gemini",
    },
    {
      name: "a keyring install that still holds a literal source",
      config: () => v1Config([v1Gemini()], { secretsStorage: "keyring" }),
      secrets: secretsState({ gemini: "ambiguous-secret-sentinel" }),
      sentinel: "ambiguous-secret-sentinel",
    },
    {
      name: "an orphan secret",
      config: () => v1Config([]),
      secrets: secretsState({ gemini: "orphan-secret-sentinel" }),
      sentinel: "orphan-secret-sentinel",
    },
  ] satisfies readonly {
    readonly name: string;
    readonly config: () => ReturnType<typeof v1Config>;
    readonly secrets: SecretsState;
    readonly sentinel: string;
  }[])("rejects $name with one opaque fixed result and no credential I/O", async ({
    config,
    secrets,
    sentinel,
  }) => {
    const result = await upgradeV1Documents(config(), secrets, { budget });

    expect(result).toEqual(fixedFailure);
    expect(JSON.stringify(result)).not.toContain(sentinel);
    expect(keyring.readKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
  });

  it.each([
    { name: "a marketing alias", model: "gemini-flash-latest" },
    { name: "an unusable id", model: "invalid model sentinel" },
  ])("keeps a configuration whose stored model is $name and asks for a new one", async ({
    model,
  }) => {
    const result = await upgradeV1Documents(
      v1Config([v1Gemini({ model })]),
      secretsState({ gemini: "sk-v1-file-literal" }),
      { budget },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        configDocument: {
          selectedConfigurationId: "cfg-v1-gemini",
          configurations: [{ record: { selectedModelId: null } }],
        },
      },
    });
    expect(bindingsOf(result)).toEqual([
      {
        configurationId: "cfg-v1-gemini",
        revision: 1,
        status: "active",
        kind: "file-0600",
        filePath: literalCredentialFilePath("cfg-v1-gemini", 1),
      },
    ]);
    await expect(readFile(literalCredentialFilePath("cfg-v1-gemini", 1), "utf8")).resolves.toBe(
      "sk-v1-file-literal",
    );
    expect(JSON.stringify(result)).not.toContain(model);
  });

  it("drops a retired provider entry and its secret while upgrading supported siblings", async () => {
    const result = await upgradeV1Documents(
      v1Config([v1Gemini(), v1Gemini({ provider: "groq", isActive: false, model: undefined })]),
      secretsState({ gemini: "sk-v1-file-literal", groq: "sk-v1-groq-literal" }),
      { budget },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        configDocument: {
          selectedConfigurationId: "cfg-v1-gemini",
          configurations: [{ record: { productId: "gemini" } }],
        },
      },
    });
    if (!result.ok) throw new Error("upgrade must succeed");
    expect(result.value.configDocument.configurations).toHaveLength(1);
    expect(bindingsOf(result)).toEqual([
      {
        configurationId: "cfg-v1-gemini",
        revision: 1,
        status: "active",
        kind: "file-0600",
        filePath: literalCredentialFilePath("cfg-v1-gemini", 1),
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("groq");
    expect(JSON.stringify(result)).not.toContain("sk-v1-groq-literal");
  });

  it("upgrades an all-retired document to an empty V2 document without credential I/O", async () => {
    const result = await upgradeV1Documents(
      v1Config([
        v1Gemini({ provider: "groq", model: undefined }),
        v1Gemini({ provider: "cerebras", isActive: false, model: undefined }),
      ]),
      secretsState({ groq: "sk-v1-groq-literal", cerebras: "sk-v1-cerebras-literal" }),
      { budget },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        configDocument: { schemaVersion: 2, selectedConfigurationId: null, configurations: [] },
        secretsDocument: { schemaVersion: 2, bindings: [] },
      },
    });
    expect(JSON.stringify(result)).not.toContain("sk-v1-groq-literal");
    expect(keyring.readKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
  });

  it("fails a keyring install closed when its legacy source is gone", async () => {
    const result = await upgradeV1Documents(
      v1Config([v1Gemini()], { secretsStorage: "keyring" }),
      secretsState({}),
      { budget },
    );

    expect(result).toEqual(fixedFailure);
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
    expect(keyringValues.size).toBe(0);
  });
});
