import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  access: vi.fn(),
  realpath: vi.fn(),
}));

vi.mock("../../shared/lib/fs.js", () => ({
  readJsonFile: vi.fn(),
  atomicWriteFile: vi.fn(),
}));

vi.mock("../../shared/lib/git/service.js", () => ({
  createGitService: vi.fn(),
}));

import { readFile, mkdir, readdir, access, realpath } from "node:fs/promises";
import { loadContextSnapshot, buildProjectContextSnapshot } from "./context.js";
import { readJsonFile, atomicWriteFile } from "../../shared/lib/fs.js";
import { createGitService } from "../../shared/lib/git/service.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(realpath).mockImplementation(async (p) => p as string);
  vi.mocked(mkdir).mockResolvedValue(undefined);
  vi.mocked(atomicWriteFile).mockResolvedValue(undefined);
});

// Helper to create readdir entries
function dirEntry(name: string, isDir: boolean) {
  return { name, isDirectory: () => isDir };
}

describe("loadContextSnapshot", () => {
  it("should return snapshot when all files exist", async () => {
    const graph = { generatedAt: "2025-01-01", root: "/project", packages: [], edges: [], fileTree: [], changedFiles: [] };
    const meta = { generatedAt: "2025-01-01", root: "/project", statusHash: "abc", charCount: 100 };

    vi.mocked(readFile)
      .mockResolvedValueOnce("# markdown" as never) // context.md
      .mockResolvedValueOnce(JSON.stringify(graph) as never) // context.json
      .mockResolvedValueOnce(JSON.stringify(meta) as never); // context.meta.json

    const result = await loadContextSnapshot("/project/.stargazer");

    expect(result).toEqual({
      markdown: "# markdown",
      graph,
      meta,
    });
    expect(readFile).toHaveBeenCalledWith("/project/.stargazer/context.md", "utf8");
    expect(readFile).toHaveBeenCalledWith("/project/.stargazer/context.json", "utf8");
    expect(readFile).toHaveBeenCalledWith("/project/.stargazer/context.meta.json", "utf8");
  });

  it("should return null on missing files", async () => {
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

    const result = await loadContextSnapshot("/project/.stargazer");

    expect(result).toBeNull();
  });

  it("should return null on corrupt JSON", async () => {
    vi.mocked(readFile)
      .mockResolvedValueOnce("# markdown" as never) // context.md
      .mockResolvedValueOnce("not valid json" as never); // context.json (corrupt)

    const result = await loadContextSnapshot("/project/.stargazer");

    expect(result).toBeNull();
  });
});

describe("buildProjectContextSnapshot", () => {
  const mockGetStatusHash = vi.fn();

  beforeEach(() => {
    vi.mocked(createGitService).mockReturnValue({
      getStatusHash: mockGetStatusHash,
    } as any);
    mockGetStatusHash.mockResolvedValue("hash123");

    // loadContextSnapshot returns null by default (no cache)
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
  });

  function setupMinimalProject() {
    vi.mocked(access)
      .mockRejectedValueOnce(new Error("ENOENT")) // access: apps/ dir
      .mockRejectedValueOnce(new Error("ENOENT")); // access: packages/ dir

    // readdir for buildFileTree at root level
    vi.mocked(readdir).mockResolvedValue([] as any);

    // Root package.json
    vi.mocked(readJsonFile).mockResolvedValue(null);
  }

  it("should use cache when statusHash matches", async () => {
    const cachedGraph = { generatedAt: "2025-01-01", root: "/project", packages: [], edges: [], fileTree: [], changedFiles: [] };
    const cachedMeta = { generatedAt: "2025-01-01", root: "/project", statusHash: "hash123", charCount: 50 };

    // loadContextSnapshot reads 3 files
    vi.mocked(readFile)
      .mockResolvedValueOnce("# cached" as never) // context.md
      .mockResolvedValueOnce(JSON.stringify(cachedGraph) as never) // context.json
      .mockResolvedValueOnce(JSON.stringify(cachedMeta) as never); // context.meta.json

    const result = await buildProjectContextSnapshot("/project");

    expect(result.markdown).toBe("# cached");
    expect(result.meta.statusHash).toBe("hash123");
    // Should not call atomicWriteFile since cache was used
    expect(atomicWriteFile).not.toHaveBeenCalled();
  });

  it("should rebuild when force option is set even if cache matches", async () => {
    const cachedGraph = { generatedAt: "2025-01-01", root: "/project", packages: [], edges: [], fileTree: [], changedFiles: [] };
    const cachedMeta = { generatedAt: "2025-01-01", root: "/project", statusHash: "hash123", charCount: 50 };

    // First 3 reads for loadContextSnapshot
    vi.mocked(readFile)
      .mockResolvedValueOnce("# cached" as never) // context.md
      .mockResolvedValueOnce(JSON.stringify(cachedGraph) as never) // context.json
      .mockResolvedValueOnce(JSON.stringify(cachedMeta) as never) // context.meta.json
      .mockRejectedValueOnce(new Error("ENOENT")); // README.md (rebuild path)

    // No apps/packages dirs
    vi.mocked(access).mockRejectedValue(new Error("ENOENT"));
    vi.mocked(readdir).mockResolvedValue([] as any);
    // Root package.json
    vi.mocked(readJsonFile).mockResolvedValue({ name: "my-project", version: "1.0.0" });

    const result = await buildProjectContextSnapshot("/project", { force: true });

    expect(atomicWriteFile).toHaveBeenCalledTimes(3);
    expect(result.markdown).toContain("my-project");
  });

  describe("discoverWorkspacePackages", () => {
    it("should find apps and packages directories", async () => {
      // access: apps exists, packages exists
      vi.mocked(access).mockResolvedValue(undefined);

      vi.mocked(readdir)
        .mockResolvedValueOnce([dirEntry("web", true), dirEntry("cli", true)] as any) // readdir: apps/
        .mockResolvedValueOnce([dirEntry("core", true)] as any) // readdir: packages/
        .mockResolvedValue([] as any); // buildFileTree and remaining calls

      vi.mocked(readJsonFile)
        .mockResolvedValueOnce({ name: "@repo/web", dependencies: { react: "19" } }) // apps/web/package.json
        .mockResolvedValueOnce({ name: "@repo/cli", dependencies: { ink: "6" }, devDependencies: { vitest: "1" } }) // apps/cli/package.json
        .mockResolvedValueOnce({ name: "@repo/core", peerDependencies: { zod: "4" } }) // packages/core/package.json
        .mockResolvedValueOnce({ name: "stargazer", version: "1.0.0" }); // root package.json

      // README
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const result = await buildProjectContextSnapshot("/project");

      expect(result.graph.packages).toEqual([
        { name: "@repo/web", dir: "apps/web", kind: "app" },
        { name: "@repo/cli", dir: "apps/cli", kind: "app" },
        { name: "@repo/core", dir: "packages/core", kind: "package" },
      ]);
    });

    it("should skip entries without package.json", async () => {
      vi.mocked(access).mockResolvedValue(undefined);

      vi.mocked(readdir)
        .mockResolvedValueOnce([dirEntry("web", true), dirEntry("no-pkg", true)] as any) // readdir: apps/
        .mockResolvedValueOnce([] as any) // readdir: packages/ (empty)
        .mockResolvedValue([] as any); // buildFileTree calls

      vi.mocked(readJsonFile)
        .mockResolvedValueOnce({ name: "@repo/web" }) // apps/web/package.json
        .mockResolvedValueOnce(null) // apps/no-pkg/package.json (missing)
        .mockResolvedValueOnce({ name: "root" }); // root package.json

      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const result = await buildProjectContextSnapshot("/project");

      expect(result.graph.packages).toEqual([
        { name: "@repo/web", dir: "apps/web", kind: "app" },
      ]);
    });

    it("should collect dependencies from all dep fields", async () => {
      vi.mocked(access)
        .mockResolvedValueOnce(undefined) // access: apps/ exists
        .mockRejectedValueOnce(new Error("ENOENT")); // access: packages/ missing

      vi.mocked(readdir)
        .mockResolvedValueOnce([dirEntry("web", true)] as any) // readdir: apps/
        .mockResolvedValue([] as any); // buildFileTree calls

      vi.mocked(readJsonFile)
        .mockResolvedValueOnce({ // apps/web/package.json
          name: "@repo/web",
          dependencies: { react: "19", "@repo/core": "*" },
          devDependencies: { vitest: "1", "@repo/core": "*" },
          peerDependencies: { typescript: "5" },
        })
        .mockResolvedValueOnce({ name: "root" }); // root package.json

      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const result = await buildProjectContextSnapshot("/project");

      // Internal edges: @repo/core appears in deps and devDeps but should be deduplicated
      // The edges show internal dependencies only
      // There's only @repo/web, and @repo/core is NOT in packages, so edge.to should be empty
      expect(result.graph.edges).toEqual([
        { from: "@repo/web", to: [] },
      ]);

      // But the markdown should contain workspace summary showing the package
      expect(result.markdown).toContain("@repo/web");
    });
  });

  describe("formatWorkspaceGraph", () => {
    it("should handle empty packages list", async () => {
      // No apps or packages dirs
      vi.mocked(access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(readdir).mockResolvedValue([] as any);
      vi.mocked(readJsonFile).mockResolvedValue(null);
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const result = await buildProjectContextSnapshot("/project");

      expect(result.markdown).toContain("No workspace packages detected.");
    });
  });

  describe("buildFileTree", () => {
    it("should exclude CONTEXT_EXCLUDE_DIRS entries", async () => {
      vi.mocked(access).mockRejectedValue(new Error("ENOENT"));

      vi.mocked(readdir)
        .mockResolvedValueOnce([
          dirEntry("src", true),
          dirEntry("node_modules", true),
          dirEntry(".git", true),
          dirEntry("dist", true),
          dirEntry("README.md", false),
        ] as any)
        .mockResolvedValue([] as any);

      vi.mocked(readJsonFile).mockResolvedValue({ name: "root" });
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const result = await buildProjectContextSnapshot("/project");
      const topNames = result.graph.fileTree.map((n) => n.name);

      expect(topNames).toContain("src");
      expect(topNames).toContain("README.md");
      expect(topNames).not.toContain("node_modules");
      expect(topNames).not.toContain(".git");
      expect(topNames).not.toContain("dist");
    });

    it("should respect depth limit", async () => {
      vi.mocked(access).mockRejectedValue(new Error("ENOENT"));

      // Root level: one deep dir chain
      // Root readdir
      vi.mocked(readdir)
        .mockResolvedValueOnce([dirEntry("a", true)] as any) // root
        .mockResolvedValueOnce([dirEntry("b", true)] as any) // a/
        .mockResolvedValueOnce([dirEntry("c", true)] as any) // a/b/
        .mockResolvedValueOnce([dirEntry("d", true)] as any) // a/b/c/
        .mockResolvedValueOnce([dirEntry("e", true)] as any) // a/b/c/d/
        .mockResolvedValueOnce([dirEntry("f", true)] as any) // a/b/c/d/e/ (depth=5, recurse at depth-1=4)
        .mockResolvedValue([] as any);

      vi.mocked(readJsonFile).mockResolvedValue(null);
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const result = await buildProjectContextSnapshot("/project");

      // DEFAULT_TREE_DEPTH is 5. At depth=0, directories have no children (undefined).
      // depth=5 -> root level, children recurse at depth=4, then 3, 2, 1, 0
      // At depth=0: dir is listed but children is undefined
      const tree = result.graph.fileTree;
      // Navigate the chain
      let node = tree[0]; // a
      expect(node?.name).toBe("a");
      expect(node?.children).toBeDefined(); // depth 4

      node = node!.children![0]; // b
      expect(node?.name).toBe("b");
      expect(node?.children).toBeDefined(); // depth 3

      node = node!.children![0]; // c
      expect(node?.name).toBe("c");
      expect(node?.children).toBeDefined(); // depth 2

      node = node!.children![0]; // d
      expect(node?.name).toBe("d");
      expect(node?.children).toBeDefined(); // depth 1

      node = node!.children![0]; // e
      expect(node?.name).toBe("e");
      expect(node?.children).toBeDefined(); // depth 0 still enters since depth > 0 check

      node = node!.children![0]; // f
      expect(node?.name).toBe("f");
      // At depth=0 for f's dir, children is undefined (depth > 0 is false)
      expect(node?.children).toBeUndefined();
    });

    it("should handle symlink cycles via visited set", async () => {
      vi.mocked(access).mockRejectedValue(new Error("ENOENT"));

      vi.mocked(readdir)
        .mockResolvedValueOnce([dirEntry("link-dir", true)] as any) // root
        .mockResolvedValueOnce([dirEntry("child", true)] as any) // link-dir/
        .mockResolvedValue([] as any);

      vi.mocked(realpath)
        .mockResolvedValueOnce("/project") // realpath: root dir
        .mockResolvedValueOnce("/project"); // realpath: link-dir -> resolves to root (cycle!)

      vi.mocked(readJsonFile).mockResolvedValue(null);
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const result = await buildProjectContextSnapshot("/project");

      // link-dir should not be traversed since its realpath was already visited
      // The tree should be empty because root's readdir returned link-dir,
      // but link-dir is a directory. It will be added as a dir node, but
      // its children will be empty because the recursive call returns [] due to visited check.
      expect(result.graph.fileTree).toEqual([
        {
          name: "link-dir",
          path: "link-dir",
          type: "dir",
          children: [],
        },
      ]);
    });
  });

  describe("formatFileTree", () => {
    it("should render nested directory structure in markdown", async () => {
      vi.mocked(access).mockRejectedValue(new Error("ENOENT"));

      vi.mocked(readdir)
        .mockResolvedValueOnce([
          dirEntry("src", true),
          dirEntry("readme.md", false),
        ] as any)
        .mockResolvedValueOnce([
          dirEntry("index.ts", false),
        ] as any)
        .mockResolvedValue([] as any);

      vi.mocked(readJsonFile).mockResolvedValue(null);
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const result = await buildProjectContextSnapshot("/project");

      // formatFileTree output is in the markdown under "## File Tree"
      const fileTreeSection = result.markdown.split("## File Tree")[1] ?? "";
      expect(fileTreeSection).toContain("- src/");
      expect(fileTreeSection).toContain("  - index.ts");
      expect(fileTreeSection).toContain("- readme.md");
    });
  });
});
