// Types for diff parsing - canonical source in packages/core/src/diff/types.ts
// Duplicated here to avoid circular dependency issues during server-side resolution

export type DiffOperation = "add" | "modify" | "delete" | "rename";
export type DiffLineType = "addition" | "deletion" | "hunk-header" | "file-header" | "context";

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  content: string;
}

export interface FileDiff {
  filePath: string;
  previousPath: string | null;
  operation: DiffOperation;
  hunks: DiffHunk[];
  rawDiff: string;
  stats: {
    additions: number;
    deletions: number;
    sizeBytes: number;
  };
}

export interface ParsedDiff {
  files: FileDiff[];
  totalStats: {
    filesChanged: number;
    additions: number;
    deletions: number;
    totalSizeBytes: number;
  };
}
