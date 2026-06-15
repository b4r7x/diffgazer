import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigState } from "./types.js";

const keyring = vi.hoisted(() => ({
  deleteKeyringSecret: vi.fn(),
  isKeyringAvailable: vi.fn(),
  readKeyringSecret: vi.fn(),
  writeKeyringSecret: vi.fn(),
}));

// Boundary mock: keyring wraps the OS keychain via @napi-rs/keyring; tests provide canned secret read/write/delete results.
vi.mock("./keyring.js", () => keyring);

const {
  migrateSecretsStorage,
  reconcileKeyringSecrets,
  finalizeKeyringDeletions,
  findOrphanedKeyringEntries,
  getApiKeyName,
  rollbackKeyringWrites,
} = await import("./secrets-migration.js");

function makeConfigState(): ConfigState {
  return {
    settings: {
      theme: "auto",
      secretsStorage: "file",
      defaultLenses: ["correctness"],
      defaultProfile: null,
      severityThreshold: "low",
      agentExecution: "sequential",
    },
    providers: [
      { provider: "gemini", hasApiKey: true, isActive: true, model: "g" },
      { provider: "openrouter", hasApiKey: false, isActive: false },
    ],
  };
}

describe("getApiKeyName", () => {
  it("namespaces the keyring entry name by provider", () => {
    expect(getApiKeyName("gemini")).toBe("api_key_gemini");
  });
});

describe("migrateSecretsStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    keyring.isKeyringAvailable.mockReturnValue(true);
    keyring.writeKeyringSecret.mockReturnValue({ ok: true, value: undefined });
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: null });
    keyring.deleteKeyringSecret.mockReturnValue({ ok: true, value: true });
  });

  it("is a no-op when source and target storage match", () => {
    const result = migrateSecretsStorage(
      makeConfigState(),
      { providers: { gemini: "k" } },
      "file",
      "file",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.removedFileSecrets).toBe(false);
      expect(result.value.shouldDeleteSecretsFile).toBe(false);
      expect(result.value.nextSecrets).toEqual({ providers: { gemini: "k" } });
      expect(result.value.keyringWrites).toEqual([]);
    }
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
  });

  it("writes each file secret to the keyring, verifies read-back, and defers file deletion", () => {
    // readKeyringSecret is used for verification -- return the same value that was written
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: "g-key" });

    const result = migrateSecretsStorage(
      makeConfigState(),
      { providers: { gemini: "g-key" } },
      "file",
      "keyring",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nextSecrets.providers).toEqual({});
      // File is NOT removed by migrateSecretsStorage -- caller handles it after persisting config
      expect(result.value.removedFileSecrets).toBe(false);
      expect(result.value.shouldDeleteSecretsFile).toBe(true);
      expect(result.value.keyringDeletions).toEqual([]);
      expect(result.value.keyringWrites).toEqual([
        { providerId: "gemini", previousValue: "g-key" },
      ]);
    }
    expect(keyring.writeKeyringSecret).toHaveBeenCalledWith("api_key_gemini", "g-key");
    // Verification read-back must occur after write
    expect(keyring.readKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
  });

  it("returns KEYRING_UNAVAILABLE when migrating to keyring without keyring support", () => {
    keyring.isKeyringAvailable.mockReturnValue(false);

    const result = migrateSecretsStorage(
      makeConfigState(),
      { providers: { gemini: "k" } },
      "file",
      "keyring",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("KEYRING_UNAVAILABLE");
    }
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
  });

  it("rolls back keyring writes when a subsequent write fails", () => {
    let writeCount = 0;
    keyring.writeKeyringSecret.mockImplementation(() => {
      writeCount++;
      if (writeCount === 2) {
        return { ok: false, error: { code: "KEYRING_WRITE_FAILED", message: "write failed" } };
      }
      return { ok: true, value: undefined };
    });
    keyring.readKeyringSecret
      .mockReturnValueOnce({ ok: true, value: null })
      .mockReturnValueOnce({ ok: true, value: "key-a" })
      .mockReturnValueOnce({ ok: true, value: null });

    const result = migrateSecretsStorage(
      makeConfigState(),
      { providers: { gemini: "key-a", openrouter: "key-b" } },
      "file",
      "keyring",
    );

    expect(result.ok).toBe(false);
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
  });

  it("rolls back keyring writes when read-back verification fails", () => {
    keyring.readKeyringSecret
      .mockReturnValueOnce({ ok: true, value: null })
      .mockReturnValueOnce({ ok: true, value: "wrong-value" });

    const result = migrateSecretsStorage(
      makeConfigState(),
      { providers: { gemini: "g-key" } },
      "file",
      "keyring",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SECRETS_MIGRATION_FAILED");
    }
    // No successful writes to rollback (verification failed on the first provider)
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
  });

  it("does not signal file deletion when env entries remain", () => {
    const result = migrateSecretsStorage(
      makeConfigState(),
      { providers: { gemini: { kind: "env", varName: "GEMINI_API_KEY" } } },
      "file",
      "keyring",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.shouldDeleteSecretsFile).toBe(false);
      expect(result.value.nextSecrets.providers).toEqual({
        gemini: { kind: "env", varName: "GEMINI_API_KEY" },
      });
    }
    // No literal secrets to write to keyring
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
  });

  it("moves literal file secrets to keyring while preserving env entries in the sidecar file", () => {
    keyring.readKeyringSecret
      .mockReturnValueOnce({ ok: true, value: null })
      .mockReturnValueOnce({ ok: true, value: "g-key" });

    const result = migrateSecretsStorage(
      makeConfigState(),
      {
        providers: {
          gemini: "g-key",
          openrouter: { kind: "env", varName: "OPENROUTER_API_KEY" },
        },
      },
      "file",
      "keyring",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nextSecrets.providers).toEqual({
        openrouter: { kind: "env", varName: "OPENROUTER_API_KEY" },
      });
      expect(result.value.shouldDeleteSecretsFile).toBe(false);
      expect(result.value.keyringWrites).toEqual([{ providerId: "gemini", previousValue: null }]);
    }
    expect(keyring.writeKeyringSecret).toHaveBeenCalledExactlyOnceWith("api_key_gemini", "g-key");
  });

  it("reads keyring secrets and defers their deletion until the caller persists the file copy", () => {
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: "key-from-keyring" });
    const result = migrateSecretsStorage(makeConfigState(), { providers: {} }, "keyring", "file");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nextSecrets.providers).toEqual({
        gemini: "key-from-keyring",
      });
      expect(result.value.keyringDeletions).toEqual(["gemini"]);
      expect(result.value.shouldDeleteSecretsFile).toBe(false);
      expect(result.value.keyringWrites).toEqual([]);
    }
    // The migration itself must NOT touch the keyring. Deletion is the caller's
    // responsibility, executed only after the file copy is durably persisted.
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
  });

  it("does NOT delete keyring entries if the caller crashes before persisting the file (crash-safety)", () => {
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: "key-from-keyring" });
    const result = migrateSecretsStorage(makeConfigState(), { providers: {} }, "keyring", "file");
    expect(result.ok).toBe(true);

    // Caller never invokes finalizeKeyringDeletions (process crashed).
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    expect(keyring.readKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
  });

  it("finalizeKeyringDeletions deletes every queued provider keyring entry", () => {
    finalizeKeyringDeletions(["gemini", "zai"]);
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith("api_key_zai");
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledTimes(2);
  });

  it("returns SECRET_NOT_FOUND when a keyring secret is missing during migration", () => {
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: null });

    const result = migrateSecretsStorage(makeConfigState(), { providers: {} }, "keyring", "file");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SECRET_NOT_FOUND");
    }
  });

  it("findOrphanedKeyringEntries reports providers whose keyring entry survives in file mode", () => {
    keyring.readKeyringSecret.mockImplementation((key: string) =>
      key === "api_key_gemini" ? { ok: true, value: "stale" } : { ok: true, value: null },
    );

    const result = findOrphanedKeyringEntries(makeConfigState());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(["gemini"]);
  });

  it("findOrphanedKeyringEntries returns nothing when the keyring is unavailable", () => {
    keyring.isKeyringAvailable.mockReturnValue(false);

    const result = findOrphanedKeyringEntries(makeConfigState());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
    expect(keyring.readKeyringSecret).not.toHaveBeenCalled();
  });

  it("restores previous keyring values when rolling back a migration", () => {
    rollbackKeyringWrites([
      { providerId: "gemini", previousValue: "old-key" },
      { providerId: "openrouter", previousValue: null },
    ]);

    expect(keyring.writeKeyringSecret).toHaveBeenCalledWith("api_key_gemini", "old-key");
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith("api_key_openrouter");
  });

  it("carries unknown ref-kind entries through a file->keyring migration and keeps the file (T-03)", () => {
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: "g-key" });

    const result = migrateSecretsStorage(
      makeConfigState(),
      {
        providers: { gemini: "g-key" },
        unknownSecrets: { zai: { kind: "vault", ref: "secret/zai" } },
      },
      "file",
      "keyring",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nextSecrets.unknownSecrets).toEqual({
        zai: { kind: "vault", ref: "secret/zai" },
      });
      // An unknown entry still lives in the file, so it must NOT be deleted.
      expect(result.value.shouldDeleteSecretsFile).toBe(false);
    }
  });

  it("carries unknown ref-kind entries through a keyring->file migration (T-03)", () => {
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: "key-from-keyring" });

    const result = migrateSecretsStorage(
      makeConfigState(),
      { providers: {}, unknownSecrets: { zai: { kind: "vault", ref: "secret/zai" } } },
      "keyring",
      "file",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nextSecrets.providers).toEqual({ gemini: "key-from-keyring" });
      expect(result.value.nextSecrets.unknownSecrets).toEqual({
        zai: { kind: "vault", ref: "secret/zai" },
      });
    }
  });
});

describe("reconcileKeyringSecrets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    keyring.isKeyringAvailable.mockReturnValue(true);
    keyring.writeKeyringSecret.mockReturnValue({ ok: true, value: undefined });
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: null });
    keyring.deleteKeyringSecret.mockReturnValue({ ok: true, value: true });
  });

  it("moves stranded literals into the keyring while round-tripping unknown ref-kind entries (T-03)", () => {
    keyring.readKeyringSecret
      .mockReturnValueOnce({ ok: true, value: null })
      .mockReturnValueOnce({ ok: true, value: "stranded" });

    const result = reconcileKeyringSecrets({
      providers: { gemini: "stranded" },
      unknownSecrets: { zai: { kind: "vault", ref: "secret/zai" } },
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.value) {
      expect(result.value.migrated).toEqual(["gemini"]);
      // The literal was dropped from the returned state...
      expect(result.value.nextSecrets.providers).toEqual({});
      // ...but the opaque unknown entry survives so the file is not emptied/deleted.
      expect(result.value.nextSecrets.unknownSecrets).toEqual({
        zai: { kind: "vault", ref: "secret/zai" },
      });
    }
    expect(keyring.writeKeyringSecret).toHaveBeenCalledWith("api_key_gemini", "stranded");
  });

  it("returns null when there is nothing to reconcile", () => {
    const result = reconcileKeyringSecrets({
      providers: { gemini: { kind: "env", varName: "GEMINI_API_KEY" } },
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
  });
});
