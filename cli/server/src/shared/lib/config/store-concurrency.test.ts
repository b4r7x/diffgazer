import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { TrustConfig } from "@diffgazer/core/schemas/config";
import { describe, expect, it, vi } from "vitest";
import {
  catalog,
  configPath,
  diffgazerHome,
  expectFileMissingEventually,
  fsHooks,
  keyring,
  loadStore,
  loadStoreFactory,
  readJson,
  readJsonEventually,
  secretsPath,
  secretsRecoveryPath,
  trustConfig,
  trustPath,
  writeJson,
} from "./store.test-support.js";

describe("config store", () => {
  it("refreshes stale config before writing provider changes", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file", theme: "auto" },
      providers: [],
    });
    const createStore = await loadStoreFactory();
    const storeA = createStore();
    const storeB = createStore();

    await storeB.updateSettings({ theme: "dark" });
    await storeA.saveProviderCredentials({
      provider: "gemini",
      apiKey: "new-key",
      model: "gemini-2.5-flash",
    });

    expect(readJson<{ settings: { theme: string } }>(configPath())).toMatchObject({
      settings: { theme: "dark" },
    });
  });

  it("does not resurrect deleted secrets from stale in-memory state", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: false }],
    });
    writeJson(secretsPath(), { providers: { gemini: "existing-key" } });
    const createStore = await loadStoreFactory();
    const storeA = createStore();
    const storeB = createStore();

    await storeB.deleteProviderCredentials("gemini");
    await storeA.saveProviderCredentials({
      provider: "openrouter",
      apiKey: "new-key",
      model: "openrouter/model",
    });

    expect(readJson<{ providers: Record<string, string> }>(secretsPath())).toEqual({
      providers: { openrouter: "new-key" },
    });
  });

  it("serializes refresh through persist so a later explicit activation wins", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "file" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
        { provider: "openrouter", hasApiKey: true, isActive: false, model: "or/model" },
      ],
    });
    writeJson(secretsPath(), { providers: { gemini: "gemini-key", openrouter: "router-key" } });
    const createStore = await loadStoreFactory();
    const storeA = createStore();
    const storeB = createStore();

    let releaseFirstWrite = () => {};
    const firstWriteHeld = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    let reportFirstWrite = () => {};
    const firstWriteStarted = new Promise<void>((resolve) => {
      reportFirstWrite = resolve;
    });
    let configWriteCount = 0;
    fsHooks.writeJsonFileHook = async (filePath, data) => {
      if (filePath.endsWith("config.json")) {
        configWriteCount += 1;
        if (configWriteCount === 1) {
          reportFirstWrite();
          await firstWriteHeld;
        }
      }
      writeJson(filePath, data);
    };

    const activationB = storeB.activateProvider({ provider: "openrouter" });
    await firstWriteStarted;
    const activationA = storeA.activateProvider({ provider: "gemini" });
    releaseFirstWrite();
    const [resultA, resultB] = await Promise.all([activationA, activationB]);
    expect(resultA).toEqual({
      ok: true,
      value: expect.objectContaining({ provider: "gemini" }),
    });
    expect(resultB).toEqual({
      ok: true,
      value: expect.objectContaining({ provider: "openrouter" }),
    });

    let mtimeGeneration = 0;
    fsHooks.getFileMtimeMsHook = (filePath) => {
      if (!filePath.endsWith("config.json")) return null;
      mtimeGeneration += 1;
      return mtimeGeneration;
    };

    const persisted = readJson<{
      providers: Array<{ provider: string; isActive: boolean }>;
    }>(configPath());
    expect(persisted.providers.filter((provider) => provider.isActive)).toEqual([
      expect.objectContaining({ provider: "gemini" }),
    ]);
    expect(storeA.getActiveProvider()?.provider).toBe("gemini");
    expect(storeB.getActiveProvider()?.provider).toBe("gemini");
  });

  it("serializes concurrent mutators so the second sees the first's settled state", async () => {
    writeJson(configPath(), { settings: { theme: "auto" }, providers: [] });
    const store = await loadStore();

    const order: string[] = [];
    let releaseFirstWrite: () => void = () => {};
    const firstWriteHeld = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    let reportFirstWrite: () => void = () => {};
    const firstWriteStarted = new Promise<void>((resolve) => {
      reportFirstWrite = resolve;
    });

    let writeCount = 0;
    fsHooks.writeJsonFileHook = async (filePath, data) => {
      writeCount += 1;
      order.push(`write:${writeCount}`);
      // Hold only the first config write open to prove the second mutation queues.
      if (writeCount === 1) {
        reportFirstWrite();
        await firstWriteHeld;
      }
      writeJson(filePath, data);
    };

    const first = store.updateSettings({ theme: "dark" });
    const second = store.updateSettings({ severityThreshold: "high" });

    await firstWriteStarted;
    expect(order).toEqual(["write:1"]);

    releaseFirstWrite();
    await first;
    await second;

    expect(order).toEqual(["write:1", "write:2"]);
    expect(store.getSettings()).toMatchObject({ theme: "dark", severityThreshold: "high" });
  });

  it("serializes a held startup reconciliation before a newer credential save", async () => {
    writeJson(configPath(), {
      settings: { secretsStorage: "keyring" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    });
    writeJson(secretsPath(), {
      providers: {
        gemini: "stranded-literal-key",
        zai: { kind: "env", varName: "ZAI_API_KEY" },
      },
    });
    let keyringValue: string | null = null;
    keyring.readKeyringSecret.mockImplementation(() => ({ ok: true, value: keyringValue }));
    keyring.writeKeyringSecret.mockImplementation((_key: string, value: string) => {
      keyringValue = value;
      return { ok: true, value: undefined };
    });

    let releaseStartupWrite = () => {};
    const startupWriteHeld = new Promise<void>((resolve) => {
      releaseStartupWrite = resolve;
    });
    let secretsWriteCount = 0;
    fsHooks.writeJsonFileHook = async (filePath, data, mode) => {
      const { writeJsonFile } = await vi.importActual<typeof import("../fs.js")>("../fs.js");
      if (filePath === secretsPath()) {
        secretsWriteCount += 1;
        if (secretsWriteCount === 1) await startupWriteHeld;
      }
      await writeJsonFile(filePath, data, mode);
    };

    const store = await loadStore();
    await vi.waitFor(() => expect(secretsWriteCount).toBe(1));

    const save = store.saveProviderCredentials({
      provider: "gemini",
      apiKey: { kind: "env", varName: "GOOGLE_API_KEY" },
      model: "gemini-2.5-flash",
    });
    await Promise.resolve();
    expect(secretsWriteCount).toBe(1);

    releaseStartupWrite();
    await expect(save).resolves.toMatchObject({ ok: true });

    expect(readJson<{ providers: Record<string, unknown> }>(secretsPath()).providers).toMatchObject(
      {
        gemini: { kind: "env", varName: "GOOGLE_API_KEY" },
        zai: { kind: "env", varName: "ZAI_API_KEY" },
      },
    );
  });
});
