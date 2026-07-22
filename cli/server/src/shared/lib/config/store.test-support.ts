import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { TrustConfig } from "@diffgazer/core/schemas/config";
import { afterEach, beforeEach, type Mock, vi } from "vitest";

type KeyringMocks = {
  deleteKeyringSecret: Mock;
  isKeyringAvailable: Mock;
  readKeyringSecret: Mock;
  writeKeyringSecret: Mock;
};

type CatalogMocks = { getProviderModels: Mock };

const { keyring, fsHooks, catalog } = vi.hoisted(() => ({
  keyring: {
    deleteKeyringSecret: vi.fn(),
    isKeyringAvailable: vi.fn(),
    readKeyringSecret: vi.fn(),
    writeKeyringSecret: vi.fn(),
  } as KeyringMocks,
  fsHooks: {
    removeFileSyncHook: null as ((filePath: string) => boolean) | null,
    writeJsonFileSyncHook: null as
      | ((filePath: string, data: unknown, mode?: number) => void)
      | null,
    writeJsonFileHook: null as
      | ((filePath: string, data: unknown, mode?: number) => Promise<void>)
      | null,
    getFileMtimeMsHook: null as ((filePath: string) => number | null) | null,
  },
  catalog: { getProviderModels: vi.fn() } as CatalogMocks,
}));

export { catalog, fsHooks, keyring };

vi.mock("./keyring.js", () => keyring);
vi.mock("../fs.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../fs.js")>();
  return {
    ...real,
    removeFileSync: (filePath: string) => {
      if (fsHooks.removeFileSyncHook) {
        return fsHooks.removeFileSyncHook(filePath);
      }
      return real.removeFileSync(filePath);
    },
    writeJsonFileSync: (filePath: string, data: unknown, mode?: number) => {
      if (fsHooks.writeJsonFileSyncHook) {
        return fsHooks.writeJsonFileSyncHook(filePath, data, mode);
      }
      return real.writeJsonFileSync(filePath, data, mode);
    },
    writeJsonFile: async (filePath: string, data: unknown, mode?: number) => {
      if (fsHooks.writeJsonFileHook) {
        return fsHooks.writeJsonFileHook(filePath, data, mode);
      }
      return real.writeJsonFile(filePath, data, mode);
    },
    getFileMtimeMs: (filePath: string) => {
      if (fsHooks.getFileMtimeMsHook) {
        return fsHooks.getFileMtimeMsHook(filePath);
      }
      return real.getFileMtimeMs(filePath);
    },
  };
});
vi.mock("../ai/models-dev-catalog.js", () => catalog);

export let diffgazerHome: string;

export const configPath = (): string => join(diffgazerHome, "config.json");
export const secretsPath = (): string => join(diffgazerHome, "secrets.json");
export const secretsRecoveryPath = (): string => `${secretsPath()}.recovery`;
export const trustPath = (): string => join(diffgazerHome, "trust.json");

export function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

export async function readJsonEventually<T>(filePath: string): Promise<T> {
  return vi.waitFor(
    () => {
      if (!existsSync(filePath)) throw new Error(`Expected ${filePath} to exist`);
      return readJson<T>(filePath);
    },
    { timeout: 1000, interval: 10 },
  );
}

export async function expectFileMissingEventually(filePath: string): Promise<void> {
  await vi.waitFor(
    () => {
      if (existsSync(filePath)) throw new Error(`Expected ${filePath} to be absent`);
    },
    { timeout: 1000, interval: 10 },
  );
}

export async function loadStore() {
  const { getStore } = await import("./store.js");
  return getStore();
}

export async function loadStoreFactory() {
  const { createConfigStore } = await import("./store.js");
  return createConfigStore;
}

export function trustConfig(overrides: Partial<TrustConfig> = {}): TrustConfig {
  return {
    projectId: "proj-1",
    repoRoot: "/projects/test",
    trustedAt: "2024-01-01T00:00:00.000Z",
    capabilities: { readFiles: true, runCommands: false },
    trustMode: "persistent",
    ...overrides,
  };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-store-"));
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
  fsHooks.removeFileSyncHook = null;
  fsHooks.writeJsonFileSyncHook = null;
  fsHooks.writeJsonFileHook = null;
  fsHooks.getFileMtimeMsHook = null;
  delete process.env.DIFFGAZER_HOME;
  rmSync(diffgazerHome, { recursive: true, force: true });
  warnSpy.mockRestore();
});
