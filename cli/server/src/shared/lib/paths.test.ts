import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertProjectDiffgazerDirContained,
  getGlobalDiffgazerDir,
  getGlobalModelsDevCatalogPath,
  isProjectDiffgazerDirContained,
  isRepoRelativePath,
  resolveProjectRoot,
} from "./paths.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(tmpdir(), "diffgazer-paths-"));
  delete process.env.DIFFGAZER_HOME;
});

afterEach(async () => {
  delete process.env.DIFFGAZER_HOME;
  await rm(tempRoot, { recursive: true, force: true });
});

describe("resolveProjectRoot", () => {
  it("prioritizes header, then env, then cwd", () => {
    const home = homedir();

    expect(
      resolveProjectRoot({
        header: `${home}/from/header`,
        env: path.join(tempRoot, "env"),
        cwd: path.join(tempRoot, "cwd"),
      }),
    ).toBe(`${home}/from/header`);

    expect(
      resolveProjectRoot({
        header: null,
        env: path.join(tempRoot, "env"),
        cwd: path.join(tempRoot, "cwd"),
      }),
    ).toBe(path.join(tempRoot, "env"));
  });

  it("walks up from cwd to the nearest git root", async () => {
    const repoRoot = path.join(tempRoot, "repo");
    const nested = path.join(repoRoot, "src", "deep");
    await mkdir(path.join(repoRoot, ".git"), { recursive: true });
    await mkdir(nested, { recursive: true });

    expect(resolveProjectRoot({ header: null, env: null, cwd: nested })).toBe(repoRoot);
  });

  it("returns normalized cwd when no git root exists", async () => {
    const cwd = path.join(tempRoot, "no-git", "child");
    await mkdir(cwd, { recursive: true });

    expect(resolveProjectRoot({ header: null, env: null, cwd })).toBe(cwd);
  });

  it("trims blank inputs and falls back to cwd", async () => {
    const cwd = path.join(tempRoot, "fallback");
    await mkdir(cwd, { recursive: true });

    expect(resolveProjectRoot({ header: "  ", env: "", cwd: `  ${cwd}  ` })).toBe(cwd);
  });

  it("rejects header paths outside the home directory unless they are git repositories", async () => {
    const repoRoot = path.join(tempRoot, "external-repo");
    await mkdir(path.join(repoRoot, ".git"), { recursive: true });

    expect(() => resolveProjectRoot({ header: path.join(tempRoot, "external") })).toThrow(
      "Invalid project root",
    );
    expect(resolveProjectRoot({ header: repoRoot })).toBe(repoRoot);
  });
});

describe("project-root filesystem changes", () => {
  it("accepts an external project root after a .git directory is created", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "diffgazer-project-root-"));

    try {
      expect(() => resolveProjectRoot({ header: root })).toThrow("Invalid project root");

      await mkdir(path.join(root, ".git"));

      expect(resolveProjectRoot({ header: root })).toBe(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects an external project root after its .git directory is removed", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "diffgazer-project-root-"));
    await mkdir(path.join(root, ".git"));

    try {
      expect(resolveProjectRoot({ header: root })).toBe(root);

      await rm(path.join(root, ".git"), { recursive: true });

      expect(() => resolveProjectRoot({ header: root })).toThrow("Invalid project root");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("getGlobalDiffgazerDir", () => {
  it("uses DIFFGAZER_HOME when set and otherwise defaults under the user home", () => {
    process.env.DIFFGAZER_HOME = `  ${tempRoot}  `;
    expect(getGlobalDiffgazerDir()).toBe(tempRoot);

    delete process.env.DIFFGAZER_HOME;
    expect(getGlobalDiffgazerDir()).toBe(path.join(homedir(), ".diffgazer"));
  });
});

describe("getGlobalModelsDevCatalogPath", () => {
  it("resolves models-dev.json under the global diffgazer dir", () => {
    process.env.DIFFGAZER_HOME = tempRoot;
    expect(getGlobalModelsDevCatalogPath()).toBe(path.join(tempRoot, "models-dev.json"));
  });
});

describe("isRepoRelativePath", () => {
  it.each([
    "src/main.ts",
    "src/foo..bar.ts",
    "src/foo..bar/baz.ts",
  ])("accepts repo-relative path %s", (relativePath) => {
    expect(isRepoRelativePath(relativePath)).toBe(true);
  });

  it.each([
    "../escape.ts",
    "src/../escape.ts",
    "/abs/path.ts",
    "\\abs\\path.ts",
    "C:\\win.ts",
    "a\0b",
  ])("rejects unsafe path %s", (relativePath) => {
    expect(isRepoRelativePath(relativePath)).toBe(false);
  });
});

describe("project .diffgazer containment", () => {
  it("allows a missing state directory", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "diffgazer-project-root-"));
    try {
      expect(isProjectDiffgazerDirContained(projectRoot)).toBe(true);
      expect(() => assertProjectDiffgazerDirContained(projectRoot)).not.toThrow();
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("allows a real directory inside the project root", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "diffgazer-project-root-"));
    await mkdir(path.join(projectRoot, ".diffgazer"), { recursive: true });
    try {
      expect(isProjectDiffgazerDirContained(projectRoot)).toBe(true);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === "win32")(
    "rejects a symlinked .diffgazer directory that escapes the project root",
    async () => {
      const projectRoot = await mkdtemp(path.join(tmpdir(), "diffgazer-project-root-"));
      const outsideRoot = await mkdtemp(path.join(tmpdir(), "diffgazer-outside-root-"));
      try {
        await writeFile(path.join(outsideRoot, "project.json"), "{}\n");
        await symlink(outsideRoot, path.join(projectRoot, ".diffgazer"));

        expect(isProjectDiffgazerDirContained(projectRoot)).toBe(false);
        expect(() => assertProjectDiffgazerDirContained(projectRoot)).toThrow(/symlink/);
      } finally {
        await rm(projectRoot, { recursive: true, force: true });
        await rm(outsideRoot, { recursive: true, force: true });
      }
    },
  );
});
