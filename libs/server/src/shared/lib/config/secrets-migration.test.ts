import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ConfigState, SecretsState } from "./types.js";

const keyring = vi.hoisted(() => ({
  deleteKeyringSecret: vi.fn(),
  isKeyringAvailable: vi.fn(),
  readKeyringSecret: vi.fn(),
  writeKeyringSecret: vi.fn(),
}));

const stateMocks = vi.hoisted(() => ({
  removeSecretsFile: vi.fn(),
}));

// Boundary mock: keyring wraps the OS keychain via @napi-rs/keyring; tests provide canned secret read/write/delete results.
vi.mock("./keyring.js", () => keyring);
// Boundary mock: state wraps on-disk JSON config persistence; tests stub removeSecretsFile to observe the migration side effect without touching the filesystem.
vi.mock("./state.js", () => stateMocks);

const { migrateSecretsStorage, finalizeKeyringDeletions, getApiKeyName } = await import(
  "./secrets-migration.js"
);

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
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: "key-from-keyring" });
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
      expect(result.value.nextSecrets).toEqual({ providers: { gemini: "k" } });
    }
    expect(keyring.writeKeyringSecret).not.toHaveBeenCalled();
  });

  it("writes each file secret to the keyring and clears the file map", () => {
    const result = migrateSecretsStorage(
      makeConfigState(),
      { providers: { gemini: "g-key" } },
      "file",
      "keyring",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nextSecrets.providers).toEqual({});
      expect(result.value.removedFileSecrets).toBe(true);
      expect(result.value.keyringDeletions).toEqual([]);
    }
    expect(keyring.writeKeyringSecret).toHaveBeenCalledWith("api_key_gemini", "g-key");
    expect(stateMocks.removeSecretsFile).toHaveBeenCalled();
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

  it("reads keyring secrets and defers their deletion until the caller persists the file copy", () => {
    const result = migrateSecretsStorage(
      makeConfigState(),
      { providers: {} },
      "keyring",
      "file",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nextSecrets.providers).toEqual({
        gemini: "key-from-keyring",
      });
      expect(result.value.keyringDeletions).toEqual(["gemini"]);
    }
    // The migration itself must NOT touch the keyring. Deletion is the caller's
    // responsibility, executed only after the file copy is durably persisted.
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
  });

  it("does NOT delete keyring entries if the caller crashes before persisting the file (crash-safety)", () => {
    // Simulate the keyring→file migration up to the point where the file copy
    // is about to be persisted. If a crash occurs here, the keyring must still
    // hold the secret so the migration can be safely retried on next start.
    const result = migrateSecretsStorage(
      makeConfigState(),
      { providers: {} },
      "keyring",
      "file",
    );
    expect(result.ok).toBe(true);

    // Caller never invokes finalizeKeyringDeletions (process crashed).
    expect(keyring.deleteKeyringSecret).not.toHaveBeenCalled();
    // The keyring read returned the value, so the in-memory plan has it;
    // critically, the OS keyring is still untouched and the next run will
    // re-read it successfully.
    expect(keyring.readKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
  });

  it("finalizeKeyringDeletions deletes every queued provider keyring entry", () => {
    finalizeKeyringDeletions(["gemini", "zai"]);
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith("api_key_gemini");
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledWith("api_key_zai");
    // call-count IS the contract: keyring deletion must run exactly once per queued provider (no skipped providers, no spurious extra deletes)
    expect(keyring.deleteKeyringSecret).toHaveBeenCalledTimes(2);
  });

  it("returns SECRET_NOT_FOUND when a keyring secret is missing during migration", () => {
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: null });

    const result = migrateSecretsStorage(
      makeConfigState(),
      { providers: {} },
      "keyring",
      "file",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SECRET_NOT_FOUND");
    }
  });
});
