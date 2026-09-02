// The deterministic diff fixtures the `medium` and `large` scenarios review,
// plus the token cap the harness patches onto the hermetic server so each diff
// partitions into multiple batches. No I/O and no network so `test:scripts` can
// exercise them offline.

// The schema-minimum effectiveCallTokenCap (settings.ts:93-97), patched onto
// the hermetic server for every fixture scenario so the diff partitions.
export const BATCHING_CALL_TOKEN_CAP = 16_384;

// Shape + proof bar + time bound per fixture scenario. `small` deliberately has
// no entry: it keeps the legacy 2-file scratch repo, default cap, 600s watchdog.
// minBatches is the a-priori batching-proof bar and timeoutMs the a-priori
// watchdog, max(600s, (minBatches + 1) x 300s) — set up front, never raised to
// turn a red cell green.
export const SCENARIO_FIXTURES = {
  medium: {
    filePrefix: "medium_",
    fileCount: 6,
    targetFileBytes: 10_240,
    minLinesPerFile: 250,
    minBatches: 2,
    timeoutMs: 900_000,
  },
  large: {
    filePrefix: "large_",
    fileCount: 100,
    targetFileBytes: 640,
    minLinesPerFile: 15,
    minBatches: 3,
    timeoutMs: 1_200_000,
  },
};

/**
 * Deterministic diff recipe: `fileCount` files of at least `targetFileBytes`
 * and `minLinesPerFile` non-empty lines each. One planted bug per fixture —
 * file 0's `add` returning `a - b`, the same idiom as the small scenario.
 */
export function buildDiffFixture({ filePrefix, fileCount, targetFileBytes, minLinesPerFile }) {
  const files = [];
  for (let index = 0; index < fileCount; index += 1) {
    let body = index === 0 ? "export function add(a, b) {\n  return a - b;\n}\n" : "";
    let block = 0;
    while (
      Buffer.byteLength(body) < targetFileBytes ||
      body.split("\n").filter(Boolean).length < minLinesPerFile
    ) {
      body += `export function segment_${index}_${block}() {\n  return "${filePrefix}${index} segment ${block} payload 0123456789 0123456789";\n}\n`;
      block += 1;
    }
    files.push({
      path: `${filePrefix}${index}.js`,
      seedContent: `export const seed_${index} = ${index};\n`,
      modifiedContent: body,
    });
  }
  return files;
}
