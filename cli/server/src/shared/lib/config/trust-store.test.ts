import { readFileSync } from "node:fs";
import type { TrustConfig } from "@diffgazer/core/schemas/config";
import { describe, expect, it, vi } from "vitest";
import {
  diffgazerHome,
  fsHooks,
  loadStore,
  loadStoreFactory,
  readJson,
  readJsonEventually,
  trustConfig,
  trustPath,
  writeJson,
} from "./store.test-support.js";

function isolatedTrust(readFiles: boolean, trustMode: TrustConfig["trustMode"]): TrustConfig {
  return {
    projectId: "project-1",
    repoRoot: "/project",
    trustedAt: "2026-01-01T00:00:00.000Z",
    capabilities: { readFiles, runCommands: false },
    trustMode,
  };
}

async function withTrustWriteFailure<T>(run: () => Promise<T>): Promise<T> {
  const { writeJsonFile } = await vi.importActual<typeof import("../fs.js")>("../fs.js");
  fsHooks.writeJsonFileHook = async (filePath, data, mode) => {
    if (filePath.endsWith("trust.json")) {
      throw new Error("injected trust write failure");
    }
    await writeJsonFile(filePath, data, mode);
  };
  try {
    return await run();
  } finally {
    fsHooks.writeJsonFileHook = null;
  }
}

describe("createTrustStore", () => {
  it.each([
    { sessionAccess: true, persistentAccess: false },
    { sessionAccess: false, persistentAccess: true },
  ])("replaces session readFiles=$sessionAccess with persistent readFiles=$persistentAccess", async ({
    sessionAccess,
    persistentAccess,
  }) => {
    const { createTrustStore } = await import("./trust-store.js");
    const store = createTrustStore();

    await expect(store.saveTrust(isolatedTrust(sessionAccess, "session"))).resolves.toMatchObject({
      ok: true,
    });
    await expect(
      store.saveTrust(isolatedTrust(persistentAccess, "persistent")),
    ).resolves.toMatchObject({
      ok: true,
    });

    expect(store.getTrust("project-1")).toMatchObject({
      trustMode: "persistent",
      capabilities: { readFiles: persistentAccess },
    });
    expect(createTrustStore().getTrust("project-1")).toMatchObject({
      trustMode: "persistent",
      capabilities: { readFiles: persistentAccess },
    });
  });

  it("retains session trust when the persistent write fails", async () => {
    const { createTrustStore } = await import("./trust-store.js");
    const store = createTrustStore();
    await store.saveTrust(isolatedTrust(true, "session"));

    await withTrustWriteFailure(async () => {
      await expect(store.saveTrust(isolatedTrust(false, "persistent"))).resolves.toMatchObject({
        ok: false,
        error: { code: "PERSIST_FAILED" },
      });
    });

    expect(store.getTrust("project-1")).toMatchObject({
      trustMode: "session",
      capabilities: { readFiles: true },
    });
  });
});

describe("config store trust", () => {
  it("saves, lists, and removes trust records", async () => {
    const store = await loadStore();
    const trust = trustConfig();

    expect(store.getTrust(trust.projectId)).toBeNull();
    await store.saveTrust(trust);

    expect(store.getTrust(trust.projectId)).toEqual(trust);
    expect(store.listTrustedProjects()).toEqual([trust]);
    await expect(
      readJsonEventually<{ projects: Record<string, TrustConfig> }>(trustPath()),
    ).resolves.toMatchObject({ projects: { [trust.projectId]: trust } });

    const removeResult1 = await store.removeTrust(trust.projectId);
    expect(removeResult1).toMatchObject({ ok: true, value: true });
    const removeResult2 = await store.removeTrust(trust.projectId);
    expect(removeResult2).toMatchObject({ ok: true, value: false });
    expect(store.getTrust(trust.projectId)).toBeNull();
  });

  it("does not resurrect revoked trust from stale in-memory state", async () => {
    const createStore = await loadStoreFactory();
    const storeA = createStore();
    const storeB = createStore();

    await storeA.saveTrust(trustConfig({ projectId: "proj-1", repoRoot: "/projects/one" }));
    await storeB.removeTrust("proj-1");
    await storeA.saveTrust(trustConfig({ projectId: "proj-2", repoRoot: "/projects/two" }));

    expect(readJson<{ projects: Record<string, TrustConfig> }>(trustPath())).toEqual({
      projects: {
        "proj-2": trustConfig({ projectId: "proj-2", repoRoot: "/projects/two" }),
      },
    });
    expect(storeA.getTrust("proj-1")).toBeNull();
  });

  it("preserves newer trust records when another store writes later", async () => {
    const createStore = await loadStoreFactory();
    const storeA = createStore();
    const storeB = createStore();

    await storeB.saveTrust(trustConfig({ projectId: "proj-2", repoRoot: "/projects/two" }));
    await storeA.saveTrust(trustConfig({ projectId: "proj-1", repoRoot: "/projects/one" }));

    expect(readJson<{ projects: Record<string, TrustConfig> }>(trustPath())).toMatchObject({
      projects: {
        "proj-1": trustConfig({ projectId: "proj-1", repoRoot: "/projects/one" }),
        "proj-2": trustConfig({ projectId: "proj-2", repoRoot: "/projects/two" }),
      },
    });
  });

  it("rolls back saveTrust when trust persistence fails", async () => {
    const store = await loadStore();
    fsHooks.writeJsonFileHook = async (filePath) => {
      if (filePath.endsWith("trust.json")) {
        throw new Error("Injected trust.json write failure");
      }
    };

    const result = await store.saveTrust(trustConfig());

    expect(result).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
    expect(store.getTrust("proj-1")).toBeNull();
    fsHooks.writeJsonFileHook = null;
  });

  it("clears the persistent trust record when a project is downgraded to session trust", async () => {
    const createStore = await loadStoreFactory();
    const storeA = createStore();

    await storeA.saveTrust(trustConfig({ trustMode: "persistent" }));
    expect(
      readJson<{ projects: Record<string, TrustConfig> }>(trustPath()).projects["proj-1"],
    ).toMatchObject({ trustMode: "persistent" });

    const downgrade = await storeA.saveTrust(trustConfig({ trustMode: "session" }));
    expect(downgrade).toMatchObject({ ok: true, value: { trustMode: "session" } });

    expect(storeA.getTrust("proj-1")).toMatchObject({ trustMode: "session" });
    expect(
      readJson<{ projects: Record<string, TrustConfig> }>(trustPath()).projects["proj-1"],
    ).toBeUndefined();

    const storeB = createStore();
    expect(storeB.getTrust("proj-1")).toBeNull();
  });

  it("leaves no session grant applied when a downgrade's persistent removal fails", async () => {
    const createStore = await loadStoreFactory();
    const store = createStore();

    await store.saveTrust(trustConfig({ trustMode: "persistent" }));

    fsHooks.writeJsonFileHook = async (filePath) => {
      if (filePath.endsWith("trust.json")) {
        throw new Error("EACCES: permission denied");
      }
    };

    const downgrade = await store.saveTrust(trustConfig({ trustMode: "session" }));
    fsHooks.writeJsonFileHook = null;

    expect(downgrade.ok).toBe(false);
    expect(store.getTrust("proj-1")).toMatchObject({ trustMode: "persistent" });
    expect(
      readJson<{ projects: Record<string, TrustConfig> }>(trustPath()).projects["proj-1"],
    ).toMatchObject({ trustMode: "persistent" });
  });

  it("keeps session precedence until a shadowed persistent removal finishes", async () => {
    const createStore = await loadStoreFactory();
    const storeA = createStore();
    const storeB = createStore();
    const sessionGrant = trustConfig({
      trustMode: "session",
      capabilities: { readFiles: true, runCommands: false },
    });
    const persistentGrant = trustConfig({
      trustMode: "persistent",
      capabilities: { readFiles: true, runCommands: true },
    });

    await storeA.saveTrust(sessionGrant);
    await storeB.saveTrust(persistentGrant);

    let releaseWrite = (): void => {};
    const writeHeld = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    let reportWriteStarted = (): void => {};
    const writeStarted = new Promise<void>((resolve) => {
      reportWriteStarted = resolve;
    });
    fsHooks.writeJsonFileHook = async (filePath, data) => {
      if (filePath.endsWith("trust.json")) {
        reportWriteStarted();
        await writeHeld;
      }
      writeJson(filePath, data);
    };

    try {
      const removal = storeA.removeTrust(sessionGrant.projectId);
      await writeStarted;

      expect(storeA.getTrust(sessionGrant.projectId)).toEqual(sessionGrant);

      releaseWrite();
      await expect(removal).resolves.toEqual({ ok: true, value: true });
      expect(storeA.getTrust(sessionGrant.projectId)).toBeNull();
    } finally {
      releaseWrite();
      fsHooks.writeJsonFileHook = null;
    }
  });

  it("conserves disk and session trust when another store's persistent grant cannot be removed", async () => {
    const createStore = await loadStoreFactory();
    const storeA = createStore();
    const storeB = createStore();
    const sessionGrant = trustConfig({
      trustMode: "session",
      capabilities: { readFiles: true, runCommands: false },
    });
    const persistentGrant = trustConfig({
      trustMode: "persistent",
      capabilities: { readFiles: true, runCommands: true },
    });

    await storeA.saveTrust(sessionGrant);
    await storeB.saveTrust(persistentGrant);
    expect(storeA.getTrust(sessionGrant.projectId)).toEqual(sessionGrant);
    const diskBefore = readFileSync(trustPath(), "utf8");

    fsHooks.writeJsonFileHook = async (filePath) => {
      if (filePath.endsWith("trust.json")) {
        throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
      }
    };

    try {
      const result = await storeA.removeTrust(sessionGrant.projectId);

      expect(result).toMatchObject({ ok: false, error: { code: "PERSIST_FAILED" } });
      expect(storeA.getTrust(sessionGrant.projectId)).toEqual(sessionGrant);
      expect(readFileSync(trustPath(), "utf8")).toBe(diskBefore);
      expect(storeB.getTrust(sessionGrant.projectId)).toEqual(persistentGrant);
    } finally {
      fsHooks.writeJsonFileHook = null;
    }
  });

  it("scrubs the absolute trust path from client-facing persist errors", async () => {
    const store = await loadStore();
    fsHooks.writeJsonFileHook = async (filePath) => {
      if (filePath.endsWith("trust.json")) {
        throw new Error(`EACCES: permission denied, open '${trustPath()}'`);
      }
    };

    const result = await store.saveTrust(trustConfig());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("PERSIST_FAILED");
    expect(result.error.message).toBe("Failed to persist trust");
    expect(result.error.message).not.toContain(diffgazerHome);
    expect(result.error.message).not.toContain("trust.json");
    fsHooks.writeJsonFileHook = null;
  });
});
