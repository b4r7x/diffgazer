import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createInvariantContext } from "./context.mjs";
import {
  createConformingFixture,
  resultByName,
  runFixture,
  updatePackage,
  writeText,
} from "./fixture.mjs";
import {
  checkCoreUsesExplicitSubpathExports,
  checkInternalLocalDepsUseWorkspaceProtocol,
  checkLicenseFilesMatch,
  checkNoLinkOrFileLocalDeps,
} from "./packages.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

for (const protocol of ["file:../fixture", "link:../fixture"]) {
  test(`rejects ${protocol.split(":")[0]}: entries in optionalDependencies`, () => {
    const root = createConformingFixture();
    updatePackage(root, "apps/docs/package.json", (pkg) => ({
      ...pkg,
      optionalDependencies: { fixture: protocol },
    }));

    const result = resultByName(
      runFixture(root, { checks: [checkNoLinkOrFileLocalDeps] }),
      "no link: or file: local deps",
    );

    assert.equal(result.ok, false);
    assert.match(result.details, /optional|fixture|file:|link:/);
  });
}

test("requires workspace: for internal optionalDependencies", () => {
  const root = createConformingFixture();
  updatePackage(root, "apps/docs/package.json", (pkg) => ({
    ...pkg,
    optionalDependencies: { "@diffgazer/ui": "^1.0.0" },
  }));

  const result = resultByName(
    runFixture(root, { checks: [checkInternalLocalDepsUseWorkspaceProtocol] }),
    "internal local deps use workspace protocol",
  );

  assert.equal(result.ok, false);
  assert.match(result.details, /@diffgazer\/ui/);
});

test("core export invariant accepts any number of explicit named subpaths", () => {
  const root = createConformingFixture();
  updatePackage(root, "libs/core/package.json", (pkg) => ({
    ...pkg,
    exports: {
      ...pkg.exports,
      "./review": "./dist/review.js",
      "./schemas/config": "./dist/schemas/config.js",
    },
  }));

  const result = resultByName(
    runFixture(root, { checks: [checkCoreUsesExplicitSubpathExports] }),
    "@diffgazer/core uses explicit subpath exports without a root entry",
  );

  assert.equal(result.ok, true);
});

for (const [caseName, exports] of [
  ["root entry", { ".": "./dist/index.js", "./errors": "./dist/errors.js" }],
  ["wildcard entry", { "./*": "./dist/*.js" }],
  ["empty exports", {}],
]) {
  test(`core export invariant rejects ${caseName}`, () => {
    const root = createConformingFixture();
    updatePackage(root, "libs/core/package.json", (pkg) => ({ ...pkg, exports }));

    const result = resultByName(
      runFixture(root, { checks: [checkCoreUsesExplicitSubpathExports] }),
      "@diffgazer/core uses explicit subpath exports without a root entry",
    );

    assert.equal(result.ok, false);
  });
}

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
