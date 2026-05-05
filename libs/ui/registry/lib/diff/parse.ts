export type ChangeType = "add" | "remove" | "context";

export interface DiffChange {
  type: ChangeType;
  content: string;
  oldLine: number | null;
  newLine: number | null;
}

/** UI-oriented hunk for single-file rendering. @see diffgazer/apps/server/src/shared/lib/diff/types.ts for the server-side multi-file variant. */
export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  heading: string;
  changes: DiffChange[];
}

/** UI-oriented parsed diff (single-file). @see diffgazer/apps/server/src/shared/lib/diff/types.ts for the server-side multi-file variant. */
export interface ParsedDiff {
  oldPath: string | null;
  newPath: string | null;
  hunks: DiffHunk[];
}

export interface DiffInputPatch { patch: string; diff?: never; before?: never; after?: never; }
export interface DiffInputCompare { before: string; after: string; patch?: never; diff?: never; }
export interface DiffInputParsed { diff: ParsedDiff; patch?: never; before?: never; after?: never; }
export type DiffInput = DiffInputPatch | DiffInputCompare | DiffInputParsed;

const HUNK_RE = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/;

const SKIP_RE = /^(index |new file mode|deleted file mode|old mode|new mode|similarity index|rename from|rename to|Binary files|copy from|copy to)/;

export function parseDiff(patch: string): ParsedDiff[] {
  const lines = patch.split("\n");
  const files: ParsedDiff[] = [];
  let current: ParsedDiff | null = null;
  let hunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      if (current) files.push(current);
      current = { oldPath: null, newPath: null, hunks: [] };
      hunk = null;
      continue;
    }

    if (SKIP_RE.test(line)) continue;

    if (line.startsWith("--- ")) {
      if (!current) current = { oldPath: null, newPath: null, hunks: [] };
      current.oldPath = line.replace(/^---\s+(?:a\/)?/, "");
      continue;
    }
    if (line.startsWith("+++ ")) {
      if (!current) current = { oldPath: null, newPath: null, hunks: [] };
      current.newPath = line.replace(/^\+\+\+\s+(?:b\/)?/, "");
      continue;
    }

    const m = HUNK_RE.exec(line);
    if (m) {
      if (!current) current = { oldPath: null, newPath: null, hunks: [] };
      hunk = {
        oldStart: Number(m[1]),
        oldCount: Number(m[2] ?? 1),
        newStart: Number(m[3]),
        newCount: Number(m[4] ?? 1),
        heading: m[5].trim(),
        changes: [],
      };
      current.hunks.push(hunk);
      oldLine = hunk.oldStart;
      newLine = hunk.newStart;
      continue;
    }

    if (!hunk) continue;
    if (line.startsWith("\\")) continue;

    if (line.startsWith("-")) {
      hunk.changes.push({ type: "remove", content: line.slice(1), oldLine, newLine: null });
      oldLine++;
    } else if (line.startsWith("+")) {
      hunk.changes.push({ type: "add", content: line.slice(1), oldLine: null, newLine });
      newLine++;
    } else {
      const content = line.startsWith(" ") ? line.slice(1) : line;
      hunk.changes.push({ type: "context", content, oldLine, newLine });
      oldLine++;
      newLine++;
    }
  }

  if (current) files.push(current);

  return files;
}
