import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createInvariantContext } from "./context.mjs";
import { createConformingFixture, resultByName, runFixture, writeText } from "./fixture.mjs";
import { checkLicenseFilesMatch } from "./licenses.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

test("license validation accepts canonical line-wrapped MIT and Apache-2.0 LICENSE files", () => {
  const root = createConformingFixture();

  const result = resultByName(
    runFixture(root, { checks: [checkLicenseFilesMatch] }),
    "package license fields match LICENSE files",
  );

  assert.equal(result.ok, true, result.details);
});

test("license validation rejects a declared license when the sibling LICENSE file is missing", () => {
  const root = createConformingFixture();
  rmSync(join(root, "libs/ui/LICENSE"));

  const result = resultByName(
    runFixture(root, { checks: [checkLicenseFilesMatch] }),
    "package license fields match LICENSE files",
  );

  assert.equal(result.ok, false);
  assert.match(result.details, /libs\/ui\/package\.json.*libs\/ui\/LICENSE is missing/);
});

test("license validation rejects truncated MIT text", () => {
  const root = createConformingFixture();
  writeText(root, "libs/ui/LICENSE", "MIT License\n");

  const result = resultByName(
    runFixture(root, { checks: [checkLicenseFilesMatch] }),
    "package license fields match LICENSE files",
  );

  assert.equal(result.ok, false);
  assert.match(result.details, /not canonical MIT/);
});

test("license validation rejects truncated Apache-2.0 text", () => {
  const root = createConformingFixture();
  writeText(root, "cli/diffgazer/LICENSE", "Apache License\n");

  const result = resultByName(
    runFixture(root, { checks: [checkLicenseFilesMatch] }),
    "package license fields match LICENSE files",
  );

  assert.equal(result.ok, false);
  assert.match(result.details, /not canonical Apache-2\.0/);
});

test("license validation accepts every licensed LICENSE file in the workspace", () => {
  const context = createInvariantContext({
    rootDir: REPO_ROOT,
    packageFiles: [
      "cli/add/package.json",
      "cli/diffgazer/package.json",
      "cli/server/package.json",
      "libs/core/package.json",
      "libs/keys/artifacts/package.json",
      "libs/keys/package.json",
      "libs/registry/package.json",
      "libs/ui/package.json",
    ],
  });

  const result = checkLicenseFilesMatch(context);

  assert.equal(result.ok, true, result.details);
});
