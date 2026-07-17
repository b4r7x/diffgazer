import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TrustConfig } from "@diffgazer/core/schemas/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fsHooks = vi.hoisted(() => ({ failWrites: false }));

vi.mock("../fs.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../fs.js")>();
  return {
    ...actual,
    writeJsonFile: async (...args: Parameters<typeof actual.writeJsonFile>) => {
      if (fsHooks.failWrites) throw new Error("injected trust write failure");
      return actual.writeJsonFile(...args);
    },
  };
});

let diffgazerHome: string;

function trust(readFiles: boolean, trustMode: TrustConfig["trustMode"]): TrustConfig {
  return {
    projectId: "project-1",
    repoRoot: "/project",
    trustedAt: "2026-01-01T00:00:00.000Z",
    capabilities: { readFiles, runCommands: false },
    trustMode,
  };
}

beforeEach(() => {
  diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-trust-store-"));
  process.env.DIFFGAZER_HOME = diffgazerHome;
  fsHooks.failWrites = false;
});

afterEach(() => {
  delete process.env.DIFFGAZER_HOME;
  rmSync(diffgazerHome, { recursive: true, force: true });
});

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

    await expect(store.saveTrust(trust(sessionAccess, "session"))).resolves.toMatchObject({
      ok: true,
    });
    await expect(store.saveTrust(trust(persistentAccess, "persistent"))).resolves.toMatchObject({
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
    await store.saveTrust(trust(true, "session"));
    fsHooks.failWrites = true;

    await expect(store.saveTrust(trust(false, "persistent"))).resolves.toMatchObject({
      ok: false,
      error: { code: "PERSIST_FAILED" },
    });

    expect(store.getTrust("project-1")).toMatchObject({
      trustMode: "session",
      capabilities: { readFiles: true },
    });
  });
});
