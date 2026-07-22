import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { FileTreeNode } from "@diffgazer/core/schemas/context";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildFileTree, MAX_TREE_NODES } from "./file-tree.js";

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "diffgazer-file-tree-"));
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

async function writeProjectFile(relativePath: string, content = ""): Promise<void> {
  const absolutePath = join(projectRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf-8");
}

function collectNames(nodes: FileTreeNode[], names: Set<string> = new Set()): Set<string> {
  for (const node of nodes) {
    names.add(node.name);
    if (node.children) collectNames(node.children, names);
  }
  return names;
}

function countNodes(nodes: FileTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.children) count += countNodes(node.children);
  }
  return count;
}

describe("buildFileTree", () => {
  it("represents every top-level directory before a heavy early-sorting subtree exhausts the budget", async () => {
    // A Python-repo-shaped fixture: an unexcludable heavy dir that sorts early
    // ("aaa-heavy" < "src") plus real source directories. A depth-first walker
    // would spend the whole budget inside the heavy subtree before reaching src.
    for (let i = 0; i < 1500; i++) {
      await writeProjectFile(`aaa-heavy/lib/pkg/file-${String(i).padStart(4, "0")}.py`);
    }
    await writeProjectFile("src/index.ts");
    await writeProjectFile("tests/test_main.py");
    await writeProjectFile("docs/readme.md");

    const counter = { count: 0, truncated: false };
    const tree = await buildFileTree(projectRoot, { depth: 5, counter });

    const topLevel = tree.map((node) => node.name);
    expect(topLevel).toEqual(expect.arrayContaining(["aaa-heavy", "docs", "src", "tests"]));
    expect(counter.truncated).toBe(true);
    expect(countNodes(tree)).toBeLessThanOrEqual(MAX_TREE_NODES);
  });

  it("excludes common ecosystem dependency and build directories", async () => {
    await writeProjectFile(".git/config");
    await writeProjectFile(".venv/lib/site-packages/django/__init__.py");
    await writeProjectFile("__pycache__/main.cpython-312.pyc");
    await writeProjectFile(".mypy_cache/cache.json");
    await writeProjectFile("target/debug/app");
    await writeProjectFile("vendor/bundle/gem");
    await writeProjectFile(".idea/workspace.xml");
    await writeProjectFile("Pods/Manifest.lock");
    await writeProjectFile("node_modules/react/index.js");
    await writeProjectFile("src/main.py");

    const tree = await buildFileTree(projectRoot, {
      depth: 5,
      counter: { count: 0, truncated: false },
    });

    const names = collectNames(tree);
    for (const excluded of [
      ".git",
      ".venv",
      "__pycache__",
      ".mypy_cache",
      "target",
      "vendor",
      ".idea",
      "Pods",
      "node_modules",
    ]) {
      expect(names.has(excluded)).toBe(false);
    }
    expect(names.has("src")).toBe(true);
    expect(names.has("main.py")).toBe(true);
  });

  it("renders a directory symlink as a file leaf without traversing it", async () => {
    await writeProjectFile("src/nested/file.ts");
    await symlink(projectRoot, join(projectRoot, "src", "nested", "root-link"), "dir");

    const counter = { count: 0, truncated: false };
    const tree = await buildFileTree(projectRoot, { depth: 5, counter });

    expect(tree).toEqual([
      {
        name: "src",
        path: "src",
        type: "dir",
        children: [
          {
            name: "nested",
            path: "src/nested",
            type: "dir",
            children: [
              { name: "file.ts", path: "src/nested/file.ts", type: "file" },
              { name: "root-link", path: "src/nested/root-link", type: "file" },
            ],
          },
        ],
      },
    ]);
    expect(counter.truncated).toBe(false);
  });

  it("enforces the node budget cap", async () => {
    for (let i = 0; i < MAX_TREE_NODES + 200; i++) {
      await writeProjectFile(`files/file-${String(i).padStart(4, "0")}.ts`);
    }

    const counter = { count: 0, truncated: false };
    const tree = await buildFileTree(projectRoot, { depth: 5, counter });

    expect(counter.truncated).toBe(true);
    expect(counter.count).toBe(MAX_TREE_NODES);
    expect(countNodes(tree)).toBeLessThanOrEqual(MAX_TREE_NODES);
  });
});
