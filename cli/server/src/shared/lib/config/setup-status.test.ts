import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AIProvider, TrustConfig } from "@diffgazer/core/schemas/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireValue } from "../../../testing/assertions.js";

const keyring = vi.hoisted(() => ({
  deleteKeyringSecret: vi.fn(),
  isKeyringAvailable: vi.fn(),
  readKeyringSecret: vi.fn(),
  writeKeyringSecret: vi.fn(),
}));

vi.mock("./keyring.js", () => keyring);

let diffgazerHome: string;
let projectRoot: string;

async function loadStore() {
  const { getStore } = await import("./store.js");
  return getStore();
}

async function configureProvider(
  provider: AIProvider,
  options: { apiKey?: string; model?: string } = {},
) {
  const store = await loadStore();
  await store.updateSettings({ secretsStorage: "file" });
  await store.saveProviderCredentials({
    provider,
    apiKey: options.apiKey ?? "sk-test",
    model: options.model,
  });
  return store;
}

function trustConfig(projectId: string, overrides: Partial<TrustConfig> = {}): TrustConfig {
  return {
    projectId,
    repoRoot: projectRoot,
    trustedAt: "2024-01-01T00:00:00.000Z",
    capabilities: { readFiles: true, runCommands: false },
    trustMode: "persistent",
    ...overrides,
  };
}

describe("getSetupStatus", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-setup-status-home-"));
    projectRoot = mkdtempSync(join(tmpdir(), "diffgazer-setup-status-project-"));
    mkdirSync(join(projectRoot, ".git"));
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
    rmSync(projectRoot, { recursive: true, force: true });
    warnSpy.mockRestore();
  });

  it("derives setup readiness from settings, provider config, and project trust", async () => {
    const { getSetupStatus } = await import("./setup-status.js");

    const initial = getSetupStatus(projectRoot);
    expect(initial.ok).toBe(true);
    if (!initial.ok) throw new Error(initial.error.message);
    expect(initial.value).toMatchObject({
      hasSecretsStorage: false,
      hasProvider: false,
      hasModel: false,
      hasTrust: false,
      isReady: false,
    });
    expect(initial.value.missing).toEqual(["secretsStorage", "provider", "model", "trust"]);

    const store = await configureProvider("gemini", { model: "gemini-2.5-flash" });
    const project = store.ensureProjectFile(projectRoot);
    await store.saveTrust(trustConfig(requireValue(project.projectId, "project id")));

    expect(getSetupStatus(projectRoot)).toMatchObject({
      ok: true,
      value: {
        hasSecretsStorage: true,
        hasProvider: true,
        hasModel: true,
        hasTrust: true,
        isConfigured: true,
        isReady: true,
        missing: [],
      },
    });
  });
});
