import { type ChildProcess, spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tempHome: string;

const fsHooks = vi.hoisted(() => ({
  writeJsonFileHook: null as
    | ((filePath: string, data: unknown, mode?: number) => Promise<void>)
    | null,
}));

vi.mock("../fs.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../fs.js")>();
  return {
    ...real,
    writeJsonFile: (filePath: string, data: unknown, mode?: number) =>
      fsHooks.writeJsonFileHook
        ? fsHooks.writeJsonFileHook(filePath, data, mode)
        : real.writeJsonFile(filePath, data, mode),
  };
});

const persistenceModuleUrl = new URL("./persistence.ts", import.meta.url).href;

const persistenceWorker = `
import { access, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
const persistence = await import(process.env.PERSISTENCE_MODULE_URL);
const id = process.env.WORKER_ID;
let operation;
if (process.env.MODE === "config") {
  const previous = persistence.loadConfig();
  const settings = id === "a"
    ? { ...previous.settings, theme: "dark" }
    : { ...previous.settings, severityThreshold: "high" };
  operation = () => persistence.persistConfigMergedAsync(
    { ...previous, settings },
    previous.providers,
    previous.settings,
  );
} else if (process.env.MODE === "secrets") {
  const provider = id === "a" ? "gemini" : "groq";
  operation = () => persistence.persistSecretsAsync({ providers: { [provider]: id + "-key" } });
} else {
  const projectId = "project-" + id;
  operation = () => persistence.persistTrustRecordAsync({
    projectId,
    repoRoot: "/projects/" + id,
    trustedAt: "2026-01-01T00:00:00.000Z",
    capabilities: { readFiles: true, runCommands: false },
    trustMode: "persistent",
  });
}
await writeFile(process.env.READY_PATH, "ready");
while (true) {
  try {
    await access(process.env.START_PATH);
    break;
  } catch {
    await delay(5);
  }
}
await operation();
`;

const waitForPaths = async (filePaths: string[]): Promise<void> => {
  const deadline = Date.now() + 5_000;
  while (true) {
    try {
      await Promise.all(filePaths.map((filePath) => access(filePath)));
      return;
    } catch {
      if (Date.now() >= deadline) throw new Error("Timed out waiting for persistence workers");
      await delay(10);
    }
  }
};

const waitForExit = (child: ChildProcess): Promise<{ code: number | null; stderr: string }> =>
  new Promise((resolve, reject) => {
    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stderr }));
  });

const runProcessRace = async (mode: "config" | "secrets" | "trust"): Promise<void> => {
  const barrier = path.join(tempHome, `barrier-${mode}`);
  await mkdir(barrier);
  const startPath = path.join(barrier, "start");
  const children = ["a", "b"].map((id) =>
    spawn(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", persistenceWorker],
      {
        env: {
          ...process.env,
          DIFFGAZER_HOME: tempHome,
          MODE: mode,
          PERSISTENCE_MODULE_URL: persistenceModuleUrl,
          READY_PATH: path.join(barrier, `${id}.ready`),
          START_PATH: startPath,
          WORKER_ID: id,
        },
        stdio: ["ignore", "ignore", "pipe"],
      },
    ),
  );
  const exits = children.map(waitForExit);

  try {
    await waitForPaths(
      children.map((_, index) => path.join(barrier, `${index === 0 ? "a" : "b"}.ready`)),
    );
    await writeFile(startPath, "start");
    const results = await Promise.all(exits);
    expect(results).toEqual([
      { code: 0, stderr: "" },
      { code: 0, stderr: "" },
    ]);
  } finally {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
    await Promise.allSettled(exits);
  }
};

beforeEach(async () => {
  tempHome = await mkdtemp(path.join(tmpdir(), "diffgazer-state-"));
  process.env.DIFFGAZER_HOME = tempHome;
  fsHooks.writeJsonFileHook = null;
  vi.resetModules();
});

afterEach(async () => {
  fsHooks.writeJsonFileHook = null;
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

  it("keeps empty literals opaque while preserving whitespace around a nonempty literal", async () => {
    await writeJson("secrets.json", {
      providers: {
        gemini: "",
        groq: "   ",
        openrouter: "  key-with-padding  ",
      },
    });
    const { loadSecrets, persistSecrets } = await loadState();

    const secrets = loadSecrets();

    expect(secrets).toEqual({
      providers: { openrouter: "  key-with-padding  " },
      unknownSecrets: { gemini: "", groq: "   " },
    });
    persistSecrets(secrets);
    await expect(
      readJson<{ providers: Record<string, unknown> }>(path.join(tempHome, "secrets.json")),
    ).resolves.toEqual({
      providers: {
        gemini: "",
        groq: "   ",
        openrouter: "  key-with-padding  ",
      },
    });
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

  it("loads only provider-owned env refs and preserves foreign records opaquely", async () => {
    const foreignOpenRouterRef = { kind: "env", varName: "AWS_SECRET_ACCESS_KEY" };
    const futureProviderRef = { kind: "env", varName: "FUTURE_PROVIDER_API_KEY" };
    const futureEnvRef = {
      kind: "env",
      varName: "GROQ_API_KEY",
      source: "future-secret-store",
    };
    await writeJson("secrets.json", {
      providers: {
        gemini: { kind: "env", varName: "GOOGLE_API_KEY" },
        groq: futureEnvRef,
        openrouter: foreignOpenRouterRef,
        "future-provider": futureProviderRef,
      },
    });
    const { loadSecrets, persistSecrets } = await loadState();

    const secrets = loadSecrets();

    expect(secrets).toEqual({
      providers: {
        gemini: { kind: "env", varName: "GOOGLE_API_KEY" },
      },
      unknownSecrets: {
        groq: futureEnvRef,
        openrouter: foreignOpenRouterRef,
        "future-provider": futureProviderRef,
      },
    });

    persistSecrets(secrets);
    await expect(
      readJson<{ providers: Record<string, unknown> }>(path.join(tempHome, "secrets.json")),
    ).resolves.toEqual({
      providers: {
        groq: futureEnvRef,
        openrouter: foreignOpenRouterRef,
        "future-provider": futureProviderRef,
        gemini: { kind: "env", varName: "GOOGLE_API_KEY" },
      },
    });
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

  it.each([
    { fileName: "config.json", invalidRoot: null, label: "null config root" },
    { fileName: "config.json", invalidRoot: ["invalid"], label: "array config root" },
    { fileName: "secrets.json", invalidRoot: null, label: "null secrets root" },
    { fileName: "secrets.json", invalidRoot: ["invalid"], label: "array secrets root" },
  ])("quarantines a $label and preserves its backup after a normal persist", async ({
    fileName,
    invalidRoot,
  }) => {
    await writeJson(fileName, invalidRoot);
    const filePath = path.join(tempHome, fileName);
    const original = await readFile(filePath, "utf-8");
    const persistence = await loadState();

    if (fileName === "config.json") {
      const state = persistence.loadConfig();
      persistence.persistConfig(state);
    } else {
      const state = persistence.loadSecrets();
      persistence.persistSecrets(state);
    }

    const backupName = (await readdir(tempHome)).find((candidate) =>
      new RegExp(`^${fileName.replace(".", "\\.")}\\..+\\.backup$`).test(candidate),
    );
    expect(backupName).toBeDefined();
    if (!backupName) return;
    await expect(readFile(path.join(tempHome, backupName), "utf-8")).resolves.toBe(original);
    await expect(readFile(filePath, "utf-8")).resolves.not.toBe(original);
  });

  it("rejects a transaction writer used after its callback settles without changing config", async () => {
    const { loadConfig, withConfigFileTransaction, DEFAULT_SETTINGS } = await loadState();
    await writeJson("config.json", {
      settings: DEFAULT_SETTINGS,
      providers: loadConfig().providers,
    });
    const previous = loadConfig();
    const before = await readFile(path.join(tempHome, "config.json"), "utf8");
    const escapedWriter = await withConfigFileTransaction(async (persistMerged) => persistMerged);

    await expect(
      escapedWriter(
        { ...previous, settings: { ...previous.settings, theme: "dark" } },
        previous.providers,
        previous.settings,
      ),
    ).rejects.toThrow("Config transaction writer lease expired");
    await expect(readFile(path.join(tempHome, "config.json"), "utf8")).resolves.toBe(before);
  });

  it("keeps the config lock until an unawaited in-flight writer settles", async () => {
    const { loadConfig, withConfigFileTransaction, DEFAULT_SETTINGS } = await loadState();
    await writeJson("config.json", {
      settings: DEFAULT_SETTINGS,
      providers: loadConfig().providers,
    });
    const previous = loadConfig();
    const writeStarted = createDeferred<void>();
    const releaseWrite = createDeferred<void>();
    const contenderEntered = createDeferred<void>();
    const realFs = await vi.importActual<typeof import("../fs.js")>("../fs.js");
    fsHooks.writeJsonFileHook = async (filePath, data, mode) => {
      if (filePath.endsWith("config.json")) {
        writeStarted.resolve(undefined);
        await releaseWrite.promise;
      }
      await realFs.writeJsonFile(filePath, data, mode);
    };

    let unawaitedWrite = Promise.resolve<unknown>(undefined);
    const firstTransaction = withConfigFileTransaction(async (persistMerged) => {
      unawaitedWrite = persistMerged(
        { ...previous, settings: { ...previous.settings, theme: "dark" } },
        previous.providers,
        previous.settings,
      );
    });
    await writeStarted.promise;

    const contender = withConfigFileTransaction(async () => {
      contenderEntered.resolve(undefined);
    });
    const earlyOutcome = await Promise.race([
      contenderEntered.promise.then(() => "entered" as const),
      delay(100).then(() => "blocked" as const),
    ]);

    releaseWrite.resolve(undefined);
    await Promise.all([firstTransaction, unawaitedWrite, contender]);
    expect(earlyOutcome).toBe("blocked");
  });

  it("treats a changed active provider as one aggregate choice during merge", async () => {
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
    // The model written by the other instance survives, but its stale active bit
    // yields to this transaction's aggregate provider selection.
    expect(persisted.providers.find((p) => p.provider === "openrouter")).toMatchObject({
      isActive: false,
      model: "or/model",
    });
    expect(persisted.providers.find((p) => p.provider === "gemini")).toMatchObject({
      isActive: true,
    });
    expect(persisted.providers.filter((provider) => provider.isActive)).toHaveLength(1);
  });

  it("keeps a concurrent active-provider choice while merging an unrelated model update", async () => {
    const { persistConfigMergedAsync, loadConfig, DEFAULT_SETTINGS } = await loadState();
    await writeJson("config.json", {
      settings: DEFAULT_SETTINGS,
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "old-model" },
        { provider: "openrouter", hasApiKey: true, isActive: false, model: "or/model" },
      ],
    });
    const previousProviders = loadConfig().providers;
    const inMemory = {
      settings: DEFAULT_SETTINGS,
      providers: previousProviders.map((provider) =>
        provider.provider === "gemini" ? { ...provider, model: "new-model" } : { ...provider },
      ),
    };

    await writeJson("config.json", {
      settings: DEFAULT_SETTINGS,
      providers: previousProviders.map((provider) => ({
        ...provider,
        isActive: provider.provider === "openrouter",
      })),
    });

    await persistConfigMergedAsync(inMemory, previousProviders, DEFAULT_SETTINGS);

    const persisted = await readJson<{
      providers: Array<{ provider: string; isActive: boolean; model?: string }>;
    }>(path.join(tempHome, "config.json"));
    expect(persisted.providers.find((provider) => provider.provider === "gemini")).toMatchObject({
      isActive: false,
      model: "new-model",
    });
    expect(persisted.providers.filter((provider) => provider.isActive)).toEqual([
      expect.objectContaining({ provider: "openrouter" }),
    ]);
  });

  it("repairs multiple active providers while loading legacy config", async () => {
    const { loadConfig, DEFAULT_SETTINGS } = await loadState();
    await writeJson("config.json", {
      settings: DEFAULT_SETTINGS,
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-model" },
        { provider: "openrouter", hasApiKey: true, isActive: true, model: "openrouter-model" },
      ],
    });

    const loaded = loadConfig();

    expect(loaded.providers.filter((provider) => provider.isActive)).toHaveLength(1);
    expect(loaded.providers.find((provider) => provider.isActive)?.provider).toBe("gemini");
  });

  it("normalizes opaque and known active rows without losing opaque fields", async () => {
    const { loadConfig, persistConfig, DEFAULT_SETTINGS } = await loadState();
    await writeJson("config.json", {
      settings: DEFAULT_SETTINGS,
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-model" },
        {
          provider: "future-provider",
          hasApiKey: true,
          isActive: true,
          model: "future-model",
          futureMetadata: { revision: 2 },
        },
      ],
    });

    const loaded = loadConfig();
    expect(loaded.unknownProviders).toEqual([
      {
        provider: "future-provider",
        hasApiKey: true,
        isActive: false,
        model: "future-model",
        futureMetadata: { revision: 2 },
      },
    ]);
    persistConfig(loaded);

    const persisted = await readJson<{
      providers: Array<Record<string, unknown> & { isActive?: boolean }>;
    }>(path.join(tempHome, "config.json"));
    expect(persisted.providers.filter((provider) => provider.isActive)).toHaveLength(1);
    expect(persisted.providers.find((provider) => provider.provider === "future-provider")).toEqual(
      {
        provider: "future-provider",
        hasApiKey: true,
        isActive: false,
        model: "future-model",
        futureMetadata: { revision: 2 },
      },
    );
  });

  it("deactivates an opaque selection when this transaction activates a known provider", async () => {
    const { loadConfig, persistConfigMergedAsync, DEFAULT_SETTINGS } = await loadState();
    await writeJson("config.json", {
      settings: DEFAULT_SETTINGS,
      providers: [
        {
          provider: "future-provider",
          hasApiKey: true,
          isActive: true,
          futureMetadata: { revision: 2 },
        },
      ],
    });
    const previous = loadConfig();
    const state = {
      ...previous,
      providers: previous.providers.map((provider) => ({
        ...provider,
        isActive: provider.provider === "gemini",
      })),
    };

    await persistConfigMergedAsync(state, previous.providers, previous.settings);

    const persisted = await readJson<{
      providers: Array<Record<string, unknown> & { isActive?: boolean }>;
    }>(path.join(tempHome, "config.json"));
    expect(persisted.providers.filter((provider) => provider.isActive)).toEqual([
      expect.objectContaining({ provider: "gemini" }),
    ]);
    expect(persisted.providers.find((provider) => provider.provider === "future-provider")).toEqual(
      {
        provider: "future-provider",
        hasApiKey: true,
        isActive: false,
        futureMetadata: { revision: 2 },
      },
    );
  });

  it("refuses to persist active known and opaque providers together", async () => {
    const { persistConfig, DEFAULT_SETTINGS } = await loadState();

    expect(() =>
      persistConfig({
        settings: DEFAULT_SETTINGS,
        providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
        unknownProviders: [
          { provider: "future-provider", hasApiKey: true, isActive: true, futureField: 1 },
        ],
      }),
    ).toThrow("Config cannot persist more than one active provider");
  });

  it("canonicalizes default lenses at the persistence boundary and rejects an empty list", async () => {
    const { persistConfig, DEFAULT_SETTINGS } = await loadState();
    const providers = [{ provider: "gemini" as const, hasApiKey: false, isActive: false }];

    persistConfig({
      settings: {
        ...DEFAULT_SETTINGS,
        defaultLenses: ["security", "correctness", "security", "tests", "correctness"],
      },
      providers,
    });

    const persisted = await readJson<{ settings: { defaultLenses: string[] } }>(
      path.join(tempHome, "config.json"),
    );
    expect(persisted.settings.defaultLenses).toEqual(["security", "correctness", "tests"]);

    expect(() =>
      persistConfig({
        settings: { ...DEFAULT_SETTINGS, defaultLenses: [] },
        providers,
      }),
    ).toThrow();
  });

  it("repairs an empty persisted default lens list with the non-empty default", async () => {
    const { loadConfig, DEFAULT_SETTINGS } = await loadState();
    await writeJson("config.json", {
      settings: { ...DEFAULT_SETTINGS, defaultLenses: [] },
      providers: [],
    });

    expect(loadConfig().settings.defaultLenses).toEqual(DEFAULT_SETTINGS.defaultLenses);
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

  it("preserves disjoint config, secrets, and trust writes from independent processes", async () => {
    await runProcessRace("config");
    await runProcessRace("secrets");
    await runProcessRace("trust");

    const config = await readJson<{
      settings: { theme: string; severityThreshold: string };
    }>(path.join(tempHome, "config.json"));
    expect(config.settings).toMatchObject({ theme: "dark", severityThreshold: "high" });

    const secrets = await readJson<{ providers: Record<string, string> }>(
      path.join(tempHome, "secrets.json"),
    );
    expect(secrets.providers).toEqual({ gemini: "a-key", groq: "b-key" });

    const trust = await readJson<{ projects: Record<string, unknown> }>(
      path.join(tempHome, "trust.json"),
    );
    expect(Object.keys(trust.projects).sort()).toEqual(["project-a", "project-b"]);
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
      onMove: async (oldRoot, newRoot) => {
        moves.push([oldRoot, newRoot]);
        return true;
      },
    });

    // projectId is preserved and repoRoot follows the move; no quarantine backup.
    expect(result).toMatchObject({ projectId: "stable-id", repoRoot: movedRoot });
    const files = await readdir(path.join(movedRoot, ".diffgazer"));
    expect(files.some((file) => /^project\.json\..+\.backup$/.test(file))).toBe(false);
    // The move is signalled so the caller can re-key stored review history.
    expect(moves).toEqual([[originalRoot, movedRoot]]);

    // The re-pointed file is persisted so the next read matches without a move.
    await vi.waitFor(() => {
      const reread = readProjectFile(movedRoot);
      expect(reread).toMatchObject({ projectId: "stable-id", repoRoot: movedRoot });
    });
  });

  it("keeps the old project root durable until a failed move callback later succeeds", async () => {
    const { readProjectFile } = await loadState();
    const originalRoot = path.join(tempHome, "retry-original-project");
    const movedRoot = path.join(tempHome, "retry-moved-project");
    const projectFilePath = path.join(movedRoot, ".diffgazer", "project.json");
    await mkdir(path.dirname(projectFilePath), { recursive: true });
    await writeFile(
      projectFilePath,
      JSON.stringify({
        projectId: "stable-retry-id",
        repoRoot: originalRoot,
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
      "utf-8",
    );
    let shouldComplete = false;
    const onMove = vi.fn(async () => shouldComplete);

    readProjectFile(movedRoot, { onMove });
    await vi.waitFor(() => expect(onMove).toHaveBeenCalledOnce());
    await new Promise((resolve) => setImmediate(resolve));
    await expect(readJson<{ repoRoot: string }>(projectFilePath)).resolves.toMatchObject({
      repoRoot: originalRoot,
    });

    shouldComplete = true;
    await vi.waitFor(() => {
      readProjectFile(movedRoot, { onMove });
      expect(onMove).toHaveBeenCalledTimes(2);
    });
    await vi.waitFor(async () => {
      await expect(readJson<{ repoRoot: string }>(projectFilePath)).resolves.toMatchObject({
        repoRoot: movedRoot,
      });
    });
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
