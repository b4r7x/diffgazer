import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const keyring = vi.hoisted(() => ({
  deleteKeyringSecret: vi.fn(),
  isKeyringAvailable: vi.fn(),
  readKeyringSecret: vi.fn(),
  writeKeyringSecret: vi.fn(),
}));

// Boundary mock: keyring wraps the OS keychain via @napi-rs/keyring; tests provide canned secret read/write/delete results.
vi.mock("./keyring.js", () => keyring);

const { finalizeKeyringDeletions, getApiKeyName, migrateV1SecretsToBindings } = await import(
  "./secrets-migration.js"
);

let credentialsDir: string;

beforeEach(() => {
  vi.clearAllMocks();
  keyring.isKeyringAvailable.mockReturnValue(true);
  keyring.readKeyringSecret.mockReturnValue({ ok: true, value: null });
  keyring.writeKeyringSecret.mockReturnValue({ ok: true, value: undefined });
  keyring.deleteKeyringSecret.mockReturnValue({ ok: true, value: true });
  credentialsDir = mkdtempSync(join(tmpdir(), "diffgazer-migration-"));
});

afterEach(() => {
  rmSync(credentialsDir, { recursive: true, force: true });
});

const filePathFor = ({
  configurationId,
  revision,
}: {
  configurationId: string;
  revision: number;
}): string => join(credentialsDir, `${configurationId}-${revision}.key`);

describe("getApiKeyName", () => {
  it("namespaces the keyring entry name by provider", () => {
    expect(getApiKeyName("gemini")).toBe("api_key_gemini");
  });
});

describe("finalizeKeyringDeletions", () => {
  it("deletes every queued keyring entry by key name", () => {
    finalizeKeyringDeletions(["api_key_gemini", "api_key_zai"]);

    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith("api_key_zai");
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledTimes(2);
  });
});

describe("migrateV1SecretsToBindings", () => {
  it("writes a literal secret to its configuration-keyed file and binds the reference", () => {
    const result = migrateV1SecretsToBindings(
      { providers: { gemini: "file-key" } },
      [{ provider: "gemini", configurationId: "cfg-v1-gemini", revision: 1 }],
      { storage: "file", filePathFor },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.bindings).toEqual([
      {
        configurationId: "cfg-v1-gemini",
        revision: 1,
        status: "active",
        kind: "file-0600",
        filePath: filePathFor({ configurationId: "cfg-v1-gemini", revision: 1 }),
      },
    ]);
    expect(
      readFileSync(filePathFor({ configurationId: "cfg-v1-gemini", revision: 1 }), "utf8"),
    ).toBe("file-key");
  });

  it("copies a keyring secret to its configuration key and defers the provider-key deletion", () => {
    let configurationKeyValue: string | null = null;
    keyring.writeKeyringSecret.mockImplementation((key: string, value: string) => {
      if (key !== "api_key_gemini") configurationKeyValue = value;
      return { ok: true, value: undefined };
    });
    keyring.readKeyringSecret.mockImplementation((key: string) =>
      key === "api_key_gemini"
        ? { ok: true, value: "keyring-key" }
        : { ok: true, value: configurationKeyValue },
    );

    const result = migrateV1SecretsToBindings(
      { providers: { gemini: "keyring-key" } },
      [{ provider: "gemini", configurationId: "cfg-v1-gemini", revision: 1 }],
      { storage: "keyring", filePathFor },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.bindings[0]).toMatchObject({ kind: "keyring-reference" });
    expect(result.value.keyringDeletions).toEqual(["api_key_gemini"]);
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
  });

  it("preserves an env reference without touching the keyring or the filesystem", () => {
    const result = migrateV1SecretsToBindings(
      { providers: { gemini: { kind: "env", varName: "GOOGLE_API_KEY" } } },
      [{ provider: "gemini", configurationId: "cfg-v1-gemini", revision: 1 }],
      { storage: "file", filePathFor },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.bindings[0]).toMatchObject({
      kind: "environment-reference",
      varName: "GOOGLE_API_KEY",
    });
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
  });

  it("retains an unmigratable provider's binding without reading, copying, or deleting its secret", () => {
    const result = migrateV1SecretsToBindings(
      { providers: { "future-provider": "retired-key" } },
      [{ provider: "future-provider", configurationId: "cfg-v1-future-provider", revision: 1 }],
      { storage: "keyring", filePathFor },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.bindings[0]).toMatchObject({ status: "removed" });
    expect(result.value.retainedLegacy).toHaveLength(1);
    expect(keyring.readKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
  });

  it("rejects a duplicated configuration identity", () => {
    const result = migrateV1SecretsToBindings(
      { providers: { gemini: "file-key" } },
      [
        { provider: "gemini", configurationId: "cfg-v1-gemini", revision: 1 },
        { provider: "gemini", configurationId: "cfg-v1-gemini", revision: 1 },
      ],
      { storage: "file", filePathFor },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "SECRETS_MIGRATION_FAILED" } });
  });
});
