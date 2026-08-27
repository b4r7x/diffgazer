import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { TrustConfig } from "@diffgazer/core/schemas/config";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { assertTempHome } from "../testing/temp-home.js";
import type { ConfigStore } from "./store.js";

type KeyringMocks = {
  deleteKeyringSecret: Mock;
  isKeyringAvailable: Mock;
  readKeyringSecret: Mock;
  writeKeyringSecret: Mock;
};

type CatalogMocks = { discoverConfigurationCatalog: Mock };

const { keyring, fsHooks, catalog } = vi.hoisted(() => ({
  keyring: {
    deleteKeyringSecret: vi.fn(),
    isKeyringAvailable: vi.fn(),
    readKeyringSecret: vi.fn(),
    writeKeyringSecret: vi.fn(),
  } as KeyringMocks,
  fsHooks: {
    removeFileSyncHook: null as ((filePath: string) => boolean) | null,
    removeFileSyncDurableHook: null as ((filePath: string) => boolean) | null,
    writeJsonFileSyncHook: null as
      | ((filePath: string, data: unknown, mode?: number) => void)
      | null,
    writeJsonFileHook: null as
      | ((filePath: string, data: unknown, mode?: number) => Promise<void>)
      | null,
    getFileMtimeMsHook: null as ((filePath: string) => number | null) | null,
    atomicWriteFileHook: null as
      | ((filePath: string, content: string | Uint8Array, mode?: number) => Promise<void>)
      | null,
  },
  catalog: {
    discoverConfigurationCatalog: vi.fn(),
  } as CatalogMocks,
}));

export { catalog, fsHooks, keyring };

vi.mock("./keyring.js", () => keyring);
vi.mock("../fs.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../fs.js")>();
  return {
    ...real,
    removeFileSync: (filePath: string) => {
      if (fsHooks.removeFileSyncHook) {
        const handled = fsHooks.removeFileSyncHook(filePath);
        if (handled) return true;
      }
      return real.removeFileSync(filePath);
    },
    removeFileSyncDurable: (filePath: string) => {
      if (fsHooks.removeFileSyncDurableHook) {
        const handled = fsHooks.removeFileSyncDurableHook(filePath);
        if (handled) return true;
      }
      return real.removeFileSyncDurable(filePath);
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
    atomicWriteFile: async (filePath: string, content: string | Uint8Array, mode?: number) => {
      if (fsHooks.atomicWriteFileHook) {
        return fsHooks.atomicWriteFileHook(filePath, content, mode);
      }
      return real.atomicWriteFile(filePath, content, mode);
    },
  };
});
vi.mock("../ai/models-dev-catalog.js", () => catalog);

export let diffgazerHome: string;

export const configPath = (): string => join(diffgazerHome, "config.json");
export const secretsPath = (): string => join(diffgazerHome, "secrets.json");
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

// Deletion fails closed without a lease authority, so tests install the same
// process-wide one the composition root installs.
async function installConfigurationLeaseHooks(): Promise<void> {
  const { registerConfigSeams } = await import("./seams.js");
  const { createConfigurationLeaseHooks } = await import("../session-registry.js");
  registerConfigSeams({ leaseHooks: createConfigurationLeaseHooks() });
}

// Retained so teardown can drain each store's queued work before the temp home is
// removed and DIFFGAZER_HOME is dropped.
const loadedStores = new Set<ConfigStore>();

export async function loadStore(): Promise<ConfigStore> {
  const { getStore } = await import("./store.js");
  await installConfigurationLeaseHooks();
  const store = getStore();
  loadedStores.add(store);
  return store;
}

export async function loadStoreFactory(): Promise<() => ConfigStore> {
  const { createConfigStore } = await import("./store.js");
  await installConfigurationLeaseHooks();
  return () => {
    const store = createConfigStore();
    loadedStores.add(store);
    return store;
  };
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
  loadedStores.clear();
  diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-store-"));
  assertTempHome(diffgazerHome);
  process.env.DIFFGAZER_HOME = diffgazerHome;
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.resetModules();
  vi.clearAllMocks();
  keyring.isKeyringAvailable.mockReturnValue(true);
  keyring.readKeyringSecret.mockReturnValue({ ok: true, value: null });
  keyring.writeKeyringSecret.mockReturnValue({ ok: true, value: undefined });
  keyring.deleteKeyringSecret.mockReturnValue({ ok: true, value: false });
});

// Order matters: injected fs failures are lifted first so the drain can settle, then
// every store's queued work is awaited, then the temp home is removed. Only after that
// may DIFFGAZER_HOME be dropped — `paths.ts` re-reads it per call, so restoring it while
// work is still pending re-points that work at the real ~/.diffgazer.
afterEach(async () => {
  fsHooks.removeFileSyncHook = null;
  fsHooks.removeFileSyncDurableHook = null;
  fsHooks.writeJsonFileSyncHook = null;
  fsHooks.writeJsonFileHook = null;
  fsHooks.getFileMtimeMsHook = null;
  fsHooks.atomicWriteFileHook = null;
  try {
    for (const store of loadedStores) await store.ready();
    rmSync(diffgazerHome, { recursive: true, force: true });
  } finally {
    loadedStores.clear();
    delete process.env.DIFFGAZER_HOME;
    warnSpy.mockRestore();
  }
});
