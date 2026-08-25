import { describe, expect, it } from "vitest";
import { makeParsedDiff } from "../../testing/factories.js";
import { estimateReviewPromptTokens, PROMPT_SCAFFOLD_TOKENS } from "./estimate.js";
import { partitionDiff } from "./partition.js";

/** 3300 bytes prices at 1050 diff tokens + 64 per-file tokens. */
const SMALL_FILE_BYTES = 3_300;
const SMALL_FILE_TOKENS = 1_114;

/** Room for exactly three small files beside the scaffold. */
const THREE_FILE_BUDGET = PROMPT_SCAFFOLD_TOKENS + 3 * SMALL_FILE_TOKENS;

function diffOf(sizes: number[]) {
  return makeParsedDiff(
    sizes.map((sizeBytes, index) => ({
      filePath: `src/file-${index}.ts`,
      stats: { additions: index + 1, deletions: index, sizeBytes },
    })),
  );
}

describe("partitionDiff", () => {
  it("returns the diff itself when every file fits one call", () => {
    const parsed = diffOf([SMALL_FILE_BYTES, SMALL_FILE_BYTES, SMALL_FILE_BYTES]);

    const batches = partitionDiff(parsed, THREE_FILE_BUDGET);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toBe(parsed);
  });

  it("splits on whole files, in order, keeping every batch within the budget", () => {
    const parsed = diffOf(Array.from({ length: 7 }, () => SMALL_FILE_BYTES));

    const batches = partitionDiff(parsed, THREE_FILE_BUDGET);

    expect(batches.map((batch) => batch.files.map((file) => file.filePath))).toEqual([
      ["src/file-0.ts", "src/file-1.ts", "src/file-2.ts"],
      ["src/file-3.ts", "src/file-4.ts", "src/file-5.ts"],
      ["src/file-6.ts"],
    ]);
    for (const batch of batches) {
      expect(estimateReviewPromptTokens(batch)).toBeLessThanOrEqual(THREE_FILE_BUDGET);
    }
  });

  it("gives a file bigger than the budget a batch of its own", () => {
    const parsed = diffOf([SMALL_FILE_BYTES, 100_000, SMALL_FILE_BYTES]);

    const batches = partitionDiff(parsed, THREE_FILE_BUDGET);

    expect(batches.map((batch) => batch.files.map((file) => file.filePath))).toEqual([
      ["src/file-0.ts"],
      ["src/file-1.ts"],
      ["src/file-2.ts"],
    ]);
  });

  it("keeps the batches' totals equal to the diff's totals", () => {
    const parsed = diffOf(Array.from({ length: 7 }, (_, index) => SMALL_FILE_BYTES + index * 10));

    const batches = partitionDiff(parsed, THREE_FILE_BUDGET);

    const summed = batches.reduce(
      (total, batch) => ({
        filesChanged: total.filesChanged + batch.totalStats.filesChanged,
        additions: total.additions + batch.totalStats.additions,
        deletions: total.deletions + batch.totalStats.deletions,
        totalSizeBytes: total.totalSizeBytes + batch.totalStats.totalSizeBytes,
      }),
      { filesChanged: 0, additions: 0, deletions: 0, totalSizeBytes: 0 },
    );
    expect(summed).toEqual(parsed.totalStats);
  });
});
