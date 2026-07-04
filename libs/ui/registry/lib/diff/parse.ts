/** Change kind for a parsed unified diff line. */
export type ChangeType = "add" | "remove" | "context";

/** One parsed line from a diff hunk. */
export interface DiffChange {
  /** Whether the line was added, removed, or kept as context. */
  type: ChangeType;
  /** Line content without the unified diff prefix. */
  content: string;
  /** Old-file line number, or null for added lines. */
  oldLine: number | null;
  /** New-file line number, or null for removed lines. */
  newLine: number | null;
}

/** Parsed hunk metadata and changes from a unified diff. */
export interface DiffHunk {
  /** Starting line in the old file. */
  oldStart: number;
  /** Number of old-file lines covered by the hunk. */
  oldCount: number;
  /** Starting line in the new file. */
  newStart: number;
  /** Number of new-file lines covered by the hunk. */
  newCount: number;
  /** Optional hunk heading after the @@ range marker. */
  heading: string;
  /** Parsed changes contained by the hunk. */
  changes: DiffChange[];
}

/** Parsed diff for one file. */
export interface ParsedDiff {
  /** Old file path when present in the patch header. */
  oldPath: string | null;
  /** New file path when present in the patch header. */
  newPath: string | null;
  /** Hunks parsed for this file. */
  hunks: DiffHunk[];
}

/** Diff input supplied as a unified patch string. */
export interface DiffInputPatch {
  /** Unified diff string. */
  patch: string;
  /** Mutually exclusive with patch input. */
  diff?: never;
  /** Mutually exclusive with patch input. */
  before?: never;
  /** Mutually exclusive with patch input. */
  after?: never;
}
/** Diff input supplied as before/after text. */
export interface DiffInputCompare {
  /** Old text. */
  before: string;
  /** New text. */
  after: string;
  /** Mutually exclusive with before/after input. */
  patch?: never;
  /** Mutually exclusive with before/after input. */
  diff?: never;
}
/** Diff input supplied as already parsed data. */
export interface DiffInputParsed {
  /** Pre-parsed diff data. */
  diff: ParsedDiff;
  /** Mutually exclusive with parsed diff input. */
  patch?: never;
  /** Mutually exclusive with parsed diff input. */
  before?: never;
  /** Mutually exclusive with parsed diff input. */
  after?: never;
}
/** Accepted diff input shapes for DiffView and diff utilities. */
export type DiffInput = DiffInputPatch | DiffInputCompare | DiffInputParsed;

const HUNK_RE = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/;

const SKIP_RE =
  /^(index |new file mode|deleted file mode|old mode|new mode|similarity index|rename from|rename to|Binary files|copy from|copy to)/;

function normalizeDiffPath(path: string): string | null {
  return path === "/dev/null" ? null : path;
}

/** Parses a unified diff string into per-file diff objects. */
export function parseDiff(patch: string): ParsedDiff[] {
  const lines = patch.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const files: ParsedDiff[] = [];
  let current: ParsedDiff | null = null;
  let hunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;
  let remainingOldLines = 0;
  let remainingNewLines = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      if (current) files.push(current);
      current = { oldPath: null, newPath: null, hunks: [] };
      hunk = null;
      remainingOldLines = 0;
      remainingNewLines = 0;
      continue;
    }

    if (hunk && (remainingOldLines > 0 || remainingNewLines > 0)) {
      if (line.startsWith("\\")) continue;

      if (line.startsWith("-") && remainingOldLines > 0) {
        hunk.changes.push({ type: "remove", content: line.slice(1), oldLine, newLine: null });
        oldLine++;
        remainingOldLines--;
        continue;
      }
      if (line.startsWith("+") && remainingNewLines > 0) {
        hunk.changes.push({ type: "add", content: line.slice(1), oldLine: null, newLine });
        newLine++;
        remainingNewLines--;
        continue;
      }
      if (remainingOldLines > 0 && remainingNewLines > 0) {
        const content = line.startsWith(" ") ? line.slice(1) : line;
        hunk.changes.push({ type: "context", content, oldLine, newLine });
        oldLine++;
        newLine++;
        remainingOldLines--;
        remainingNewLines--;
      }
      continue;
    }

    if (SKIP_RE.test(line)) continue;

    if (line.startsWith("--- ")) {
      if (!current) current = { oldPath: null, newPath: null, hunks: [] };
      current.oldPath = normalizeDiffPath(line.replace(/^---\s+(?:a\/)?/, ""));
      continue;
    }
    if (line.startsWith("+++ ")) {
      if (!current) current = { oldPath: null, newPath: null, hunks: [] };
      current.newPath = normalizeDiffPath(line.replace(/^\+\+\+\s+(?:b\/)?/, ""));
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
        heading: (m[5] ?? "").trim(),
        changes: [],
      };
      current.hunks.push(hunk);
      oldLine = hunk.oldStart;
      newLine = hunk.newStart;
      remainingOldLines = hunk.oldCount;
      remainingNewLines = hunk.newCount;
    }
  }

  if (current) files.push(current);

  return files;
}
