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

function decodeQuotedDiffPath(path: string): string {
  const bytes: number[] = [];
  const encoder = new TextEncoder();

  for (let index = 0; index < path.length; index++) {
    const character = path[index];
    if (character !== "\\") {
      const codePoint = path.codePointAt(index);
      if (codePoint === undefined) continue;
      const value = String.fromCodePoint(codePoint);
      bytes.push(...encoder.encode(value));
      index += value.length - 1;
      continue;
    }

    const escaped = path[index + 1];
    if (escaped === "\\" || escaped === '"') {
      bytes.push(escaped.charCodeAt(0));
      index++;
      continue;
    }
    if (escaped === "t" || escaped === "n" || escaped === "r") {
      if (escaped === "t") bytes.push(0x09);
      if (escaped === "n") bytes.push(0x0a);
      if (escaped === "r") bytes.push(0x0d);
      index++;
      continue;
    }
    const octal = path.slice(index + 1, index + 4);
    if (/^[0-7]{3}$/.test(octal)) {
      bytes.push(Number.parseInt(octal, 8));
      index += 3;
      continue;
    }
    bytes.push(0x5c);
  }

  return new TextDecoder().decode(Uint8Array.from(bytes));
}

function readQuotedPath(header: string): string | null {
  for (let index = 1; index < header.length; index++) {
    if (header[index] === "\\") {
      index++;
      continue;
    }
    if (header[index] !== '"') continue;
    const suffix = header.slice(index + 1);
    if (suffix.length > 0 && !suffix.startsWith("\t")) return null;
    return decodeQuotedDiffPath(header.slice(1, index));
  }
  return null;
}

/**
 * An unquoted header's first tab starts its timestamp. Git C-quoted paths instead decode escaped or
 * literal tabs inside the closing quote before an optional tab-separated timestamp is discarded.
 */
function parseDiffHeaderPath(header: string, gitPrefix: "a/" | "b/"): string | null {
  const quotedPath = header.startsWith('"') ? readQuotedPath(header) : null;
  const pathWithPrefix = quotedPath ?? header.split("\t", 1)[0] ?? "";
  const path = pathWithPrefix.startsWith(gitPrefix)
    ? pathWithPrefix.slice(gitPrefix.length)
    : pathWithPrefix;
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
  let hasHeaderPair = false;
  let hasPendingOldHeader = false;
  let pendingOldPath: string | null = null;

  const startFile = (): ParsedDiff => ({ oldPath: null, newPath: null, hunks: [] });

  const finishCurrentFile = (): void => {
    if (current) files.push(current);
    current = null;
    hunk = null;
    remainingOldLines = 0;
    remainingNewLines = 0;
    hasHeaderPair = false;
  };

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      finishCurrentFile();
      current = startFile();
      hasPendingOldHeader = false;
      pendingOldPath = null;
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
      pendingOldPath = parseDiffHeaderPath(line.slice(4), "a/");
      hasPendingOldHeader = true;
      continue;
    }
    if (line.startsWith("+++ ")) {
      const nextNewPath = parseDiffHeaderPath(line.slice(4), "b/");
      if (hasPendingOldHeader) {
        if (current && (hasHeaderPair || current.hunks.length > 0)) finishCurrentFile();
        current ??= startFile();
        current.oldPath = pendingOldPath;
        current.newPath = nextNewPath;
        hasHeaderPair = true;
        hasPendingOldHeader = false;
        pendingOldPath = null;
      } else {
        current ??= startFile();
        current.newPath = nextNewPath;
      }
      continue;
    }

    const m = HUNK_RE.exec(line);
    if (m) {
      if (!current) current = startFile();
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
