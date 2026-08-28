import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  createConformingFixture,
  resultByName,
  runFixture,
  setFileMtime,
  writeText,
} from "./fixture.mjs";
import { checkCoreDistFreshness, checkKeysDistFreshness } from "./freshness.mjs";

function runKeysCheck(root) {
  return resultByName(
    runFixture(root, { checks: [checkKeysDistFreshness] }),
    "libs/keys dist is not stale",
  );
}

function runCoreCheck(root) {
  return resultByName(
    runFixture(root, { checks: [checkCoreDistFreshness] }),
    "libs/core dist is not stale",
  );
}

// The conforming fixture ships a libs/keys build but no libs/core one, so every
// core case seeds its own tree. src is backdated to keep dist unambiguously newer.
function writeFreshCoreBuild(root) {
  writeText(root, "libs/core/src/errors.ts", "export {};\n");
  setFileMtime(root, "libs/core/src/errors.ts", Date.now() - 60_000);
  writeText(root, "libs/core/dist/errors.js", "export {};\n");
}

test("passes when every compiled output is at least as new as its source", () => {
  const root = createConformingFixture();

  assert.equal(runKeysCheck(root).ok, true);
});

test("fails with the stale file and rebuild command when src is newer than dist", () => {
  const root = createConformingFixture();
  setFileMtime(root, "libs/keys/dist/index.js", Date.now() - 120_000);

  const result = runKeysCheck(root);

  assert.equal(result.ok, false);
  assert.match(result.details, /index\.ts: src newer than dist/);
  assert.match(result.details, /pnpm --filter @diffgazer\/keys exec tsc/);
});

test("fails when a compiled source has no dist output", () => {
  const root = createConformingFixture();
  writeText(root, "libs/keys/src/hooks/use-thing.ts", "export {};\n");

  const result = runKeysCheck(root);

  assert.equal(result.ok, false);
  assert.match(result.details, /hooks\/use-thing\.ts: no compiled output/);
});

test("fails when a compiled output outlives the source it was built from", () => {
  const root = createConformingFixture();
  writeText(root, "libs/keys/dist/hooks/use-removed.js", "export {};\n");

  const result = runKeysCheck(root);

  assert.equal(result.ok, false);
  assert.match(result.details, /hooks\/use-removed\.js: compiled output has no source/);
});

test("passes when dist has not been built at all", () => {
  const root = createConformingFixture();
  rmSync(join(root, "libs/keys/dist"), { recursive: true });

  assert.equal(runKeysCheck(root).ok, true);
});

test("ignores test files, test-only fixtures and harnesses, test-setup, and internal helpers", () => {
  const root = createConformingFixture();
  writeText(root, "libs/keys/src/hooks/use-thing.test.ts", "export {};\n");
  writeText(root, "libs/keys/src/hooks/use-navigation/test-list.tsx", "export {};\n");
  writeText(root, "libs/keys/src/hooks/use-focus-trap/trap-harness.ts", "export {};\n");
  writeText(root, "libs/keys/src/test-setup.ts", "export {};\n");
  writeText(root, "libs/keys/src/testing/internal/test-utils.tsx", "export {};\n");

  assert.equal(runKeysCheck(root).ok, true);
});

test("passes when every compiled libs/core output is at least as new as its source", () => {
  const root = createConformingFixture();
  writeFreshCoreBuild(root);

  assert.equal(runCoreCheck(root).ok, true);
});

test("fails with the libs/core rebuild command when core src is newer than dist", () => {
  const root = createConformingFixture();
  writeFreshCoreBuild(root);
  setFileMtime(root, "libs/core/dist/errors.js", Date.now() - 120_000);

  const result = runCoreCheck(root);

  assert.equal(result.ok, false);
  assert.match(result.details, /errors\.ts: src newer than dist/);
  assert.match(result.details, /pnpm --filter @diffgazer\/core exec tsc/);
});

test("fails when a compiled libs/core source has no dist output", () => {
  const root = createConformingFixture();
  writeFreshCoreBuild(root);
  writeText(root, "libs/core/src/review/history.ts", "export {};\n");

  const result = runCoreCheck(root);

  assert.equal(result.ok, false);
  assert.match(result.details, /review\/history\.ts: no compiled output/);
});

test("passes when libs/core dist has not been built at all", () => {
  const root = createConformingFixture();
  writeText(root, "libs/core/src/errors.ts", "export {};\n");

  assert.equal(runCoreCheck(root).ok, true);
});

test("ignores libs/core test files, fixtures, and test helpers", () => {
  const root = createConformingFixture();
  writeFreshCoreBuild(root);
  writeText(root, "libs/core/src/errors.test.ts", "export {};\n");
  writeText(root, "libs/core/src/catalog/fixtures.ts", "export {};\n");
  writeText(root, "libs/core/src/api/test-helpers.ts", "export {};\n");

  assert.equal(runCoreCheck(root).ok, true);
});
