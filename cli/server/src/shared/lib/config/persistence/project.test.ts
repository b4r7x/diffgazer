import { writeFileSync } from "node:fs";
import { mkdir, readdir, symlink, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { homePath, readJson } from "./persistence.test-support.js";

const { projectFsProbe } = vi.hoisted(() => ({
  projectFsProbe: {
    syncedPaths: [] as string[],
    events: [] as string[],
    exclusiveWinner: null as { data: unknown } | null,
  },
}));

vi.mock("../../fs.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../fs.js")>();
  return {
    ...actual,
    syncParentDirectorySync: (filePath: string) => {
      projectFsProbe.syncedPaths.push(filePath);
      projectFsProbe.events.push("sync");
      return actual.syncParentDirectorySync(filePath);
    },
    writeJsonFileSyncExclusive: (filePath: string, data: unknown, mode?: number) => {
      if (projectFsProbe.exclusiveWinner) {
        writeFileSync(
          filePath,
          `${JSON.stringify(projectFsProbe.exclusiveWinner.data, null, 2)}\n`,
          {
            mode,
          },
        );
        projectFsProbe.events.push("publish");
        throw Object.assign(new Error("project identity already exists"), { code: "EEXIST" });
      }
      return actual.writeJsonFileSyncExclusive(filePath, data, mode);
    },
  };
});

beforeEach(() => {
  projectFsProbe.syncedPaths.length = 0;
  projectFsProbe.events.length = 0;
  projectFsProbe.exclusiveWinner = null;
});

describe("project persistence", () => {
  it("treats a moved project directory as a move: keeps the projectId, re-points repoRoot, and re-keys reviews", async () => {
    const { readProjectFile } = await import("./project.js");
    const originalRoot = homePath("original-project");
    const movedRoot = homePath("moved-project");
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
      reconcileMove: true,
      onMove: async (oldRoot, newRoot) => {
        moves.push([oldRoot, newRoot]);
        return true;
      },
    });

    expect(result).toMatchObject({ projectId: "stable-id", repoRoot: movedRoot });
    const files = await readdir(path.join(movedRoot, ".diffgazer"));
    expect(files.some((file) => /^project\.json\..+\.backup$/.test(file))).toBe(false);
    expect(moves).toEqual([[originalRoot, movedRoot]]);

    await vi.waitFor(() => {
      const reread = readProjectFile(movedRoot);
      expect(reread).toMatchObject({ projectId: "stable-id", repoRoot: movedRoot });
    });
  });

  it("keeps the old project root durable until a failed move callback later succeeds", async () => {
    const { readProjectFile } = await import("./project.js");
    const originalRoot = homePath("retry-original-project");
    const movedRoot = homePath("retry-moved-project");
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

    readProjectFile(movedRoot, { reconcileMove: true, onMove });
    await vi.waitFor(() => expect(onMove).toHaveBeenCalledOnce());
    await new Promise((resolve) => setImmediate(resolve));
    await expect(readJson<{ repoRoot: string }>(projectFilePath)).resolves.toMatchObject({
      repoRoot: originalRoot,
    });

    shouldComplete = true;
    await vi.waitFor(() => {
      readProjectFile(movedRoot, { reconcileMove: true, onMove });
      expect(onMove).toHaveBeenCalledTimes(2);
    });
    await vi.waitFor(async () => {
      await expect(readJson<{ repoRoot: string }>(projectFilePath)).resolves.toMatchObject({
        repoRoot: movedRoot,
      });
    });
  });

  it("rejects reserved project IDs in project files", async () => {
    const projectRoot = homePath("reserved-project");
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
    const { readProjectFile } = await import("./project.js");

    expect(readProjectFile(projectRoot)).toBeNull();
  });

  it("does not reconcile a hostile repoRoot mismatch during read-only project lookup", async () => {
    const { readProjectFile } = await import("./project.js");
    const hostileRoot = homePath("hostile-checkout");
    const claimedVictimRoot = homePath("victim-project");
    await mkdir(path.join(hostileRoot, ".diffgazer"), { recursive: true });
    await writeFile(
      path.join(hostileRoot, ".diffgazer", "project.json"),
      JSON.stringify({
        projectId: "victim-project-id",
        repoRoot: claimedVictimRoot,
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
      "utf-8",
    );

    const onMove = vi.fn(async () => true);
    const result = readProjectFile(hostileRoot, { onMove });

    expect(result).toMatchObject({
      projectId: "victim-project-id",
      repoRoot: claimedVictimRoot,
    });
    expect(onMove).not.toHaveBeenCalled();
    await expect(
      readJson<{ repoRoot: string }>(path.join(hostileRoot, ".diffgazer", "project.json")),
    ).resolves.toMatchObject({ repoRoot: claimedVictimRoot });
  });

  it.skipIf(process.platform === "win32")(
    "does not read project state through a symlinked .diffgazer directory",
    async () => {
      const { readProjectFile, createProjectFile } = await import("./project.js");
      const hostileRoot = homePath("symlink-hostile-checkout");
      const outsideRoot = homePath("symlink-outside-state");
      await mkdir(outsideRoot, { recursive: true });
      await writeFile(
        path.join(outsideRoot, "project.json"),
        JSON.stringify({
          projectId: "victim-symlink-id",
          repoRoot: hostileRoot,
          createdAt: "2024-01-01T00:00:00.000Z",
        }),
        "utf-8",
      );
      await mkdir(hostileRoot, { recursive: true });
      await symlink(outsideRoot, path.join(hostileRoot, ".diffgazer"));

      expect(readProjectFile(hostileRoot)).toBeNull();
      expect(() => createProjectFile(hostileRoot)).toThrow(/symlink/);
    },
  );

  it.skipIf(process.platform === "win32")(
    "reads an existing project file or creates one under the project .diffgazer directory",
    async () => {
      const { createProjectFile } = await import("./project.js");
      const projectRoot = homePath("project");
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
      expect(projectFsProbe.syncedPaths).toEqual([projectFile]);
      expect(projectFsProbe.events).toEqual(["sync"]);

      const newRoot = homePath("new-project");
      const created = createProjectFile(newRoot);
      expect(created).toMatchObject({ repoRoot: newRoot });
      await expect(
        readJson(path.join(newRoot, ".diffgazer", "project.json")),
      ).resolves.toMatchObject({
        projectId: created.projectId,
        repoRoot: newRoot,
      });
    },
  );

  it.skipIf(process.platform === "win32")(
    "syncs the parent after an EEXIST winner is read",
    async () => {
      const { createProjectFile } = await import("./project.js");
      const projectRoot = homePath("exclusive-project");
      const projectFile = path.join(projectRoot, ".diffgazer", "project.json");
      await mkdir(path.dirname(projectFile), { recursive: true });
      projectFsProbe.exclusiveWinner = {
        data: {
          projectId: "winner-id",
          repoRoot: projectRoot,
          createdAt: "2024-01-01",
        },
      };

      expect(createProjectFile(projectRoot)).toMatchObject({
        projectId: "winner-id",
        repoRoot: projectRoot,
      });
      expect(projectFsProbe.syncedPaths).toEqual([projectFile]);
      expect(projectFsProbe.events).toEqual(["publish", "sync"]);
    },
  );
});
