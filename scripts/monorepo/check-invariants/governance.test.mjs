import assert from "node:assert/strict";
import { test } from "node:test";
import { createConformingFixture, FIXTURE_REPO_FILES, runFixture, writeText } from "./fixture.mjs";
import { checkNodeDeclarationsMatchRuntime } from "./governance.mjs";

const TSUP_CONFIG_PATH = "cli/diffgazer/tsup.config.ts";

function runWithBundlerTarget(root, target) {
  writeText(root, TSUP_CONFIG_PATH, `export default defineConfig({\n  target: "${target}",\n});\n`);

  const [result] = runFixture(root, {
    repoFiles: [...FIXTURE_REPO_FILES, TSUP_CONFIG_PATH],
    checks: [checkNodeDeclarationsMatchRuntime],
  });
  return result;
}

test("a bundler target matching the CI Node major is accepted", () => {
  const result = runWithBundlerTarget(createConformingFixture(), "node22");

  assert.equal(result.ok, true);
});

test("a bundler emitting for an older Node major than CI is rejected", () => {
  const result = runWithBundlerTarget(createConformingFixture(), "node20");

  assert.equal(result.ok, false);
  assert.match(result.details, /cli\/diffgazer\/tsup\.config\.ts targets Node 20 != CI Node 22/);
});

test("a bundler config declaring no Node target stays out of scope", () => {
  const root = createConformingFixture();
  writeText(root, TSUP_CONFIG_PATH, 'export default defineConfig({ format: ["esm"] });\n');

  const [result] = runFixture(root, {
    repoFiles: [...FIXTURE_REPO_FILES, TSUP_CONFIG_PATH],
    checks: [checkNodeDeclarationsMatchRuntime],
  });

  assert.equal(result.ok, true);
});
