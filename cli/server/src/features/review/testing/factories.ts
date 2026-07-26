import type { FileDiff, ParsedDiff } from "../engine/diff/types.js";

export function makeFileDiff(overrides: Partial<FileDiff> = {}): FileDiff {
  return {
    filePath: "test.ts",
    previousPath: null,
    operation: "modify",
    hunks: [],
    rawDiff: "diff content",
    stats: { additions: 1, deletions: 0, sizeBytes: 100 },
    ...overrides,
  };
}

export function makeParsedDiff(files: Array<Partial<FileDiff>> = [{}]): ParsedDiff {
  const fileDiffs = files.map(makeFileDiff);

  return {
    files: fileDiffs,
    totalStats: {
      filesChanged: fileDiffs.length,
      additions: fileDiffs.reduce((total, file) => total + file.stats.additions, 0),
      deletions: fileDiffs.reduce((total, file) => total + file.stats.deletions, 0),
      totalSizeBytes: fileDiffs.reduce((total, file) => total + file.stats.sizeBytes, 0),
    },
  };
}
