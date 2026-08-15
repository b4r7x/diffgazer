import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  diffgazerHome,
  loadStore,
  loadStoreFactory,
  readJson,
  trustConfig,
  trustPath,
} from "./store.test-support.js";

describe("config store", () => {
  it("re-keys review history when a trusted project directory is moved", async () => {
    const createConfigStore = await loadStoreFactory();
    const { registerConfigSeams, resetConfigSeams } = await import("./seams.js");
    const rekeys: Array<[string, string]> = [];
    let shouldComplete = false;
    registerConfigSeams({
      reviewRekeyHandler: async (oldPath, newPath) => {
        rekeys.push([oldPath, newPath]);
        return shouldComplete;
      },
    });

    const originalRoot = join(diffgazerHome, "original");
    const movedRoot = join(diffgazerHome, "moved");
    mkdirSync(join(movedRoot, ".diffgazer"), { recursive: true });
    // A .git dir makes the path an allowed project root.
    mkdirSync(join(movedRoot, ".git"), { recursive: true });
    writeFileSync(
      join(movedRoot, ".diffgazer", "project.json"),
      JSON.stringify({
        projectId: "stable-id",
        repoRoot: originalRoot,
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
    );

    try {
      const store = createConfigStore();
      const info = store.ensureProjectFile(movedRoot);

      expect(info.projectId).toBe("stable-id");
      await vi.waitFor(() => expect(rekeys).toHaveLength(1));
      expect(rekeys[0]?.[1]).toContain("moved");
      expect(
        JSON.parse(readFileSync(join(movedRoot, ".diffgazer", "project.json"), "utf-8")),
      ).toMatchObject({ repoRoot: originalRoot });

      shouldComplete = true;
      await vi.waitFor(() => {
        store.ensureProjectFile(movedRoot);
        expect(rekeys).toHaveLength(2);
        expect(
          JSON.parse(readFileSync(join(movedRoot, ".diffgazer", "project.json"), "utf-8")),
        ).toMatchObject({ repoRoot: movedRoot });
      });
    } finally {
      resetConfigSeams();
    }
  });

  it("keeps project.json on the old root when no re-key handler is registered", async () => {
    const logModule = await import("../log.js");
    const logSpy = vi.spyOn(logModule, "log").mockImplementation(() => {});
    const createConfigStore = await loadStoreFactory();
    const originalRoot = join(diffgazerHome, "unwired-original");
    const movedRoot = join(diffgazerHome, "unwired-moved");
    const projectFilePath = join(movedRoot, ".diffgazer", "project.json");
    mkdirSync(join(movedRoot, ".diffgazer"), { recursive: true });
    mkdirSync(join(movedRoot, ".git"), { recursive: true });
    writeFileSync(
      projectFilePath,
      JSON.stringify({
        projectId: "unwired-id",
        repoRoot: originalRoot,
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
    );

    try {
      createConfigStore().ensureProjectFile(movedRoot);

      await vi.waitFor(() =>
        expect(logSpy).toHaveBeenCalledWith("error", "review_rekey_handler_not_registered"),
      );
      await new Promise((resolve) => setImmediate(resolve));
      expect(JSON.parse(readFileSync(projectFilePath, "utf-8"))).toMatchObject({
        repoRoot: originalRoot,
      });
    } finally {
      logSpy.mockRestore();
    }
  });

  it("keeps exactly one trust record for a moved project's preserved projectId", async () => {
    const movedRoot = join(diffgazerHome, "moved-trust");
    mkdirSync(join(movedRoot, ".diffgazer"), { recursive: true });
    mkdirSync(join(movedRoot, ".git"), { recursive: true });
    writeFileSync(
      join(movedRoot, ".diffgazer", "project.json"),
      JSON.stringify({
        projectId: "stable-trust-id",
        repoRoot: join(diffgazerHome, "gone"),
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    const store = await loadStore();

    const info = store.ensureProjectFile(movedRoot);
    await store.saveTrust(trustConfig({ projectId: info.projectId ?? "", repoRoot: movedRoot }));
    // A second re-trust under the same projectId overwrites, never minting a duplicate.
    await store.saveTrust(trustConfig({ projectId: info.projectId ?? "", repoRoot: movedRoot }));

    const records = readJson<{ projects: Record<string, unknown> }>(trustPath()).projects;
    expect(Object.keys(records)).toEqual([info.projectId]);
  });
});
