import { describe, expect, it } from "vitest";
import {
  MAX_CONTEXT_MARKDOWN_BYTES,
  MAX_CONTEXT_TREE_DEPTH,
  MAX_CONTEXT_TREE_NODES,
  ProjectContextGraphSchema,
  ProjectContextSnapshotSchema,
  ReviewContextResponseSchema,
  validateBoundedFileTree,
} from "./context.js";

function flatFileTree(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `file-${index}.ts`,
    path: `src/file-${index}.ts`,
    type: "file" as const,
  }));
}

function nestedFileTree(depth: number) {
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
  for (let level = depth - 1; level > 0; level -= 1) {
    node = {
      name: `dir-${level}`,
      path: `dir-${level}`,
      type: "dir",
      children: [node],
    };
  }
  return [node];
}

describe("validateBoundedFileTree", () => {
  it("accepts a tree within node and depth limits", () => {
    expect(validateBoundedFileTree(flatFileTree(10))).toBe(true);
    expect(validateBoundedFileTree(nestedFileTree(5))).toBe(true);
  });

  it("rejects a flat tree above the node cap", () => {
    expect(validateBoundedFileTree(flatFileTree(MAX_CONTEXT_TREE_NODES + 1))).toBe(false);
  });

  it("rejects a deeply nested tree above the depth cap", () => {
    expect(validateBoundedFileTree(nestedFileTree(MAX_CONTEXT_TREE_DEPTH + 1))).toBe(false);
  });
});

describe("ProjectContextGraphSchema", () => {
  const baseGraph = {
    generatedAt: "2025-01-01",
    root: "/project",
    packages: [],
    edges: [],
    fileTree: [],
    changedFiles: [],
  };

  it("rejects an oversized flat file tree", () => {
    const result = ProjectContextGraphSchema.safeParse({
      ...baseGraph,
      fileTree: flatFileTree(MAX_CONTEXT_TREE_NODES + 1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a deeply nested file tree", () => {
    const result = ProjectContextGraphSchema.safeParse({
      ...baseGraph,
      fileTree: nestedFileTree(MAX_CONTEXT_TREE_DEPTH + 1),
    });
    expect(result.success).toBe(false);
  });
});

describe("ProjectContextSnapshotSchema", () => {
  const baseSnapshot = {
    markdown: "# context",
    graph: {
      generatedAt: "2025-01-01",
      root: "/project",
      packages: [],
      edges: [],
      fileTree: [],
      changedFiles: [],
    },
    meta: {
      generatedAt: "2025-01-01",
      root: "/project",
      statusHash: "hash",
      statusHashKind: "full" as const,
      charCount: 10,
    },
  };

  it("rejects markdown above the byte cap", () => {
    const result = ProjectContextSnapshotSchema.safeParse({
      ...baseSnapshot,
      markdown: "x".repeat(MAX_CONTEXT_MARKDOWN_BYTES + 1),
    });
    expect(result.success).toBe(false);
  });
});

describe("ReviewContextResponseSchema", () => {
  const baseResponse = {
    text: "context",
    markdown: "# context",
    graph: {
      generatedAt: "2025-01-01",
      root: "/project",
      packages: [],
      edges: [],
      fileTree: [],
      changedFiles: [],
    },
    meta: {
      generatedAt: "2025-01-01",
      root: "/project",
      statusHash: "hash",
      statusHashKind: "full" as const,
      charCount: 10,
    },
  };

  it("accepts text and markdown at the writer's byte cap", () => {
    const atCap = "x".repeat(MAX_CONTEXT_MARKDOWN_BYTES);
    const result = ReviewContextResponseSchema.safeParse({
      ...baseResponse,
      text: atCap,
      markdown: atCap,
    });
    expect(result.success).toBe(true);
  });

  it.each(["text", "markdown"] as const)("rejects %s above the byte cap", (field) => {
    const result = ReviewContextResponseSchema.safeParse({
      ...baseResponse,
      [field]: "x".repeat(MAX_CONTEXT_MARKDOWN_BYTES + 1),
    });
    expect(result.success).toBe(false);
  });
});
