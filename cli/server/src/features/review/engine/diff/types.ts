export type DiffOperation = "add" | "modify" | "delete" | "rename";
export type DiffLineType = "addition" | "deletion" | "hunk-header" | "file-header" | "context";

/** Server-side hunk for multi-file analysis. @see libs/ui/registry/lib/diff/parse.ts for the UI-oriented single-file variant. */
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

/** Server-side parsed diff (multi-file with stats). @see libs/ui/registry/lib/diff/parse.ts for the UI-oriented single-file variant. */
export interface ParsedDiff {
  files: FileDiff[];
  totalStats: {
    filesChanged: number;
    additions: number;
    deletions: number;
    totalSizeBytes: number;
  };
}
