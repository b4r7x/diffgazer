import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLargeDiffFixture, LARGE_FIXTURE } from "./large-diff-fixture.mjs";

test("large-diff fixture is 12 bounded files, deterministic, with one planted bug", () => {
  const files = buildLargeDiffFixture();
  assert.equal(files.length, LARGE_FIXTURE.fileCount);
  for (const file of files) {
    const bytes = Buffer.byteLength(file.modifiedContent);
    assert.ok(
      bytes >= LARGE_FIXTURE.targetFileBytes && bytes <= 12_288,
      `${file.path}: ${bytes} bytes outside [${LARGE_FIXTURE.targetFileBytes}, 12288]`,
    );
    const lineCount = file.modifiedContent.split("\n").filter(Boolean).length;
    assert.ok(
      lineCount >= LARGE_FIXTURE.minLinesPerFile,
      `${file.path}: ${lineCount} lines < ${LARGE_FIXTURE.minLinesPerFile}`,
    );
  }
  assert.deepEqual(buildLargeDiffFixture(), files);
  const buggedFiles = files.filter((file) => file.modifiedContent.includes("return a - b"));
  assert.equal(buggedFiles.length, 1);
});
