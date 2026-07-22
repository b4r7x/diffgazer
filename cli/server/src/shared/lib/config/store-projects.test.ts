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
  it("re-keys review history when a trusted project directory is moved", async () => {
    const { setReviewRekeyHandler, createConfigStore } = await import("./store.js");
    const rekeys: Array<[string, string]> = [];
    let shouldComplete = false;
    setReviewRekeyHandler(async (oldPath, newPath) => {
      rekeys.push([oldPath, newPath]);
      return shouldComplete;
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
      const info = store.getProjectInfo(movedRoot);

      expect(info.projectId).toBe("stable-id");
      await vi.waitFor(() => expect(rekeys).toHaveLength(1));
      expect(rekeys[0]?.[1]).toContain("moved");
      expect(
        JSON.parse(readFileSync(join(movedRoot, ".diffgazer", "project.json"), "utf-8")),
      ).toMatchObject({ repoRoot: originalRoot });

      shouldComplete = true;
      await vi.waitFor(() => {
        store.getProjectInfo(movedRoot);
        expect(rekeys).toHaveLength(2);
        expect(
          JSON.parse(readFileSync(join(movedRoot, ".diffgazer", "project.json"), "utf-8")),
        ).toMatchObject({ repoRoot: movedRoot });
      });
    } finally {
      setReviewRekeyHandler(async () => true);
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
