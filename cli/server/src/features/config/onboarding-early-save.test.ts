import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Regression guard for F-203: OpenRouter onboarding's early credential save was
// rejected with STORAGE_NOT_CONFIGURED on a fresh install because settings were
// never persisted before it. The wizard now saves the storage choice first
// (libs/core useWizardState.runEarlySave). This drives that exact order against
// the REAL config store + service.

const keyring = vi.hoisted(() => ({
  deleteKeyringSecret: vi.fn(),
  isKeyringAvailable: vi.fn(),
  readKeyringSecret: vi.fn(),
  writeKeyringSecret: vi.fn(),
}));

// Boundary mock: keyring wraps the OS keychain via @napi-rs/keyring.
vi.mock("../../shared/lib/config/keyring.js", () => keyring);

let diffgazerHome: string;

async function loadService() {
  return import("./service.js");
}

async function loadStore() {
  const { getStore } = await import("../../shared/lib/config/store.js");
  return getStore();
}

describe("onboarding early-save against the real config store", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-early-save-home-"));
    mkdirSync(diffgazerHome, { recursive: true });
    process.env.DIFFGAZER_HOME = diffgazerHome;
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();
    vi.clearAllMocks();
    keyring.isKeyringAvailable.mockReturnValue(true);
    keyring.readKeyringSecret.mockReturnValue({ ok: true, value: null });
    keyring.writeKeyringSecret.mockReturnValue({ ok: true, value: undefined });
    keyring.deleteKeyringSecret.mockReturnValue({ ok: true, value: false });
  });

  afterEach(() => {
    delete process.env.DIFFGAZER_HOME;
    rmSync(diffgazerHome, { recursive: true, force: true });
    warnSpy.mockRestore();
  });

  it("rejects the credential save before any settings are persisted", async () => {
    const { saveConfig } = await loadService();

    const result = await saveConfig({
      provider: "openrouter",
      apiKey: { kind: "literal", value: "sk-openrouter" },
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "STORAGE_NOT_CONFIGURED" },
    });
  });

  it("accepts the credential save once the storage choice has been persisted first", async () => {
    const store = await loadStore();
    const { saveConfig } = await loadService();

    // Step 1 of the wizard's early save: persist the storage selection.
    await store.updateSettings({ secretsStorage: "file" });

    // Step 2: the OpenRouter credential save now succeeds.
    const result = await saveConfig({
      provider: "openrouter",
      apiKey: { kind: "literal", value: "sk-openrouter" },
    });

    expect(result).toMatchObject({
      ok: true,
      value: { provider: "openrouter", hasApiKey: true },
    });
  });
});
