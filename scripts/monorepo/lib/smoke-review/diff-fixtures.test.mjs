import assert from "node:assert/strict";
import { test } from "node:test";
import { BATCHING_CALL_TOKEN_CAP, buildDiffFixture, SCENARIO_FIXTURES } from "./diff-fixtures.mjs";

for (const { scenarioId, fileCount, byteSlack } of [
  { scenarioId: "medium", fileCount: 6, byteSlack: 2_048 },
  { scenarioId: "large", fileCount: 100, byteSlack: 256 },
]) {
  test(`${scenarioId} diff fixture is ${fileCount} bounded files, deterministic, with one planted bug`, () => {
    const fixture = SCENARIO_FIXTURES[scenarioId];
    const files = buildDiffFixture(fixture);
    assert.equal(files.length, fileCount);
    const maxBytes = fixture.targetFileBytes + byteSlack;
    for (const file of files) {
      const bytes = Buffer.byteLength(file.modifiedContent);
      assert.ok(
        bytes >= fixture.targetFileBytes && bytes <= maxBytes,
        `${file.path}: ${bytes} bytes outside [${fixture.targetFileBytes}, ${maxBytes}]`,
      );
      const lineCount = file.modifiedContent.split("\n").filter(Boolean).length;
      assert.ok(
        lineCount >= fixture.minLinesPerFile,
        `${file.path}: ${lineCount} lines < ${fixture.minLinesPerFile}`,
      );
      assert.ok(
        file.path.startsWith(fixture.filePrefix),
        `${file.path} lacks prefix ${fixture.filePrefix}`,
      );
    }
    assert.deepEqual(buildDiffFixture(fixture), files);
    const buggedFiles = files.filter((file) => file.modifiedContent.includes("return a - b"));
    assert.equal(buggedFiles.length, 1);
  });
}

test("fixture parameter sets pin the a-priori proof bars, watchdogs, and batching cap", () => {
  assert.equal(SCENARIO_FIXTURES.medium.minBatches, 2);
  assert.equal(SCENARIO_FIXTURES.large.minBatches, 3);
  assert.equal(SCENARIO_FIXTURES.medium.timeoutMs, 900_000);
  assert.equal(SCENARIO_FIXTURES.large.timeoutMs, 1_200_000);
  assert.equal(BATCHING_CALL_TOKEN_CAP, 16_384);
});
