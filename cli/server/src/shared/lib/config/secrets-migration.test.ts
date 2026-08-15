import { lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertTempHome } from "../testing/temp-home.js";
import type { SecretsState } from "./types.js";

const keyring = vi.hoisted(() => ({
  deleteKeyringSecret: vi.fn(),
  isKeyringAvailable: vi.fn(),
  readKeyringSecret: vi.fn(),
  writeKeyringSecret: vi.fn(),
}));

vi.mock("./keyring.js", () => keyring);

const { preflightV1SecretsMigration, transferV1Credentials } = await import(
  "./secrets-migration.js"
);
const { V1_MIGRATION_FAILED_MESSAGE } = await import("./types.js");
const { getConfigurationSecretName } = await import("./secrets-store.js");
const { literalCredentialFilePath } = await import("./persistence/credential-file-path.js");

const geminiConfiguration = {
  provider: "gemini",
  configurationId: "cfg-v1-gemini",
  revision: 1,
  hasApiKey: true,
} as const;

const zaiConfiguration = {
  provider: "zai",
  configurationId: "cfg-v1-zai",
  revision: 1,
  hasApiKey: false,
} as const;

const secretsState = (providers: SecretsState["providers"]): SecretsState => ({ providers });

const fixedFailure = {
  ok: false,
  error: { code: "SECRETS_MIGRATION_FAILED", message: V1_MIGRATION_FAILED_MESSAGE },
};

let home: string;
let keyringValues: Map<string, string>;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "diffgazer-v1-migration-"));
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

// The migration is awaited by every test and starts no background writer, so the temp home
// only has to fall before DIFFGAZER_HOME is dropped, which `paths.ts` re-reads per call.
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
  delete process.env.DIFFGAZER_HOME;
});

const expectNoKeyringCalls = (): void => {
  expect(keyring.isKeyringAvailable).not.toHaveBeenCalled();
  expect(keyring.readKeyringSecret).not.toHaveBeenCalled();
  expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
  expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
};

describe("preflightV1SecretsMigration", () => {
  it("plans environment and no-secret rows as metadata without storage I/O", () => {
    const result = preflightV1SecretsMigration(
      secretsState({ gemini: { kind: "env", varName: "GOOGLE_API_KEY" } }),
      [geminiConfiguration, zaiConfiguration],
      "file",
    );

    expect(result).toEqual({
      ok: true,
      value: {
        bindings: [
          {
            configurationId: "cfg-v1-gemini",
            revision: 1,
            status: "active",
            kind: "environment-reference",
            varName: "GOOGLE_API_KEY",
          },
          { configurationId: "cfg-v1-zai", revision: 1, status: "active", kind: "none" },
        ],
        transfers: [],
      },
    });
    expectNoKeyringCalls();
  });

  it("plans a file-install literal as a contained credential file without storage I/O", () => {
    const result = preflightV1SecretsMigration(
      secretsState({ gemini: "sk-v1-file-literal" }),
      [geminiConfiguration],
      "file",
    );

    expect(result).toEqual({
      ok: true,
      value: {
        bindings: [
          {
            configurationId: "cfg-v1-gemini",
            revision: 1,
            status: "active",
            kind: "file-0600",
            filePath: literalCredentialFilePath("cfg-v1-gemini", 1),
          },
        ],
        transfers: [
          {
            kind: "file",
            value: "sk-v1-file-literal",
            binding: expect.objectContaining({ kind: "file-0600" }),
          },
        ],
      },
    });
    expectNoKeyringCalls();
  });

  it("plans a keyring-install claim as a legacy-to-canonical copy without storage I/O", () => {
    const result = preflightV1SecretsMigration(secretsState({}), [geminiConfiguration], "keyring");

    expect(result).toEqual({
      ok: true,
      value: {
        bindings: [
          {
            configurationId: "cfg-v1-gemini",
            revision: 1,
            status: "active",
            kind: "keyring-reference",
            keyId: getConfigurationSecretName("cfg-v1-gemini", 1),
          },
        ],
        transfers: [
          {
            kind: "keyring",
            legacyKeyId: "api_key_gemini",
            binding: expect.objectContaining({ kind: "keyring-reference" }),
          },
        ],
      },
    });
    expectNoKeyringCalls();
  });

  it.each([
    {
      name: "a file install that claims an API key with no source",
      state: secretsState({}),
      configurations: [geminiConfiguration],
      storage: "file",
    },
    {
      name: "a keyring install that also still holds a literal source",
      state: secretsState({ gemini: "source-must-not-leak" }),
      configurations: [geminiConfiguration],
      storage: "keyring",
    },
    {
      name: "an environment source when hasApiKey is false",
      state: secretsState({ gemini: { kind: "env", varName: "GOOGLE_API_KEY" } }),
      configurations: [{ ...geminiConfiguration, hasApiKey: false }],
      storage: "file",
    },
    {
      name: "a literal source when hasApiKey is false",
      state: secretsState({ gemini: "source-must-not-leak" }),
      configurations: [{ ...geminiConfiguration, hasApiKey: false }],
      storage: "file",
    },
    {
      name: "an invalid configuration identity",
      state: secretsState({}),
      configurations: [{ ...geminiConfiguration, hasApiKey: false, revision: 0 }],
      storage: "file",
    },
    {
      name: "a duplicate provider identity",
      state: secretsState({}),
      configurations: [
        { ...geminiConfiguration, hasApiKey: false },
        { ...geminiConfiguration, hasApiKey: false },
      ],
      storage: "file",
    },
    {
      name: "an orphan secret with no configuration",
      state: secretsState({ gemini: "source-must-not-leak" }),
      configurations: [],
      storage: "file",
    },
  ] as const)("rejects $name before any storage I/O", ({ state, configurations, storage }) => {
    const result = preflightV1SecretsMigration(state, configurations, storage);

    expect(result).toEqual(fixedFailure);
    expect(JSON.stringify(result)).not.toContain("source-must-not-leak");
    expectNoKeyringCalls();
  });

  it("rejects a later invalid record after a genuinely valid one without planning a transfer", () => {
    const state = secretsState({ gemini: "sk-v1-file-literal" });
    const invalidLater = { ...zaiConfiguration, revision: 0 };

    expect(preflightV1SecretsMigration(state, [geminiConfiguration], "file")).toMatchObject({
      ok: true,
    });
    expect(preflightV1SecretsMigration(state, [geminiConfiguration, invalidLater], "file")).toEqual(
      fixedFailure,
    );
    expectNoKeyringCalls();
  });
});

const filePlan = (value: string) => {
  const preflight = preflightV1SecretsMigration(
    secretsState({ gemini: value }),
    [geminiConfiguration],
    "file",
  );
  if (!preflight.ok) throw new Error("file preflight must succeed");
  return preflight.value.transfers;
};

const keyringPlan = () => {
  const preflight = preflightV1SecretsMigration(secretsState({}), [geminiConfiguration], "keyring");
  if (!preflight.ok) throw new Error("keyring preflight must succeed");
  return preflight.value.transfers;
};

describe("transferV1Credentials", () => {
  const credentialPath = () => literalCredentialFilePath("cfg-v1-gemini", 1);
  const destinationKey = () => getConfigurationSecretName("cfg-v1-gemini", 1);

  it("writes an absent credential file with mode 0600 inside the app directory", async () => {
    await expect(transferV1Credentials(filePlan("sk-v1-file-literal"))).resolves.toEqual({
      ok: true,
      value: undefined,
    });

    await expect(readFile(credentialPath(), "utf8")).resolves.toBe("sk-v1-file-literal");
    expect((await lstat(credentialPath())).mode & 0o777).toBe(0o600);
    expectNoKeyringCalls();
  });

  it("reuses an identical credential file so a restarted migration converges", async () => {
    await transferV1Credentials(filePlan("sk-v1-file-literal"));
    const first = await lstat(credentialPath());

    await expect(transferV1Credentials(filePlan("sk-v1-file-literal"))).resolves.toEqual({
      ok: true,
      value: undefined,
    });

    expect((await lstat(credentialPath())).ino).toBe(first.ino);
    await expect(readFile(credentialPath(), "utf8")).resolves.toBe("sk-v1-file-literal");
  });

  it("fails closed instead of overwriting a credential file holding a different secret", async () => {
    await transferV1Credentials(filePlan("sk-v1-already-there"));

    const result = await transferV1Credentials(filePlan("sk-v1-file-literal"));

    expect(result).toEqual(fixedFailure);
    await expect(readFile(credentialPath(), "utf8")).resolves.toBe("sk-v1-already-there");
  });

  it("copies a legacy keyring secret to the canonical key and verifies it by read-back", async () => {
    keyringValues.set("api_key_gemini", "sk-v1-keyring-literal");

    await expect(transferV1Credentials(keyringPlan())).resolves.toEqual({
      ok: true,
      value: undefined,
    });

    expect(keyringValues.get(destinationKey())).toBe("sk-v1-keyring-literal");
    expect(keyringValues.get("api_key_gemini")).toBe("sk-v1-keyring-literal");
  });

  it("reuses an equal canonical keyring value without writing again", async () => {
    keyringValues.set("api_key_gemini", "sk-v1-keyring-literal");
    keyringValues.set(destinationKey(), "sk-v1-keyring-literal");

    await expect(transferV1Credentials(keyringPlan())).resolves.toEqual({
      ok: true,
      value: undefined,
    });

    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
  });

  it("never overwrites a canonical keyring key holding a different secret, because the keyring wrapper cannot tell an absent entry from a failed read", async () => {
    keyringValues.set("api_key_gemini", "sk-v1-keyring-literal");
    keyringValues.set(destinationKey(), "sk-someone-elses-secret");

    const result = await transferV1Credentials(keyringPlan());

    expect(result).toEqual(fixedFailure);
    expect(JSON.stringify(result)).not.toContain("sk-someone-elses-secret");
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
    expect(keyringValues.get(destinationKey())).toBe("sk-someone-elses-secret");
  });

  it("fails closed when the legacy keyring source is missing", async () => {
    const result = await transferV1Credentials(keyringPlan());

    expect(result).toEqual(fixedFailure);
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
    expect(keyringValues.size).toBe(0);
  });

  it("fails closed when the keyring cannot be read", async () => {
    keyring.readKeyringSecret.mockReturnValue({
      ok: false,
      error: { code: "KEYRING_UNAVAILABLE", message: "keyring is locked" },
    });

    const result = await transferV1Credentials(keyringPlan());

    expect(result).toEqual(fixedFailure);
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
  });
});
