import { z } from "zod";

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
  })
);

export const ProjectContextGraphSchema = z.object({
  generatedAt: z.string(),
  root: z.string(),
  packages: z.array(
    z.object({
      name: z.string(),
      dir: z.string(),
      kind: z.enum(["app", "package"]),
    })
  ),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.array(z.string()),
    })
  ),
  fileTree: z.array(FileTreeNodeSchema),
  changedFiles: z.array(
    z.object({
      filePath: z.string(),
      operation: z.string(),
      additions: z.number(),
      deletions: z.number(),
    })
  ),
});
export type ProjectContextGraph = z.infer<typeof ProjectContextGraphSchema>;

export const ProjectContextMetaSchema = z.object({
  generatedAt: z.string(),
  root: z.string(),
  statusHash: z.string(),
  charCount: z.number(),
});
export type ProjectContextMeta = z.infer<typeof ProjectContextMetaSchema>;

export const ProjectContextSnapshotSchema = z.object({
  markdown: z.string(),
  graph: ProjectContextGraphSchema,
  meta: ProjectContextMetaSchema,
});
export type ProjectContextSnapshot = z.infer<typeof ProjectContextSnapshotSchema>;
