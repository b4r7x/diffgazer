import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@diffgazer/core/result";

// Boundary mock: git/service wraps the `git` CLI subprocess (external-process boundary); tests provide canned status/diff/blame responses so context snapshot behavior can be exercised without a real repository.
vi.mock("../../shared/lib/git/service.js", () => ({
  createGitService: vi.fn(),
}));

import { createGitService } from "../../shared/lib/git/service.js";
import { buildProjectContextSnapshot, loadContextSnapshot } from "./context.js";

type GitService = ReturnType<typeof createGitService>;

let projectRoot: string;
let statusHash = "hash-1";

function makeGitService(overrides: Partial<GitService> = {}): GitService {
  return {
    getStatus: vi.fn(async () => ok({
      isGitRepo: true,
      branch: "main",
      remoteBranch: null,
      ahead: 0,
      behind: 0,
      files: { staged: [], unstaged: [], untracked: [] },
      hasChanges: false,
      conflicted: [],
    })),
    getDiff: vi.fn(async () => ""),
    isGitInstalled: vi.fn(async () => true),
    getBlame: vi.fn(async () => null),
    getFileLines: vi.fn(async () => []),
    getHeadCommit: vi.fn(async () => ok("HEAD")),
    getStatusHash: vi.fn(async () => statusHash),
    ...overrides,
  };
}

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "diffgazer-context-"));
  statusHash = "hash-1";
  vi.resetAllMocks();
  vi.mocked(createGitService).mockReturnValue(makeGitService());
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf-8")) as T;
}

async function writeProjectFile(relativePath: string, content: string): Promise<void> {
  const absolutePath = join(projectRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf-8");
}

describe("loadContextSnapshot", () => {
  it("loads a snapshot from real context files", async () => {
    const contextDir = join(projectRoot, ".diffgazer");
    const graph = { generatedAt: "2025-01-01", root: projectRoot, packages: [], edges: [], fileTree: [], changedFiles: [] };
    const meta = { generatedAt: "2025-01-01", root: projectRoot, statusHash: "hash-1", charCount: 10 };
    await mkdir(contextDir, { recursive: true });
    await writeFile(join(contextDir, "context.md"), "# cached", "utf-8");
    await writeJson(join(contextDir, "context.json"), graph);
    await writeJson(join(contextDir, "context.meta.json"), meta);

    await expect(loadContextSnapshot(contextDir)).resolves.toEqual({
      markdown: "# cached",
      graph,
      meta,
    });
  });

  it("returns null when snapshot files are missing or corrupt", async () => {
    await expect(loadContextSnapshot(join(projectRoot, ".diffgazer"))).resolves.toBeNull();

    const contextDir = join(projectRoot, ".diffgazer");
    await mkdir(contextDir, { recursive: true });
    await writeFile(join(contextDir, "context.md"), "# cached", "utf-8");
    await writeFile(join(contextDir, "context.json"), "not json", "utf-8");

    await expect(loadContextSnapshot(contextDir)).resolves.toBeNull();
  });
});

describe("buildProjectContextSnapshot", () => {
  it("discovers project metadata, workspace packages, file tree, and persists the snapshot", async () => {
    await writeProjectFile("package.json", JSON.stringify({
      name: "root-app",
      version: "1.0.0",
      description: "Root package",
    }));
    await writeProjectFile("README.md", "# Root\n\nReadme excerpt");
    await writeProjectFile("apps/web/package.json", JSON.stringify({
      name: "@repo/web",
      dependencies: { "@repo/core": "workspace:*", react: "19" },
      devDependencies: { vitest: "1" },
    }));
    await writeProjectFile("packages/core/package.json", JSON.stringify({
      name: "@repo/core",
      peerDependencies: { zod: "4" },
    }));
    await writeProjectFile("src/index.ts", "export const value = 1;\n");
    await writeProjectFile("node_modules/ignored/index.js", "");
    await writeProjectFile("dist/ignored.js", "");
    await mkdir(join(projectRoot, ".git"), { recursive: true });
    await symlink(join(projectRoot, "src"), join(projectRoot, "src-link"));

    const result = await buildProjectContextSnapshot(projectRoot);

    expect(result.markdown).toContain("- Name: root-app");
    expect(result.markdown).toContain("# Root");
    expect(result.graph.packages).toEqual([
      { name: "@repo/web", dir: "apps/web", kind: "app" },
      { name: "@repo/core", dir: "packages/core", kind: "package" },
    ]);
    expect(result.graph.edges).toEqual([
      { from: "@repo/web", to: ["@repo/core"] },
      { from: "@repo/core", to: [] },
    ]);
    expect(result.graph.fileTree.map((node) => node.name)).toEqual(
      expect.arrayContaining(["README.md", "apps", "package.json", "packages", "src", "src-link"]),
    );
    expect(result.graph.fileTree.map((node) => node.name)).not.toEqual(
      expect.arrayContaining([".diffgazer", ".git", "dist", "node_modules"]),
    );

    await expect(readFile(join(projectRoot, ".diffgazer", "context.md"), "utf-8")).resolves.toBe(result.markdown);
    await expect(readJson(join(projectRoot, ".diffgazer", "context.json"))).resolves.toMatchObject({
      root: projectRoot,
      packages: result.graph.packages,
      edges: result.graph.edges,
    });
    await expect(readJson(join(projectRoot, ".diffgazer", "context.meta.json"))).resolves.toMatchObject({
      root: projectRoot,
      statusHash: "hash-1",
      charCount: result.markdown.length,
    });
  });

  it("uses a matching cached snapshot and rebuilds when forced", async () => {
    await writeProjectFile("package.json", JSON.stringify({ name: "first", version: "1.0.0" }));
    const first = await buildProjectContextSnapshot(projectRoot);
    expect(first.markdown).toContain("- Name: first");

    await writeProjectFile("package.json", JSON.stringify({ name: "second", version: "1.0.0" }));
    const cached = await buildProjectContextSnapshot(projectRoot);
    expect(cached.markdown).toBe(first.markdown);

    const rebuilt = await buildProjectContextSnapshot(projectRoot, { force: true });
    expect(rebuilt.markdown).toContain("- Name: second");
  });

  it("rebuilds when the git status hash changes", async () => {
    await writeProjectFile("package.json", JSON.stringify({ name: "first", version: "1.0.0" }));
    await buildProjectContextSnapshot(projectRoot);

    await writeProjectFile("package.json", JSON.stringify({ name: "second", version: "1.0.0" }));
    statusHash = "hash-2";

    const rebuilt = await buildProjectContextSnapshot(projectRoot);

    expect(rebuilt.markdown).toContain("- Name: second");
    expect(rebuilt.meta.statusHash).toBe("hash-2");
  });

  it("renders a bounded nested file tree in markdown", async () => {
    await writeProjectFile("a/b/c/d/e/f/g/file.ts", "");

    const result = await buildProjectContextSnapshot(projectRoot);
    const treeSection = result.markdown.split("## File Tree")[1] ?? "";

    expect(treeSection).toContain("- a/");
    expect(treeSection).toContain("          - f/");
    expect(treeSection).not.toContain("file.ts");
  });

  it("rejects workspace globs that escape the project root", async () => {
    // Place a sibling directory with a package.json that should NOT be discovered
    const siblingDir = join(dirname(projectRoot), "sibling-project");
    await mkdir(join(siblingDir, "evil-pkg"), { recursive: true });
    await writeJson(join(siblingDir, "evil-pkg", "package.json"), {
      name: "@evil/pkg",
      version: "1.0.0",
    });

    // The project has a workspace.yaml with a glob that tries to escape
    await writeProjectFile("package.json", JSON.stringify({ name: "safe-root", version: "1.0.0" }));
    await writeProjectFile(
      "pnpm-workspace.yaml",
      "packages:\n  - '../sibling-project/*'\n  - 'apps/*'\n",
    );
    await writeProjectFile("apps/web/package.json", JSON.stringify({ name: "@safe/web" }));

    const result = await buildProjectContextSnapshot(projectRoot);

    const packageNames = result.graph.packages.map((pkg) => pkg.name);
    expect(packageNames).toContain("@safe/web");
    expect(packageNames).not.toContain("@evil/pkg");

    // Cleanup sibling
    await rm(siblingDir, { recursive: true, force: true });
  });
});
