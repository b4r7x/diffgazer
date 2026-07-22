import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { ok } from "@diffgazer/core/result";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Boundary mock: git/service wraps the `git` CLI subprocess; tests feed canned status/diff responses.
vi.mock("../../../shared/lib/git/service.js", () => ({
  createGitService: vi.fn(),
}));

const writeOrder: string[] = [];
let beforeAtomicWrite: ((filePath: string, content: string) => Promise<void>) | undefined;
// Boundary mock: filesystem helper; delegates to the real atomic write while recording commit order.
vi.mock("../../../shared/lib/fs.js", async () => {
  const actual = await vi.importActual<typeof import("../../../shared/lib/fs.js")>(
    "../../../shared/lib/fs.js",
  );
  return {
    ...actual,
    atomicWriteFile: async (filePath: string, content: string, mode?: number) => {
      writeOrder.push(basename(filePath));
      await beforeAtomicWrite?.(filePath, content);
      return actual.atomicWriteFile(filePath, content, mode);
    },
  };
});

import { createGitService } from "../../../shared/lib/git/service.js";
import { loadContextSnapshot } from "./snapshot/artifacts.js";
import { buildProjectContextSnapshot } from "./snapshot/build.js";
import { buildWorkspaceEdges } from "./snapshot/content.js";

type GitService = ReturnType<typeof createGitService>;
type StatusHashResult = Awaited<ReturnType<GitService["getStatusHash"]>>;

let projectRoot: string;
let statusHashResult: StatusHashResult = { kind: "full", hash: "hash-1" };

function makeGitService(overrides: Partial<GitService> = {}): GitService {
  return {
    getStatus: vi.fn(async () =>
      ok({
        isGitRepo: true,
        branch: "main",
        remoteBranch: null,
        ahead: 0,
        behind: 0,
        files: { staged: [], unstaged: [], untracked: [] },
        hasChanges: false,
        conflicted: [],
      }),
    ),
    getDiff: vi.fn(async () => ok("")),
    isGitInstalled: vi.fn(async () => true),
    getHeadCommit: vi.fn(async () => ok("HEAD")),
    getStatusHash: vi.fn(async () => statusHashResult),
    ...overrides,
  };
}

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "diffgazer-context-"));
  statusHashResult = { kind: "full", hash: "hash-1" };
  beforeAtomicWrite = undefined;
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

function snapshotArtifactNames(generation: string) {
  return {
    markdown: `context.${generation}.md`,
    graph: `context.${generation}.json`,
    meta: `context.${generation}.meta.json`,
  } as const;
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function writeSnapshotFixture(
  contextDir: string,
  snapshot: { markdown: string; graph: unknown; meta: unknown },
  generation = "fixture",
): Promise<void> {
  const names = snapshotArtifactNames(generation);
  const graphContent = JSON.stringify(snapshot.graph, null, 2);
  const metaContent = JSON.stringify(snapshot.meta, null, 2);
  await mkdir(contextDir, { recursive: true });
  await writeFile(join(contextDir, names.markdown), snapshot.markdown, "utf-8");
  await writeFile(join(contextDir, names.graph), graphContent, "utf-8");
  await writeFile(join(contextDir, names.meta), metaContent, "utf-8");
  await writeJson(join(contextDir, "context.manifest.json"), {
    version: 1,
    generation,
    artifacts: {
      markdown: { file: names.markdown, sha256: sha256(snapshot.markdown) },
      graph: { file: names.graph, sha256: sha256(graphContent) },
      meta: { file: names.meta, sha256: sha256(metaContent) },
    },
  });
}

async function readCurrentSnapshotFiles(contextDir: string) {
  const manifest = await readJson<{
    artifacts: {
      markdown: { file: string };
      graph: { file: string };
      meta: { file: string };
    };
  }>(join(contextDir, "context.manifest.json"));
  return {
    markdown: await readFile(join(contextDir, manifest.artifacts.markdown.file), "utf-8"),
    graph: await readJson<unknown>(join(contextDir, manifest.artifacts.graph.file)),
    meta: await readJson<unknown>(join(contextDir, manifest.artifacts.meta.file)),
  };
}

describe("loadContextSnapshot", () => {
  it("loads a snapshot from real context files", async () => {
    const contextDir = join(projectRoot, ".diffgazer");
    const graph = {
      generatedAt: "2025-01-01",
      root: projectRoot,
      packages: [],
      edges: [],
      fileTree: [],
      changedFiles: [],
    };
    const meta = {
      generatedAt: "2025-01-01",
      root: projectRoot,
      statusHash: "hash-1",
      statusHashKind: "full",
      charCount: 10,
    };
    await writeSnapshotFixture(contextDir, { markdown: "# cached", graph, meta });

    await expect(loadContextSnapshot(contextDir)).resolves.toEqual({
      markdown: "# cached",
      graph,
      meta,
    });
  });

  it("returns null when snapshot files are missing or corrupt", async () => {
    await expect(loadContextSnapshot(join(projectRoot, ".diffgazer"))).resolves.toBeNull();

    const contextDir = join(projectRoot, ".diffgazer");
    const graph = {
      generatedAt: "2025-01-01",
      root: projectRoot,
      packages: [],
      edges: [],
      fileTree: [],
      changedFiles: [],
    };
    const meta = {
      generatedAt: "2025-01-01",
      root: projectRoot,
      statusHash: "hash-1",
      statusHashKind: "full",
      charCount: 8,
    };
    await writeSnapshotFixture(contextDir, { markdown: "# cached", graph, meta });
    await writeFile(join(contextDir, snapshotArtifactNames("fixture").graph), "not json", "utf-8");

    await expect(loadContextSnapshot(contextDir)).resolves.toBeNull();
  });

  it.skipIf(process.platform === "win32")(
    "does not read a cache file that symlinks outside the context directory",
    async () => {
      const outsideRoot = await mkdtemp(join(tmpdir(), "diffgazer-outside-"));
      try {
        const contextDir = join(projectRoot, ".diffgazer");
        await writeFile(join(outsideRoot, "secret.md"), "SECRET_EXTERNAL_CACHE_MARKER", "utf-8");
        await writeSnapshotFixture(contextDir, {
          markdown: "SECRET_EXTERNAL_CACHE_MARKER",
          graph: {
            generatedAt: "2025-01-01",
            root: projectRoot,
            packages: [],
            edges: [],
            fileTree: [],
            changedFiles: [],
          },
          meta: {
            generatedAt: "2025-01-01",
            root: projectRoot,
            statusHash: "hash-1",
            statusHashKind: "full",
            charCount: 28,
          },
        });
        const markdownPath = join(contextDir, snapshotArtifactNames("fixture").markdown);
        await rm(markdownPath);
        await symlink(join(outsideRoot, "secret.md"), markdownPath);

        await expect(loadContextSnapshot(contextDir)).resolves.toBeNull();
      } finally {
        await rm(outsideRoot, { recursive: true, force: true });
      }
    },
  );

  it("returns null for a snapshot whose stored root belongs to a different checkout", async () => {
    const foreignRoot = await mkdtemp(join(tmpdir(), "diffgazer-foreign-"));
    try {
      const contextDir = join(projectRoot, ".diffgazer");
      await writeSnapshotFixture(contextDir, {
        markdown: "# foreign",
        graph: {
          generatedAt: "2025-01-01",
          root: foreignRoot,
          packages: [],
          edges: [],
          fileTree: [],
          changedFiles: [],
        },
        meta: {
          generatedAt: "2025-01-01",
          root: foreignRoot,
          statusHash: "hash-1",
          statusHashKind: "full",
          charCount: 9,
        },
      });

      await expect(loadContextSnapshot(contextDir)).resolves.toBeNull();
    } finally {
      await rm(foreignRoot, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === "win32")(
    "does not read context files through a symlinked .diffgazer directory",
    async () => {
      const outsideRoot = await mkdtemp(join(tmpdir(), "diffgazer-outside-"));
      try {
        await writeSnapshotFixture(outsideRoot, {
          markdown: "SECRET_EXTERNAL_CACHE_MARKER",
          graph: {
            generatedAt: "2025-01-01",
            root: projectRoot,
            packages: [],
            edges: [],
            fileTree: [],
            changedFiles: [],
          },
          meta: {
            generatedAt: "2025-01-01",
            root: projectRoot,
            statusHash: "hash-1",
            statusHashKind: "full",
            charCount: 28,
          },
        });
        const contextDir = join(projectRoot, ".diffgazer");
        await symlink(outsideRoot, contextDir);

        await expect(loadContextSnapshot(contextDir)).resolves.toBeNull();
      } finally {
        await rm(outsideRoot, { recursive: true, force: true });
      }
    },
  );

  it("returns null when cached snapshot JSON has the wrong shape", async () => {
    const contextDir = join(projectRoot, ".diffgazer");
    await writeSnapshotFixture(contextDir, {
      markdown: "# cached",
      graph: { packages: "wrong" },
      meta: {
        generatedAt: "2025-01-01",
        root: projectRoot,
        statusHash: "hash-1",
        statusHashKind: "full",
        charCount: 8,
      },
    });

    await expect(loadContextSnapshot(contextDir)).resolves.toBeNull();
  });

  it("rejects an artifact whose bytes no longer match the committed manifest", async () => {
    const contextDir = join(projectRoot, ".diffgazer");
    await writeSnapshotFixture(contextDir, {
      markdown: "# cached",
      graph: {
        generatedAt: "2025-01-01",
        root: projectRoot,
        packages: [],
        edges: [],
        fileTree: [],
        changedFiles: [],
      },
      meta: {
        generatedAt: "2025-01-01",
        root: projectRoot,
        statusHash: "hash-1",
        statusHashKind: "full",
        charCount: 8,
      },
    });
    await writeFile(join(contextDir, snapshotArtifactNames("fixture").markdown), "# TAMPERED");

    await expect(loadContextSnapshot(contextDir)).resolves.toBeNull();
  });
});

describe("buildProjectContextSnapshot", () => {
  it("builds medium workspace edges without rescanning package names per dependency", () => {
    const packageCount = 500;
    let nameReads = 0;
    const packages = Array.from({ length: packageCount }, (_, index) => {
      const name = `package-${index}`;
      return {
        get name() {
          nameReads += 1;
          return name;
        },
        dir: `packages/${index}`,
        kind: "package" as const,
        dependencies: [`package-${(index + 1) % packageCount}`, "external-package"],
      };
    });

    const edges = buildWorkspaceEdges(packages);

    expect(edges).toHaveLength(packageCount);
    expect(edges[0]).toEqual({ from: "package-0", to: ["package-1"] });
    expect(edges.at(-1)).toEqual({ from: "package-499", to: ["package-0"] });
    expect(nameReads).toBeLessThanOrEqual(packageCount * 2);
  });

  it("discovers project metadata, workspace packages, file tree, and persists the snapshot", async () => {
    await writeProjectFile(
      "package.json",
      JSON.stringify({
        name: "root-app",
        version: "1.0.0",
        description: "Root package",
      }),
    );
    await writeProjectFile("README.md", "# Root\n\nReadme excerpt");
    await writeProjectFile(
      "apps/web/package.json",
      JSON.stringify({
        name: "@repo/web",
        dependencies: { "@repo/core": "workspace:*", react: "19" },
        devDependencies: { vitest: "1" },
      }),
    );
    await writeProjectFile(
      "packages/core/package.json",
      JSON.stringify({
        name: "@repo/core",
        peerDependencies: { zod: "4" },
      }),
    );
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

    const persisted = await readCurrentSnapshotFiles(join(projectRoot, ".diffgazer"));
    expect(persisted.markdown).toBe(result.markdown);
    expect(persisted.graph).toMatchObject({
      root: projectRoot,
      packages: result.graph.packages,
      edges: result.graph.edges,
    });
    expect(persisted.meta).toMatchObject({
      root: projectRoot,
      statusHash: "hash-1",
      statusHashKind: "full",
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

  it("rebuilds when a full status identity becomes unavailable", async () => {
    statusHashResult = { kind: "full", hash: "" };
    await writeProjectFile("package.json", JSON.stringify({ name: "first", version: "1.0.0" }));
    const first = await buildProjectContextSnapshot(projectRoot);
    expect(first.meta.statusHashKind).toBe("full");

    await writeProjectFile("package.json", JSON.stringify({ name: "second", version: "1.0.0" }));
    statusHashResult = { kind: "unavailable" };

    const rebuilt = await buildProjectContextSnapshot(projectRoot);

    expect(rebuilt.markdown).toContain("- Name: second");
    expect(rebuilt.meta.statusHashKind).toBe("unavailable");
  });

  it("rebuilds when the same status-only hash may hide changed content", async () => {
    statusHashResult = { kind: "status-only", hash: "status-1" };
    await writeProjectFile("package.json", JSON.stringify({ name: "first", version: "1.0.0" }));
    await buildProjectContextSnapshot(projectRoot);

    await writeProjectFile("package.json", JSON.stringify({ name: "second", version: "1.0.0" }));
    const rebuilt = await buildProjectContextSnapshot(projectRoot);

    expect(rebuilt.markdown).toContain("- Name: second");
    expect(rebuilt.meta.statusHashKind).toBe("status-only");
  });

  it("reuses a matching full status identity without writing a second snapshot", async () => {
    await writeProjectFile("package.json", JSON.stringify({ name: "first", version: "1.0.0" }));
    const first = await buildProjectContextSnapshot(projectRoot);
    writeOrder.length = 0;

    const cached = await buildProjectContextSnapshot(projectRoot);

    expect(cached).toEqual(first);
    expect(writeOrder).toEqual([]);
  });

  it("rebuilds instead of reusing a structurally invalid cached snapshot", async () => {
    const contextDir = join(projectRoot, ".diffgazer");
    await writeProjectFile("package.json", JSON.stringify({ name: "fresh", version: "1.0.0" }));
    await writeSnapshotFixture(contextDir, {
      markdown: "# stale",
      graph: { generatedAt: "oops" },
      meta: {
        generatedAt: "2025-01-01",
        root: projectRoot,
        statusHash: "hash-1",
        statusHashKind: "full",
        headCommit: "HEAD",
        charCount: 7,
      },
    });

    const rebuilt = await buildProjectContextSnapshot(projectRoot);

    expect(rebuilt.markdown).toContain("- Name: fresh");
    expect(rebuilt.markdown).not.toBe("# stale");
  });

  it("rebuilds when the git status hash changes", async () => {
    await writeProjectFile("package.json", JSON.stringify({ name: "first", version: "1.0.0" }));
    await buildProjectContextSnapshot(projectRoot);

    await writeProjectFile("package.json", JSON.stringify({ name: "second", version: "1.0.0" }));
    statusHashResult = { kind: "full", hash: "hash-2" };

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

  it("truncates file tree when node count exceeds cap", async () => {
    for (let i = 0; i < 1100; i++) {
      await writeProjectFile(`files/file-${String(i).padStart(4, "0")}.ts`, "");
    }

    const result = await buildProjectContextSnapshot(projectRoot, { force: true });

    expect(result.markdown).toContain("File tree truncated at 1000 nodes");
    expect(result.meta.treeTruncated).toBe(true);
  });

  it("truncates context markdown when byte size exceeds cap", async () => {
    const largeContent = "X".repeat(60_000);
    await writeProjectFile(
      "package.json",
      JSON.stringify({ name: "big-project", version: "1.0.0" }),
    );
    await writeProjectFile("README.md", largeContent);

    const result = await buildProjectContextSnapshot(projectRoot, { force: true });

    expect(Buffer.byteLength(result.markdown, "utf-8")).toBeLessThanOrEqual(50_000 + 50);
    expect(result.markdown).toContain("Context truncated to fit size limit");
  });

  it("ignores an invalid root package manifest instead of crashing", async () => {
    await writeProjectFile("package.json", JSON.stringify({ name: ["wrong"], version: "1.0.0" }));

    const result = await buildProjectContextSnapshot(projectRoot, { force: true });

    expect(result.markdown).toContain("package.json not found.");
  });

  it("rejects workspace globs that escape the project root", async () => {
    const siblingDir = join(dirname(projectRoot), "sibling-project");
    await mkdir(join(siblingDir, "evil-pkg"), { recursive: true });
    await writeJson(join(siblingDir, "evil-pkg", "package.json"), {
      name: "@evil/pkg",
      version: "1.0.0",
    });

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

    await rm(siblingDir, { recursive: true, force: true });
  });

  it.skipIf(process.platform === "win32")(
    "does not embed a README that symlinks outside the project root",
    async () => {
      const outsideRoot = await mkdtemp(join(tmpdir(), "diffgazer-outside-"));
      try {
        await writeProjectFile(
          "package.json",
          JSON.stringify({ name: "safe-root", version: "1.0.0" }),
        );
        await writeFile(join(outsideRoot, "README.md"), "SECRET_EXTERNAL_README_MARKER", "utf-8");
        await symlink(join(outsideRoot, "README.md"), join(projectRoot, "README.md"));

        const result = await buildProjectContextSnapshot(projectRoot, { force: true });

        expect(result.markdown).not.toContain("SECRET_EXTERNAL_README_MARKER");
        expect(result.markdown).not.toContain("## README (excerpt)");
      } finally {
        await rm(outsideRoot, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(process.platform === "win32")(
    "refuses to build when the context cache directory symlinks outside the project root",
    async () => {
      const outsideRoot = await mkdtemp(join(tmpdir(), "diffgazer-outside-"));
      try {
        await writeProjectFile(
          "package.json",
          JSON.stringify({ name: "safe-root", version: "1.0.0" }),
        );
        await symlink(outsideRoot, join(projectRoot, ".diffgazer"));

        await expect(buildProjectContextSnapshot(projectRoot, { force: true })).rejects.toThrow(
          /outside the project root/,
        );
        await expect(
          readFile(join(outsideRoot, "context.manifest.json"), "utf-8"),
        ).rejects.toThrow();
      } finally {
        await rm(outsideRoot, { recursive: true, force: true });
      }
    },
  );

  it("rebuilds instead of reusing a cached snapshot generated for a different root", async () => {
    const foreignRoot = await mkdtemp(join(tmpdir(), "diffgazer-foreign-"));
    try {
      await writeProjectFile("package.json", JSON.stringify({ name: "current", version: "1.0.0" }));
      const contextDir = join(projectRoot, ".diffgazer");
      await writeSnapshotFixture(contextDir, {
        markdown: "# foreign-cache",
        graph: {
          generatedAt: "2025-01-01",
          root: foreignRoot,
          packages: [],
          edges: [],
          fileTree: [],
          changedFiles: [],
        },
        meta: {
          generatedAt: "2025-01-01",
          root: foreignRoot,
          statusHash: "hash-1",
          statusHashKind: "full",
          headCommit: "HEAD",
          charCount: 15,
        },
      });

      const rebuilt = await buildProjectContextSnapshot(projectRoot);

      expect(rebuilt.markdown).not.toBe("# foreign-cache");
      expect(rebuilt.markdown).toContain("- Name: current");
      expect(rebuilt.meta.root).toBe(projectRoot);
    } finally {
      await rm(foreignRoot, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === "win32")(
    "creates the context directory with 0o700 mode under a permissive umask",
    async () => {
      const previousUmask = process.umask(0o022);
      try {
        await writeProjectFile("package.json", JSON.stringify({ name: "perm", version: "1.0.0" }));
        await buildProjectContextSnapshot(projectRoot, { force: true });

        const dirStat = await stat(join(projectRoot, ".diffgazer"));
        expect(dirStat.mode & 0o777).toBe(0o700);
      } finally {
        process.umask(previousUmask);
      }
    },
  );

  it("truncates oversized context markdown on a boundary without replacement characters", async () => {
    // ż is 2 bytes; a raw byte-offset cut would split it into U+FFFD garbage.
    const multiByteContent = "ż".repeat(40_000);
    await writeProjectFile("package.json", JSON.stringify({ name: "wide", version: "1.0.0" }));
    await writeProjectFile("README.md", multiByteContent);

    const result = await buildProjectContextSnapshot(projectRoot, { force: true });

    expect(Buffer.byteLength(result.markdown, "utf-8")).toBeLessThanOrEqual(50_000 + 50);
    expect(result.markdown).toContain("Context truncated to fit size limit");
    expect(result.markdown).not.toContain("�");
  });

  it("serializes concurrent builds per project root, never interleaving their writes", async () => {
    await writeProjectFile("package.json", JSON.stringify({ name: "race", version: "1.0.0" }));

    // Park the first build at its first await (getStatusHash, before any write).
    // Without serialization the second build's getStatusHash fires while the
    // first is parked; the lock must hold it off until the first completes.
    const order: string[] = [];
    let releaseFirstHash: () => void = () => {};
    const firstHashGate = new Promise<void>((resolve) => {
      releaseFirstHash = resolve;
    });
    let signalFirstParked: () => void = () => {};
    const firstParked = new Promise<void>((resolve) => {
      signalFirstParked = resolve;
    });
    let hashCalls = 0;

    vi.mocked(createGitService).mockImplementation(() => {
      const callIndex = ++hashCalls;
      return makeGitService({
        getStatusHash: vi.fn(async () => {
          order.push(`hash-start-${callIndex}`);
          if (callIndex === 1) {
            signalFirstParked();
            await firstHashGate;
          }
          order.push(`hash-end-${callIndex}`);
          return { kind: "full" as const, hash: `hash-${callIndex}` };
        }),
      });
    });

    const first = buildProjectContextSnapshot(projectRoot, { force: true });
    const second = buildProjectContextSnapshot(projectRoot, { force: true });

    await firstParked;
    await new Promise((resolve) => setImmediate(resolve));
    expect(order).toEqual(["hash-start-1"]);

    releaseFirstHash();
    await Promise.all([first, second]);

    expect(order).toEqual(["hash-start-1", "hash-end-1", "hash-start-2", "hash-end-2"]);

    const contextDir = join(projectRoot, ".diffgazer");
    const persisted = await readCurrentSnapshotFiles(contextDir);
    const markdown = persisted.markdown;
    const meta = persisted.meta as { statusHash: string; charCount: number };
    // The committed generation stays internally consistent.
    expect(meta.charCount).toBe(markdown.length);
    expect(meta.statusHash).toBe("hash-2");
  });

  it("commits generation artifacts before atomically replacing the manifest", async () => {
    await writeProjectFile("package.json", JSON.stringify({ name: "order", version: "1.0.0" }));

    writeOrder.length = 0;
    await buildProjectContextSnapshot(projectRoot, { force: true });

    expect(writeOrder).toHaveLength(4);
    expect(writeOrder.slice(0, 3)).toEqual([
      expect.stringMatching(/^context\..+\.json$/),
      expect.stringMatching(/^context\..+\.md$/),
      expect.stringMatching(/^context\..+\.meta\.json$/),
    ]);
    expect(writeOrder[3]).toBe("context.manifest.json");
  });

  it("lets readers keep using the prior generation until the new manifest commits", async () => {
    await writeProjectFile("package.json", JSON.stringify({ name: "old", version: "1.0.0" }));
    const oldSnapshot = await buildProjectContextSnapshot(projectRoot, { force: true });
    await writeProjectFile("package.json", JSON.stringify({ name: "new", version: "1.0.0" }));
    statusHashResult = { kind: "full", hash: "hash-2" };

    const manifestWriteStarted = createDeferred<void>();
    const releaseManifestWrite = createDeferred<void>();
    beforeAtomicWrite = async (filePath) => {
      if (basename(filePath) !== "context.manifest.json") return;
      manifestWriteStarted.resolve();
      await releaseManifestWrite.promise;
    };

    const writer = buildProjectContextSnapshot(projectRoot, { force: true });
    await manifestWriteStarted.promise;

    const duringWrite = await loadContextSnapshot(join(projectRoot, ".diffgazer"));
    expect(duringWrite).toEqual(oldSnapshot);

    releaseManifestWrite.resolve();
    const newSnapshot = await writer;
    beforeAtomicWrite = undefined;

    await expect(loadContextSnapshot(join(projectRoot, ".diffgazer"))).resolves.toEqual(
      newSnapshot,
    );
    expect(newSnapshot.markdown).toContain("- Name: new");
  });
});
