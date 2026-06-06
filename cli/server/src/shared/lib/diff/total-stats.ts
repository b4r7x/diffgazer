import type { FileDiff, ParsedDiff } from "./types.js";

export function computeTotalStats(files: FileDiff[]): ParsedDiff["totalStats"] {
  return files.reduce(
    (acc, file) => ({
      filesChanged: acc.filesChanged + 1,
      additions: acc.additions + file.stats.additions,
      deletions: acc.deletions + file.stats.deletions,
      totalSizeBytes: acc.totalSizeBytes + file.stats.sizeBytes,
    }),
    { filesChanged: 0, additions: 0, deletions: 0, totalSizeBytes: 0 },
  );
}
