import type { FileDiff, DiffHunk, ParsedDiff, DiffOperation } from "@repo/core/diff";

export type DiffLineType = "addition" | "deletion" | "hunk-header" | "file-header" | "context";

export function classifyDiffLine(line: string): DiffLineType {
  if (line.startsWith("+") && !line.startsWith("+++")) return "addition";
  if (line.startsWith("-") && !line.startsWith("---")) return "deletion";
  if (line.startsWith("@@")) return "hunk-header";
  if (line.startsWith("diff ") || line.startsWith("index ")) return "file-header";
  return "context";
}

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
      const lineType = classifyDiffLine(line);
      if (lineType === "addition") {
        additions++;
      } else if (lineType === "deletion") {
        deletions++;
      }
    }
  }

  return { additions, deletions };
}

export function filterDiffByFiles(parsed: ParsedDiff, files: string[]): ParsedDiff {
  if (files.length === 0) {
    return parsed;
  }

  const normalizedFiles = new Set(files.map((f) => f.replace(/^\.\//, "")));

  const filteredFiles = parsed.files.filter((file) => {
    const normalizedPath = file.filePath.replace(/^\.\//, "");
    return normalizedFiles.has(normalizedPath);
  });

  const totalStats = filteredFiles.reduce(
    (acc, file) => ({
      filesChanged: acc.filesChanged + 1,
      additions: acc.additions + file.stats.additions,
      deletions: acc.deletions + file.stats.deletions,
      totalSizeBytes: acc.totalSizeBytes + file.stats.sizeBytes,
    }),
    { filesChanged: 0, additions: 0, deletions: 0, totalSizeBytes: 0 }
  );

  return { files: filteredFiles, totalStats };
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

      while (i < lines.length && !lines[i]?.startsWith("---") && !lines[i]?.startsWith("diff --git ")) {
        const renameLine = lines[i];
        if (renameLine?.startsWith("rename from ")) {
          previousPath = renameLine.slice(12);
        }
        i++;
      }

      const oldMatch = lines[i]?.match(OLD_FILE_PATTERN);
      if (oldMatch) {
        oldPath = oldMatch[1] ?? null;
        i++;
      }

      const newMatch = lines[i]?.match(NEW_FILE_PATTERN);
      if (newMatch) {
        newPath = newMatch[1] ?? null;
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
