import type { Result } from "@repo/core";
import { ok, err } from "@repo/core";
import type { AppError } from "@repo/core";
import { createError } from "@repo/core";

export type PatchErrorCode =
  | "PARSE_ERROR"
  | "CONTEXT_MISMATCH"
  | "LINE_OUT_OF_RANGE"
  | "INVALID_HUNK";

export type PatchError = AppError<PatchErrorCode>;

interface ParsedHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: HunkLine[];
}

interface HunkLine {
  type: "context" | "add" | "remove";
  content: string;
}

const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function parseHunkHeader(line: string): ParsedHunk | null {
  const match = line.match(HUNK_HEADER_PATTERN);
  if (!match) return null;

  return {
    oldStart: parseInt(match[1] ?? "1", 10),
    oldCount: parseInt(match[2] ?? "1", 10),
    newStart: parseInt(match[3] ?? "1", 10),
    newCount: parseInt(match[4] ?? "1", 10),
    lines: [],
  };
}

function parseHunkLines(lines: string[]): HunkLine[] {
  const result: HunkLine[] = [];

  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      result.push({ type: "add", content: line.slice(1) });
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      result.push({ type: "remove", content: line.slice(1) });
    } else if (line.startsWith(" ") || line === "") {
      result.push({ type: "context", content: line.startsWith(" ") ? line.slice(1) : line });
    } else if (line.startsWith("\\")) {
      // "\ No newline at end of file" - skip
      continue;
    }
  }

  return result;
}

function parseUnifiedDiff(patch: string): Result<ParsedHunk[], PatchError> {
  const lines = patch.split("\n");
  const hunks: ParsedHunk[] = [];
  let currentHunk: ParsedHunk | null = null;
  let hunkLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    if (line.startsWith("@@")) {
      if (currentHunk) {
        currentHunk.lines = parseHunkLines(hunkLines);
        hunks.push(currentHunk);
      }

      currentHunk = parseHunkHeader(line);
      if (!currentHunk) {
        return err(createError("PARSE_ERROR", `Invalid hunk header at line ${i + 1}`, line));
      }
      hunkLines = [];
    } else if (currentHunk) {
      if (
        line.startsWith("diff ") ||
        line.startsWith("index ") ||
        line.startsWith("---") ||
        line.startsWith("+++")
      ) {
        continue;
      }
      hunkLines.push(line);
    }
  }

  if (currentHunk) {
    currentHunk.lines = parseHunkLines(hunkLines);
    hunks.push(currentHunk);
  }

  if (hunks.length === 0) {
    return err(createError("PARSE_ERROR", "No hunks found in patch"));
  }

  return ok(hunks);
}

function findContextMatch(
  fileLines: string[],
  hunkLines: HunkLine[],
  expectedStart: number,
  searchRadius: number = 10
): number | null {
  const contextLines = hunkLines
    .filter((l) => l.type === "context" || l.type === "remove")
    .slice(0, 3);

  if (contextLines.length === 0) {
    return expectedStart;
  }

  for (let offset = 0; offset <= searchRadius; offset++) {
    for (const direction of [0, 1, -1]) {
      const testStart = expectedStart + offset * direction;
      if (testStart < 0 || testStart >= fileLines.length) continue;

      let matches = true;
      for (let i = 0; i < contextLines.length && testStart + i < fileLines.length; i++) {
        const contextLine = contextLines[i];
        if (!contextLine) continue;
        if (fileLines[testStart + i] !== contextLine.content) {
          matches = false;
          break;
        }
      }

      if (matches) {
        return testStart;
      }
    }
  }

  return null;
}

function applyHunk(
  fileLines: string[],
  hunk: ParsedHunk,
  offset: number
): Result<{ newLines: string[]; newOffset: number }, PatchError> {
  const startLine = hunk.oldStart - 1 + offset;

  const matchedStart = findContextMatch(fileLines, hunk.lines, startLine);
  if (matchedStart === null) {
    return err(
      createError(
        "CONTEXT_MISMATCH",
        `Cannot find matching context for hunk at line ${hunk.oldStart}`,
        `Expected context not found near line ${startLine + 1}`
      )
    );
  }

  const actualOffset = matchedStart - (hunk.oldStart - 1);
  const newLines = [...fileLines];
  let lineIndex = matchedStart;
  const linesToRemove: number[] = [];
  const linesToAdd: Array<{ index: number; content: string }> = [];

  for (const hunkLine of hunk.lines) {
    switch (hunkLine.type) {
      case "context":
        lineIndex++;
        break;
      case "remove":
        if (lineIndex >= newLines.length) {
          return err(
            createError("LINE_OUT_OF_RANGE", `Line ${lineIndex + 1} is out of range`)
          );
        }
        linesToRemove.push(lineIndex);
        lineIndex++;
        break;
      case "add":
        linesToAdd.push({ index: lineIndex, content: hunkLine.content });
        break;
    }
  }

  for (let i = linesToRemove.length - 1; i >= 0; i--) {
    const removeIndex = linesToRemove[i];
    if (removeIndex !== undefined) {
      newLines.splice(removeIndex, 1);
    }
  }

  const addOffset = -linesToRemove.length;
  for (let i = 0; i < linesToAdd.length; i++) {
    const add = linesToAdd[i];
    if (add) {
      newLines.splice(add.index + addOffset + i, 0, add.content);
    }
  }

  const linesAdded = linesToAdd.length;
  const linesRemoved = linesToRemove.length;
  const newOffset = actualOffset + (linesAdded - linesRemoved);

  return ok({ newLines, newOffset: newOffset });
}

export function applyPatch(
  fileContent: string,
  patch: string
): Result<string, PatchError> {
  const hunksResult = parseUnifiedDiff(patch);
  if (hunksResult.ok === false) {
    return { ok: false, error: hunksResult.error };
  }

  let lines = fileContent.split("\n");
  let offset = 0;

  for (const hunk of hunksResult.value) {
    const result = applyHunk(lines, hunk, offset);
    if (result.ok === false) {
      return { ok: false, error: result.error };
    }
    lines = result.value.newLines;
    offset = result.value.newOffset;
  }

  return ok(lines.join("\n"));
}

export interface ApplyPatchToFileResult {
  originalContent: string;
  patchedContent: string;
}
