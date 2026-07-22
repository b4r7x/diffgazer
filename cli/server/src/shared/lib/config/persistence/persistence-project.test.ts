import { mkdir, readdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { homePath, readJson, writeJson } from "./persistence.test-support.js";

import "./persistence.test-support.js";

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

  it("reads an existing project file or creates one under the project .diffgazer directory", async () => {
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

    const newRoot = homePath("new-project");
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
