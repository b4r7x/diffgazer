import type { FileDiff, DiffHunk, ParsedDiff, DiffOperation } from "./types.js";

const DIFF_HEADER_PATTERN = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const OLD_FILE_PATTERN = /^--- (?:a\/(.+)|\/dev\/null)$/;
const NEW_FILE_PATTERN = /^\+\+\+ (?:b\/(.+)|\/dev\/null)$/;

function determineOperation(oldPath: string | null, newPath: string | null, previousPath: string | null): DiffOperation {
  if (oldPath === null) return "add";
  if (newPath === null) return "delete";
  if (previousPath && previousPath !== newPath) return "rename";
  return "modify";
}

function parseHunks(lines: string[], startIndex: number): { hunks: DiffHunk[]; endIndex: number } {
  const hunks: DiffHunk[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];

    if (line?.startsWith("diff --git ")) {
      break;
    }

    const hunkMatch = line?.match(HUNK_HEADER_PATTERN);
    if (hunkMatch) {
      const oldStart = parseInt(hunkMatch[1] ?? "0", 10);
      const oldCount = parseInt(hunkMatch[2] ?? "1", 10);
      const newStart = parseInt(hunkMatch[3] ?? "0", 10);
      const newCount = parseInt(hunkMatch[4] ?? "1", 10);

      const hunkLines: string[] = [line ?? ""];
      i++;

      while (i < lines.length) {
        const contentLine = lines[i];
        if (
          contentLine?.startsWith("diff --git ") ||
          contentLine?.match(HUNK_HEADER_PATTERN)
        ) {
          break;
        }
        hunkLines.push(contentLine ?? "");
        i++;
      }

      hunks.push({
        oldStart,
        oldCount,
        newStart,
        newCount,
        content: hunkLines.join("\n"),
      });
    } else {
      i++;
    }
  }

  return { hunks, endIndex: i };
}

function countChanges(hunks: DiffHunk[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  for (const hunk of hunks) {
    const lines = hunk.content.split("\n");
    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        additions++;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        deletions++;
      }
    }
  }

  return { additions, deletions };
}

export function parseDiff(diffText: string): ParsedDiff {
  const lines = diffText.split("\n");
  const files: FileDiff[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const headerMatch = line?.match(DIFF_HEADER_PATTERN);
    if (headerMatch) {
      const fileStartIndex = i;
      let oldPath: string | null = headerMatch[1] ?? null;
      let newPath: string | null = headerMatch[2] ?? null;
      let previousPath: string | null = null;

      i++;

      // Extended headers: index, mode, rename, etc.
      while (i < lines.length && !lines[i]?.startsWith("---") && !lines[i]?.startsWith("diff --git ")) {
        const renameLine = lines[i];
        if (renameLine?.startsWith("rename from ")) {
          previousPath = renameLine.slice(12);
        }
        i++;
      }

      const oldMatch = lines[i]?.match(OLD_FILE_PATTERN);
      if (oldMatch) {
        if (oldMatch[1] === undefined) {
          oldPath = null; // /dev/null means new file
        }
        i++;
      }

      const newMatch = lines[i]?.match(NEW_FILE_PATTERN);
      if (newMatch) {
        if (newMatch[1] === undefined) {
          newPath = null; // /dev/null means deleted file
        } else {
          newPath = newMatch[1];
        }
        i++;
      }

      const { hunks, endIndex } = parseHunks(lines, i);
      i = endIndex;

      const rawDiffLines = lines.slice(fileStartIndex, i);
      const rawDiff = rawDiffLines.join("\n");

      const operation = determineOperation(oldPath, newPath, previousPath);
      const filePath = newPath ?? oldPath ?? "unknown";
      const { additions, deletions } = countChanges(hunks);

      files.push({
        filePath,
        previousPath: previousPath ?? (operation === "rename" ? oldPath : null),
        operation,
        hunks,
        rawDiff,
        stats: {
          additions,
          deletions,
          sizeBytes: Buffer.byteLength(rawDiff, "utf-8"),
        },
      });
    } else {
      i++;
    }
  }

  const totalStats = files.reduce(
    (acc, file) => ({
      filesChanged: acc.filesChanged + 1,
      additions: acc.additions + file.stats.additions,
      deletions: acc.deletions + file.stats.deletions,
      totalSizeBytes: acc.totalSizeBytes + file.stats.sizeBytes,
    }),
    { filesChanged: 0, additions: 0, deletions: 0, totalSizeBytes: 0 }
  );

  return { files, totalStats };
}
