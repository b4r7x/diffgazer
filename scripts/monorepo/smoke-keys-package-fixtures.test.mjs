import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  writeKeysPackageModeSmoke,
  writeKeysTestHelperSmoke,
} from "./smoke-keys-package-fixtures.mjs";

test("Keys package fixtures separate runtime-only and documented test-helper consumers", () => {
  const projectDir = mkdtempSync(join(tmpdir(), "diffgazer-keys-package-fixtures-"));

  try {
    writeKeysPackageModeSmoke(projectDir);
    writeKeysTestHelperSmoke(projectDir);

    const runtimeOnly = readFileSync(join(projectDir, "runtime-only.mjs"), "utf8");
    const helperTest = readFileSync(join(projectDir, "helper-import.test.mjs"), "utf8");

    assert.match(runtimeOnly, /Expected optional test peer/);
    assert.match(runtimeOnly, /await import\('@diffgazer\/keys'\)/);
    assert.doesNotMatch(runtimeOnly, /testing\/navigation-behavior/);
    assert.match(helperTest, /from '@diffgazer\/keys\/testing\/navigation-behavior'/);
    assert.match(helperTest, /from 'vitest'/);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});
