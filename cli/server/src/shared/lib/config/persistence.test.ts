import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
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
  return import("./persistence.js");
}

async function writeJson(fileName: string, data: unknown): Promise<void> {
  await writeFile(path.join(tempHome, fileName), `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf-8")) as T;
}

describe("config state", () => {
  it("loads default config, secrets, and trust when no files exist", async () => {
    const { loadConfig, loadSecrets, loadTrust, DEFAULT_PROVIDERS, DEFAULT_SETTINGS } =
      await loadState();

    expect(loadConfig()).toEqual({
      settings: DEFAULT_SETTINGS,
      providers: DEFAULT_PROVIDERS,
    });
    expect(loadSecrets()).toEqual({ providers: {} });
    expect(loadTrust()).toEqual({ projects: {} });
  });

  it("merges stored config with defaults", async () => {
    await writeJson("config.json", {
      settings: { theme: "dark" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
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
  });

  it("loads file-backed secrets", async () => {
    await writeJson("secrets.json", { providers: { gemini: "key-123" } });
    const { loadSecrets } = await loadState();

    expect(loadSecrets()).toEqual({ providers: { gemini: "key-123" } });
  });

  it("keeps valid settings when the providers shape is malformed without quarantining", async () => {
    await writeJson("config.json", {
      settings: { theme: "dark" },
      providers: { gemini: { hasApiKey: true } },
    });
    const { loadConfig, DEFAULT_SETTINGS, DEFAULT_PROVIDERS } = await loadState();

    // The malformed providers slot falls back to defaults, but the valid theme
    // setting survives and the file is NOT quarantined (record-level tolerance).
    expect(loadConfig()).toEqual({
      settings: { ...DEFAULT_SETTINGS, theme: "dark" },
      providers: DEFAULT_PROVIDERS,
    });

    const files = await readdir(tempHome);
    expect(files.some((file) => /^config\.json\..+\.backup$/.test(file))).toBe(false);
  });

  it("loads an unknown provider id and unknown settings without quarantine, re-emitting them on persist", async () => {
    await writeJson("config.json", {
      settings: { theme: "dark", defaultLenses: ["correctness", "made-up-lens"] },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
        { provider: "future-provider", hasApiKey: true, isActive: false },
      ],
    });
    const { loadConfig, persistConfig, DEFAULT_SETTINGS } = await loadState();

    const config = loadConfig();
    // No quarantine: the unknown provider id and unknown lens value are tolerated.
    const files = await readdir(tempHome);
    expect(files.some((file) => /^config\.json\..+\.backup$/.test(file))).toBe(false);
    // The known provider keeps its state; the invalid lens falls back to the default.
    expect(config.providers.find((p) => p.provider === "gemini")).toMatchObject({
      hasApiKey: true,
      isActive: true,
      model: "gemini-2.5-flash",
    });
    expect(config.settings.defaultLenses).toEqual(DEFAULT_SETTINGS.defaultLenses);
    expect(config.settings.theme).toBe("dark");

    // Persisting after load re-emits the unknown provider entry so a newer binary
    // does not lose state written by an older one.
    persistConfig(config);
    const persisted = await readJson<{ providers: Array<{ provider: string }> }>(
      path.join(tempHome, "config.json"),
    );
    expect(persisted.providers.some((p) => p.provider === "future-provider")).toBe(true);
  });

  it("keeps known secrets loadable when one entry uses an unknown ref kind", async () => {
    await writeJson("secrets.json", {
      providers: {
        gemini: "real-key",
        zai: { kind: "vault", path: "secret/zai" },
      },
    });
    const { loadSecrets, persistSecrets } = await loadState();

    const secrets = loadSecrets();
    const files = await readdir(tempHome);
    expect(files.some((file) => /^secrets\.json\..+\.backup$/.test(file))).toBe(false);
    expect(secrets.providers).toEqual({ gemini: "real-key" });

    // The unknown ref kind round-trips on persist instead of being destroyed.
    persistSecrets(secrets);
    const persisted = await readJson<{ providers: Record<string, unknown> }>(
      path.join(tempHome, "secrets.json"),
    );
    expect(persisted.providers.zai).toEqual({ kind: "vault", path: "secret/zai" });
    expect(persisted.providers.gemini).toBe("real-key");
  });

  it("quarantines a JSON-corrupt config.json and returns defaults", async () => {
    await writeFile(path.join(tempHome, "config.json"), "{not json", "utf-8");
    const { loadConfig, DEFAULT_PROVIDERS, DEFAULT_SETTINGS } = await loadState();

    // JSON.parse failure quarantines the file and falls back to defaults.
    expect(loadConfig()).toEqual({
      settings: DEFAULT_SETTINGS,
      providers: DEFAULT_PROVIDERS,
    });
    const files = await readdir(tempHome);
    expect(files.some((file) => /^config\.json\..+\.backup$/.test(file))).toBe(true);
  });

  it("quarantines a JSON-corrupt secrets.json and returns defaults", async () => {
    await writeFile(path.join(tempHome, "secrets.json"), "{not json", "utf-8");
    const { loadSecrets } = await loadState();

    expect(loadSecrets()).toEqual({ providers: {} });
    const files = await readdir(tempHome);
    expect(files.some((file) => /^secrets\.json\..+\.backup$/.test(file))).toBe(true);
  });

  it("merges config.json at per-provider field granularity so a concurrent change to a known provider survives persist", async () => {
    const { persistConfigMergedAsync, loadConfig, DEFAULT_SETTINGS } = await loadState();
    // Both instances carry all known provider ids (every load materializes them).
    // This instance only changed gemini; its openrouter entry is the pre-mutation
    // value it loaded — it did NOT touch openrouter.
    const previousProviders = loadConfig().providers;
    const inMemory = {
      settings: DEFAULT_SETTINGS,
      providers: previousProviders.map((provider) =>
        provider.provider === "gemini"
          ? { ...provider, hasApiKey: true, isActive: true }
          : { ...provider },
      ),
    };

    // Another instance activated the (known) openrouter provider on disk during
    // this window.
    const disk = loadConfig();
    await writeJson("config.json", {
      settings: DEFAULT_SETTINGS,
      providers: disk.providers.map((provider) =>
        provider.provider === "openrouter"
          ? { ...provider, hasApiKey: true, isActive: true, model: "or/model" }
          : { ...provider },
      ),
    });

    await persistConfigMergedAsync(inMemory, previousProviders, DEFAULT_SETTINGS);

    const persisted = await readJson<{
      providers: Array<{ provider: string; isActive: boolean; model?: string }>;
    }>(path.join(tempHome, "config.json"));
    // The concurrent openrouter activation — a KNOWN provider this instance did
    // not change — survives instead of being overwritten by the stale array.
    expect(persisted.providers.find((p) => p.provider === "openrouter")).toMatchObject({
      isActive: true,
      model: "or/model",
    });
    // This instance's gemini change still lands.
    expect(persisted.providers.find((p) => p.provider === "gemini")).toMatchObject({
      isActive: true,
    });
  });

  it("merges config.json settings at per-field granularity so a concurrent change to a different settings field survives persist", async () => {
    const { persistConfigMergedAsync, loadConfig, DEFAULT_SETTINGS } = await loadState();
    // This instance only changed `theme`; the pre-mutation snapshot is the
    // settings it loaded — it did NOT touch severityThreshold.
    const previousSettings = loadConfig().settings;
    const inMemory = {
      settings: { ...previousSettings, theme: "dark" as const },
      providers: loadConfig().providers,
    };

    // Another instance changed the (different) severityThreshold field on disk
    // during this window.
    await writeJson("config.json", {
      settings: { ...DEFAULT_SETTINGS, severityThreshold: "high" },
      providers: loadConfig().providers,
    });

    await persistConfigMergedAsync(inMemory, inMemory.providers, previousSettings);

    const persisted = await readJson<{
      settings: { theme: string; severityThreshold: string };
    }>(path.join(tempHome, "config.json"));
    // The concurrent severityThreshold change — a field this instance did not
    // touch — survives instead of being reverted by the stale settings object.
    expect(persisted.settings.severityThreshold).toBe("high");
    // This instance's theme change still lands.
    expect(persisted.settings.theme).toBe("dark");
  });

  it("merges trust.json at record granularity so an external trust record survives persist", async () => {
    const { persistTrustRecordAsync } = await loadState();
    // Another instance wrote proj-external during this instance's window.
    await writeJson("trust.json", {
      projects: {
        "proj-external": {
          projectId: "proj-external",
          repoRoot: "/projects/external",
          trustedAt: "2024-01-01T00:00:00.000Z",
          capabilities: { readFiles: true, runCommands: false },
          trustMode: "persistent",
        },
      },
    });

    await persistTrustRecordAsync({
      projectId: "proj-mine",
      repoRoot: "/projects/mine",
      trustedAt: "2024-01-02T00:00:00.000Z",
      capabilities: { readFiles: true, runCommands: false },
      trustMode: "persistent",
    });

    const persisted = await readJson<{ projects: Record<string, unknown> }>(
      path.join(tempHome, "trust.json"),
    );
    expect(Object.keys(persisted.projects).sort()).toEqual(["proj-external", "proj-mine"]);
  });

  it("validates trust records and drops invalid entries while preserving valid ones", async () => {
    await writeJson("trust.json", {
      projects: {
        "proj-1": {
          projectId: "proj-1",
          projectPath: "/proj-1",
          capabilities: null,
        },
        "proj-2": {
          projectId: "proj-2",
          repoRoot: "/proj-2",
          trustedAt: "2024-01-01T00:00:00.000Z",
          capabilities: { readFiles: true, runCommands: false },
          trustMode: "persistent",
        },
      },
    });
    const { loadTrust } = await loadState();

    const trust = loadTrust();
    // proj-1 is dropped because it lacks required fields (repoRoot, trustedAt, trustMode)
    expect(trust.projects["proj-1"]).toBeUndefined();
    // proj-2 is valid and preserved
    expect(trust.projects["proj-2"]).toMatchObject({
      capabilities: { readFiles: true, runCommands: false },
    });
  });

  it("quarantines malformed trust top-level data", async () => {
    await writeJson("trust.json", { projects: [] });
    const { loadTrust } = await loadState();

    expect(loadTrust()).toEqual({ projects: {} });
    const files = await readdir(tempHome);
    expect(files.some((file) => /^trust\.json\..+\.backup$/.test(file))).toBe(true);
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

  it("treats a moved project directory as a move: keeps the projectId, re-points repoRoot, and re-keys reviews", async () => {
    const { readProjectFile } = await loadState();
    const originalRoot = path.join(tempHome, "original-project");
    const movedRoot = path.join(tempHome, "moved-project");
    await mkdir(movedRoot, { recursive: true });
    await mkdir(path.join(movedRoot, ".diffgazer"), { recursive: true });
    await writeFile(
      path.join(movedRoot, ".diffgazer", "project.json"),
      JSON.stringify({
        projectId: "stable-id",
        repoRoot: originalRoot,
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
      "utf-8",
    );

    const moves: Array<[string, string]> = [];
    const result = readProjectFile(movedRoot, {
      onMove: (oldRoot, newRoot) => moves.push([oldRoot, newRoot]),
    });

    // projectId is preserved and repoRoot follows the move; no quarantine backup.
    expect(result).toMatchObject({ projectId: "stable-id", repoRoot: movedRoot });
    const files = await readdir(path.join(movedRoot, ".diffgazer"));
    expect(files.some((file) => /^project\.json\..+\.backup$/.test(file))).toBe(false);
    // The move is signalled so the caller can re-key stored review history.
    expect(moves).toEqual([[originalRoot, movedRoot]]);

    // The re-pointed file is persisted so the next read matches without a move.
    const reread = readProjectFile(movedRoot);
    expect(reread).toMatchObject({ projectId: "stable-id", repoRoot: movedRoot });
  });

  it("rejects reserved project IDs in project files and trust records", async () => {
    const projectRoot = path.join(tempHome, "reserved-project");
    await mkdir(path.join(projectRoot, ".diffgazer"), { recursive: true });
    await writeFile(
      path.join(projectRoot, ".diffgazer", "project.json"),
      JSON.stringify({
        projectId: "__proto__",
        repoRoot: projectRoot,
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
      "utf-8",
    );
    await writeJson("trust.json", {
      projects: {
        constructor: {
          projectId: "constructor",
          repoRoot: "/projects/one",
          trustedAt: "2024-01-01T00:00:00.000Z",
          capabilities: { readFiles: true, runCommands: false },
          trustMode: "persistent",
        },
        "proj-valid": {
          projectId: "proj-valid",
          repoRoot: "/projects/two",
          trustedAt: "2024-01-01T00:00:00.000Z",
          capabilities: { readFiles: true, runCommands: false },
          trustMode: "persistent",
        },
      },
    });
    const { readProjectFile, loadTrust } = await loadState();

    expect(readProjectFile(projectRoot)).toBeNull();
    expect(loadTrust().projects).toEqual({
      "proj-valid": expect.objectContaining({ projectId: "proj-valid" }),
    });
  });

  it("reads an existing project file or creates one under the project .diffgazer directory", async () => {
    const { createProjectFile } = await loadState();
    const projectRoot = path.join(tempHome, "project");
    const projectFile = path.join(projectRoot, ".diffgazer", "project.json");
    await mkdir(path.dirname(projectFile), { recursive: true });
    await writeFile(
      projectFile,
      JSON.stringify({
        projectId: "existing-id",
        repoRoot: projectRoot,
        createdAt: "2024-01-01",
      }),
      "utf-8",
    );

    expect(createProjectFile(projectRoot).projectId).toBe("existing-id");

    const newRoot = path.join(tempHome, "new-project");
    const created = createProjectFile(newRoot);
    expect(created).toMatchObject({ repoRoot: newRoot });
    await expect(readJson(path.join(newRoot, ".diffgazer", "project.json"))).resolves.toMatchObject(
      {
        projectId: created.projectId,
        repoRoot: newRoot,
      },
    );
  });
});
