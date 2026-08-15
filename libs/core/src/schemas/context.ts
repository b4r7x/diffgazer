import { z } from "zod";
import { utf8ByteLength } from "../redaction.js";

/** Writer caps markdown at 50 KiB plus a short truncation marker. */
export const MAX_CONTEXT_MARKDOWN_BYTES = 52_288;
/** Pretty-printed graph JSON for up to 1k tree nodes plus workspace metadata. */
export const MAX_CONTEXT_GRAPH_JSON_BYTES = 512 * 1024;
export const MAX_CONTEXT_META_JSON_BYTES = 8 * 1024;
export const MAX_CONTEXT_MANIFEST_JSON_BYTES = 4 * 1024;
export const MAX_CONTEXT_TREE_NODES = 1_000;
export const MAX_CONTEXT_TREE_DEPTH = 32;
export const MAX_CONTEXT_PACKAGES = 4_096;
export const MAX_CONTEXT_EDGES = 4_096;
export const MAX_CONTEXT_EDGE_TARGETS = 64;
export const MAX_CONTEXT_CHANGED_FILES = 4_096;
export const MAX_CONTEXT_JSON_DEPTH = 32;

export type FileTreeNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileTreeNode[];
};

export const FileTreeNodeSchema: z.ZodType<FileTreeNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    type: z.enum(["file", "dir"]),
    children: z.array(FileTreeNodeSchema).optional(),
  }),
);

export function validateBoundedFileTree(nodes: unknown): nodes is FileTreeNode[] {
  if (!Array.isArray(nodes)) return false;
  if (nodes.length > MAX_CONTEXT_TREE_NODES) return false;

  const queue: Array<{ node: unknown; depth: number }> = nodes.map((node) => ({ node, depth: 1 }));
  let nodeCount = 0;

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    const { node, depth } = item;
    if (depth > MAX_CONTEXT_TREE_DEPTH) return false;
    if (typeof node !== "object" || node === null) return false;

    const record = node as Record<string, unknown>;
    if (typeof record.name !== "string" || typeof record.path !== "string") return false;
    if (record.type !== "file" && record.type !== "dir") return false;

    nodeCount += 1;
    if (nodeCount > MAX_CONTEXT_TREE_NODES) return false;

    if (record.children === undefined) continue;
    if (!Array.isArray(record.children)) return false;
    for (const child of record.children) {
      queue.push({ node: child, depth: depth + 1 });
    }
  }

  return true;
}

export const ProjectContextGraphSchema = z
  .object({
    generatedAt: z.string(),
    root: z.string(),
    packages: z
      .array(
        z.object({
          name: z.string(),
          dir: z.string(),
          kind: z.enum(["app", "package"]),
        }),
      )
      .max(MAX_CONTEXT_PACKAGES),
    edges: z
      .array(
        z.object({
          from: z.string(),
          to: z.array(z.string()).max(MAX_CONTEXT_EDGE_TARGETS),
        }),
      )
      .max(MAX_CONTEXT_EDGES),
    fileTree: z.array(FileTreeNodeSchema),
    changedFiles: z
      .array(
        z.object({
          filePath: z.string(),
          operation: z.string(),
          additions: z.number(),
          deletions: z.number(),
        }),
      )
      .max(MAX_CONTEXT_CHANGED_FILES),
  })
  .superRefine((data, ctx) => {
    if (!validateBoundedFileTree(data.fileTree)) {
      ctx.addIssue({
        code: "custom",
        message: "fileTree exceeds bounded node or depth limits",
        path: ["fileTree"],
      });
    }
  });
export type ProjectContextGraph = z.infer<typeof ProjectContextGraphSchema>;

export const ProjectContextMetaSchema = z.object({
  generatedAt: z.string(),
  root: z.string(),
  statusHash: z.string(),
  statusHashKind: z.enum(["full", "status-only", "unavailable"]),
  headCommit: z.string().optional(),
  charCount: z.number(),
});
export type ProjectContextMeta = z.infer<typeof ProjectContextMetaSchema>;

export const ReviewContextResponseSchema = z
  .object({
    text: z.string(),
    markdown: z.string(),
    graph: ProjectContextGraphSchema,
    meta: ProjectContextMetaSchema,
  })
  .superRefine((data, ctx) => {
    // `text` is the plain-text rendering of the same markdown, so both carry the
    // writer's cap and the read budget can charge for it twice.
    for (const field of ["text", "markdown"] as const) {
      if (utf8ByteLength(data[field]) > MAX_CONTEXT_MARKDOWN_BYTES) {
        ctx.addIssue({
          code: "custom",
          message: `${field} exceeds bounded byte limit`,
          path: [field],
        });
      }
    }
  });
export type ReviewContextResponse = z.infer<typeof ReviewContextResponseSchema>;

const ProjectContextSnapshotArtifactSchema = z.object({
  file: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export const ProjectContextSnapshotManifestSchema = z.object({
  version: z.literal(1),
  generation: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  artifacts: z.object({
    markdown: ProjectContextSnapshotArtifactSchema,
    graph: ProjectContextSnapshotArtifactSchema,
    meta: ProjectContextSnapshotArtifactSchema,
  }),
});
export type ProjectContextSnapshotManifest = z.infer<typeof ProjectContextSnapshotManifestSchema>;

export const ProjectContextSnapshotSchema = z
  .object({
    markdown: z.string(),
    graph: ProjectContextGraphSchema,
    meta: ProjectContextMetaSchema,
  })
  .superRefine((data, ctx) => {
    if (utf8ByteLength(data.markdown) > MAX_CONTEXT_MARKDOWN_BYTES) {
      ctx.addIssue({
        code: "custom",
        message: "markdown exceeds bounded byte limit",
        path: ["markdown"],
      });
    }
  });
export type ProjectContextSnapshot = z.infer<typeof ProjectContextSnapshotSchema>;
