import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tempHome: string;

beforeEach(async () => {
  tempHome = await mkdtemp(path.join(tmpdir(), "diffgazer-state-"));
  process.env.DIFFGAZER_HOME = tempHome;
  vi.resetModules();
});

afterEach(async () => {
  delete process.env.DIFFGAZER_HOME;
  await rm(tempHome, { recursive: true, force: true });
});

async function loadState() {
  return import("./state.js");
}

async function writeJson(fileName: string, data: unknown): Promise<void> {
  await writeFile(path.join(tempHome, fileName), `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf-8")) as T;
}

describe("config state", () => {
  it("loads default config, secrets, and trust when no files exist", async () => {
    const { loadConfig, loadSecrets, loadTrust, DEFAULT_PROVIDERS, DEFAULT_SETTINGS } = await loadState();

    expect(loadConfig()).toEqual({
      settings: DEFAULT_SETTINGS,
      providers: DEFAULT_PROVIDERS,
    });
    expect(loadSecrets()).toEqual({ providers: {} });
    expect(loadTrust()).toEqual({ projects: {} });
  });

  it("merges stored config with defaults and removes invalid providers", async () => {
    await writeJson("config.json", {
      settings: { theme: "dark" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
        { provider: "invalid-provider", hasApiKey: true, isActive: true },
      ],
    });
    const { loadConfig, DEFAULT_SETTINGS } = await loadState();

    const config = loadConfig();

    expect(config.settings).toEqual({ ...DEFAULT_SETTINGS, theme: "dark" });
    expect(config.providers.find((provider) => provider.provider === "gemini")).toMatchObject({
      hasApiKey: true,
      isActive: true,
      model: "gemini-2.5-flash",
    });
    const providerNames: string[] = config.providers.map((provider) => provider.provider);
    expect(providerNames).not.toContain("invalid-provider");
  });

  it("loads file-backed secrets", async () => {
    await writeJson("secrets.json", { providers: { gemini: "key-123" } });
    const { loadSecrets } = await loadState();

    expect(loadSecrets()).toEqual({ providers: { gemini: "key-123" } });
  });

  it("normalizes trust capabilities while preserving stored values", async () => {
    await writeJson("trust.json", {
      projects: {
        "proj-1": {
          projectId: "proj-1",
          projectPath: "/proj-1",
          capabilities: null,
        },
        "proj-2": {
          projectId: "proj-2",
          projectPath: "/proj-2",
          capabilities: { readFiles: true, runCommands: false },
        },
      },
    });
    const { loadTrust } = await loadState();

    expect(loadTrust()).toMatchObject({
      projects: {
        "proj-1": { capabilities: { readFiles: false, runCommands: false } },
        "proj-2": { capabilities: { readFiles: true, runCommands: false } },
      },
    });
  });

  it("persists config, secrets, and trust as real JSON files", async () => {
    const { persistConfig, persistSecrets, persistTrust, DEFAULT_SETTINGS } = await loadState();

    persistConfig({ settings: DEFAULT_SETTINGS, providers: [] });
    persistSecrets({ providers: { gemini: "key" } });
    persistTrust({ projects: {} });

    await expect(readJson(path.join(tempHome, "config.json"))).resolves.toEqual({
      settings: DEFAULT_SETTINGS,
      providers: [],
    });
    await expect(readJson(path.join(tempHome, "secrets.json"))).resolves.toEqual({
      providers: { gemini: "key" },
    });
    await expect(readJson(path.join(tempHome, "trust.json"))).resolves.toEqual({ projects: {} });
  });

  it("removes the secrets file when it exists", async () => {
    await writeJson("secrets.json", { providers: { gemini: "key" } });
    const { removeSecretsFile } = await loadState();

    expect(removeSecretsFile()).toBe(true);
    expect(removeSecretsFile()).toBe(false);
  });

  it("syncs providers with file secrets and ignores file secrets for keyring storage", async () => {
    const { syncProvidersWithSecrets } = await loadState();
    const providers = [{ provider: "gemini" as const, hasApiKey: false, isActive: false }];
    const secrets = { providers: { gemini: "key", zai: "key2" } };

    expect(syncProvidersWithSecrets(providers, secrets, "file")).toEqual([
      { provider: "gemini", hasApiKey: true, isActive: false },
      { provider: "zai", hasApiKey: true, isActive: false },
    ]);
    expect(syncProvidersWithSecrets(providers, secrets, "keyring")).toEqual(providers);
  });

  it("reads an existing project file or creates one under the project .diffgazer directory", async () => {
    const { readOrCreateProjectFile } = await loadState();
    const projectRoot = path.join(tempHome, "project");
    const projectFile = path.join(projectRoot, ".diffgazer", "project.json");
    await mkdir(path.dirname(projectFile), { recursive: true });
    await writeFile(projectFile, JSON.stringify({
      projectId: "existing-id",
      repoRoot: projectRoot,
      createdAt: "2024-01-01",
    }), "utf-8");

    expect(readOrCreateProjectFile(projectRoot).projectId).toBe("existing-id");

    const newRoot = path.join(tempHome, "new-project");
    const created = readOrCreateProjectFile(newRoot);
    expect(created).toMatchObject({ repoRoot: newRoot });
    await expect(readJson(path.join(newRoot, ".diffgazer", "project.json"))).resolves.toMatchObject({
      projectId: created.projectId,
      repoRoot: newRoot,
    });
  });
});
