import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MAX_CONTEXT_GRAPH_JSON_BYTES,
  MAX_CONTEXT_MARKDOWN_BYTES,
  MAX_CONTEXT_TREE_DEPTH,
  MAX_CONTEXT_TREE_NODES,
} from "@diffgazer/core/schemas/context";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadContextSnapshot } from "./snapshot/artifacts.js";
import {
  sha256,
  snapshotArtifactNames,
  writeJson,
  writeSnapshotFixture,
} from "./testing/snapshot-fixtures.js";

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "diffgazer-context-"));
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

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

  it("rejects oversized markdown artifacts before hashing", async () => {
    const contextDir = join(projectRoot, ".diffgazer");
    const generation = "oversized-markdown";
    const names = snapshotArtifactNames(generation);
    const oversizedMarkdown = "x".repeat(MAX_CONTEXT_MARKDOWN_BYTES + 1);
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
      charCount: oversizedMarkdown.length,
    };
    const graphContent = JSON.stringify(graph, null, 2);
    const metaContent = JSON.stringify(meta, null, 2);
    await mkdir(contextDir, { recursive: true });
    await writeFile(join(contextDir, names.markdown), oversizedMarkdown, "utf-8");
    await writeFile(join(contextDir, names.graph), graphContent, "utf-8");
    await writeFile(join(contextDir, names.meta), metaContent, "utf-8");
    await writeJson(join(contextDir, "context.manifest.json"), {
      version: 1,
      generation,
      artifacts: {
        markdown: { file: names.markdown, sha256: sha256(oversizedMarkdown) },
        graph: { file: names.graph, sha256: sha256(graphContent) },
        meta: { file: names.meta, sha256: sha256(metaContent) },
      },
    });

    await expect(loadContextSnapshot(contextDir)).resolves.toBeNull();
  });

  it("rejects a flat file tree above the node cap", async () => {
    const contextDir = join(projectRoot, ".diffgazer");
    const oversizedTree = Array.from({ length: MAX_CONTEXT_TREE_NODES + 1 }, (_, index) => ({
      name: `file-${index}.ts`,
      path: `src/file-${index}.ts`,
      type: "file" as const,
    }));
    await writeSnapshotFixture(contextDir, {
      markdown: "# cached",
      graph: {
        generatedAt: "2025-01-01",
        root: projectRoot,
        packages: [],
        edges: [],
        fileTree: oversizedTree,
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

    await expect(loadContextSnapshot(contextDir)).resolves.toBeNull();
  });

  it("rejects a deeply nested file tree above the depth cap", async () => {
    const contextDir = join(projectRoot, ".diffgazer");
    let node: {
      name: string;
      path: string;
      type: "dir";
      children: unknown[];
    } = {
      name: "leaf",
      path: "leaf",
      type: "dir",
      children: [],
    };
    for (let depth = MAX_CONTEXT_TREE_DEPTH; depth > 0; depth -= 1) {
      node = {
        name: `dir-${depth}`,
        path: `dir-${depth}`,
        type: "dir",
        children: [node],
      };
    }
    await writeSnapshotFixture(contextDir, {
      markdown: "# cached",
      graph: {
        generatedAt: "2025-01-01",
        root: projectRoot,
        packages: [],
        edges: [],
        fileTree: [node],
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

    await expect(loadContextSnapshot(contextDir)).resolves.toBeNull();
  });

  it("rejects oversized graph JSON before parsing", async () => {
    const contextDir = join(projectRoot, ".diffgazer");
    const generation = "oversized-graph";
    const names = snapshotArtifactNames(generation);
    const markdown = "# cached";
    const graphRaw = JSON.stringify({
      generatedAt: "2025-01-01",
      root: projectRoot,
      packages: [],
      edges: [],
      fileTree: [],
      changedFiles: [],
      padding: "a".repeat(MAX_CONTEXT_GRAPH_JSON_BYTES),
    });
    const meta = {
      generatedAt: "2025-01-01",
      root: projectRoot,
      statusHash: "hash-1",
      statusHashKind: "full",
      charCount: markdown.length,
    };
    const metaContent = JSON.stringify(meta, null, 2);
    await mkdir(contextDir, { recursive: true });
    await writeFile(join(contextDir, names.markdown), markdown, "utf-8");
    await writeFile(join(contextDir, names.graph), graphRaw, "utf-8");
    await writeFile(join(contextDir, names.meta), metaContent, "utf-8");
    await writeJson(join(contextDir, "context.manifest.json"), {
      version: 1,
      generation,
      artifacts: {
        markdown: { file: names.markdown, sha256: sha256(markdown) },
        graph: { file: names.graph, sha256: sha256(graphRaw) },
        meta: { file: names.meta, sha256: sha256(metaContent) },
      },
    });

    await expect(loadContextSnapshot(contextDir)).resolves.toBeNull();
  });
});
