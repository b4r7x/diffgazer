// The deterministic large-diff fixture the `large` scenario reviews, plus the
// token cap the harness patches onto the hermetic server so the diff partitions
// into multiple batches. No I/O and no network so `test:scripts` can exercise it
// offline.

// The schema-minimum effectiveCallTokenCap, patched onto the hermetic server so
// the large fixture partitions into multiple batches.
export const LARGE_CALL_TOKEN_CAP = 16_384;
export const LARGE_FIXTURE = { fileCount: 12, targetFileBytes: 10_240, minLinesPerFile: 250 };

/**
 * Deterministic large-diff recipe (REQ-005): 12 files whose per-file estimate
 * stays under every candidate model's window while the whole diff, under the
 * 16,384 call token cap, partitions into >= 2 batches. One planted bug total —
 * the same `add` returning `a - b` idiom as the small scenario.
 */
export function buildLargeDiffFixture() {
  const files = [];
  for (let index = 0; index < LARGE_FIXTURE.fileCount; index += 1) {
    let body = index === 0 ? "export function add(a, b) {\n  return a - b;\n}\n" : "";
    let block = 0;
    while (
      Buffer.byteLength(body) < LARGE_FIXTURE.targetFileBytes ||
      body.split("\n").filter(Boolean).length < LARGE_FIXTURE.minLinesPerFile
    ) {
      body += `export function segment_${index}_${block}() {\n  return "large_${index} segment ${block} payload 0123456789 0123456789";\n}\n`;
      block += 1;
    }
    files.push({
      path: `large_${index}.js`,
      seedContent: `export const seed_${index} = ${index};\n`,
      modifiedContent: body,
    });
  }
  return files;
}
