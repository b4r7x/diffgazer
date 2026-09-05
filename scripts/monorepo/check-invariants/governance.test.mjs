import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createConformingFixture,
  FIXTURE_REPO_FILES,
  PACKAGE_FILES,
  runFixture,
  updatePackage,
  writeJson,
  writeText,
} from "./fixture.mjs";
import {
  checkAllowBuildsDocumented,
  checkDependencyOverridesDocumented,
  checkNodeDeclarationsMatchRuntime,
} from "./governance.mjs";

const TSUP_CONFIG_PATH = "cli/diffgazer/tsup.config.ts";

function runWithBundlerTarget(root, target) {
  writeText(root, TSUP_CONFIG_PATH, `export default defineConfig({\n  target: "${target}",\n});\n`);

  const [result] = runFixture(root, {
    repoFiles: [...FIXTURE_REPO_FILES, TSUP_CONFIG_PATH],
    checks: [checkNodeDeclarationsMatchRuntime],
  });
  return result;
}

// The real repo's shape: CI, the runner pins, and @types/node on one major,
// the published engines floor one major older.
function moveCiAboveFloor(root) {
  writeText(
    root,
    ".github/actions/setup-repo/action.yml",
    "runs:\n  using: composite\n  steps:\n    - uses: actions/setup-node@fixture\n      with:\n        node-version: 24\n",
  );
  writeText(
    root,
    "pnpm-workspace.yaml",
    'packages:\n  - apps/*\noverrides:\n  "@types/node": ^24.0.0\n',
  );
  for (const packageFile of PACKAGE_FILES) {
    updatePackage(root, packageFile, (pkg) => ({
      ...pkg,
      devDependencies: { ...pkg.devDependencies, "@types/node": "^24.0.0" },
    }));
  }
  writeText(
    root,
    "pnpm-lock.yaml",
    [
      "lockfileVersion: '9.0'",
      "importers:",
      ...PACKAGE_FILES.flatMap((packageFile) => [
        `  ${packageFile.replace(/\/package\.json$/, "")}:`,
        "    devDependencies:",
        "      '@types/node':",
        "        specifier: ^24.0.0",
        "        version: 24.13.3",
      ]),
      "packages:",
      "  '@types/node@24.13.3': {}",
      "",
    ].join("\n"),
  );
  return root;
}

test("a bundler target matching the engines floor is accepted", () => {
  const result = runWithBundlerTarget(createConformingFixture(), "node22");

  assert.equal(result.ok, true);
});

test("a bundler emitting for an older Node major than the engines floor is rejected", () => {
  const result = runWithBundlerTarget(createConformingFixture(), "node20");

  assert.equal(result.ok, false);
  assert.match(
    result.details,
    /cli\/diffgazer\/tsup\.config\.ts targets Node 20 != engines floor 22/,
  );
});

test("CI may run a newer major than the engines floor when the bundler targets the floor", () => {
  const result = runWithBundlerTarget(moveCiAboveFloor(createConformingFixture()), "node22");

  assert.equal(result.ok, true);
});

test("a bundler emitting for the CI major above the engines floor is rejected", () => {
  const result = runWithBundlerTarget(moveCiAboveFloor(createConformingFixture()), "node24");

  assert.equal(result.ok, false);
  assert.match(
    result.details,
    /cli\/diffgazer\/tsup\.config\.ts targets Node 24 != engines floor 22/,
  );
});

test("an engines floor newer than CI is rejected", () => {
  const root = createConformingFixture();
  for (const packageFile of PACKAGE_FILES) {
    updatePackage(root, packageFile, (pkg) =>
      pkg.engines ? { ...pkg, engines: { node: ">=24.0.0" } } : pkg,
    );
  }

  const [result] = runFixture(root, { checks: [checkNodeDeclarationsMatchRuntime] });

  assert.equal(result.ok, false);
  assert.match(result.details, /engines floor 24 exceeds CI Node 22/);
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

test("dependency overrides must use the pnpm 11 workspace location", () => {
  const root = createConformingFixture();
  updatePackage(root, "package.json", (pkg) => ({
    ...pkg,
    pnpm: { overrides: { leftpad: "^1.0.0" } },
  }));

  const [result] = runFixture(root, { checks: [checkDependencyOverridesDocumented] });

  assert.equal(result.ok, false);
  assert.match(result.details, /pnpm-workspace\.yaml/);
});

test("top-level package overrides are rejected under pnpm 11", () => {
  const root = createConformingFixture();
  updatePackage(root, "package.json", (pkg) => ({
    ...pkg,
    overrides: { leftpad: "^1.0.0" },
  }));

  const [result] = runFixture(root, { checks: [checkDependencyOverridesDocumented] });

  assert.equal(result.ok, false);
  assert.match(result.details, /pnpm-workspace\.yaml/);
});

test("Node declaration checks reject workspace override major drift", () => {
  const root = createConformingFixture();
  writeText(
    root,
    "pnpm-workspace.yaml",
    'packages:\n  - apps/*\noverrides:\n  "@types/node": ^25.2.3\n',
  );

  const [result] = runFixture(root, { checks: [checkNodeDeclarationsMatchRuntime] });

  assert.equal(result.ok, false);
  assert.match(result.details, /override major 25 != CI Node 22/);
});

test("Node declaration checks reject package @types/node major drift", () => {
  const root = createConformingFixture();
  updatePackage(root, "apps/docs/package.json", (pkg) => ({
    ...pkg,
    devDependencies: { ...pkg.devDependencies, "@types/node": "^25.2.3" },
  }));

  const [result] = runFixture(root, { checks: [checkNodeDeclarationsMatchRuntime] });

  assert.equal(result.ok, false);
  assert.match(result.details, /apps\/docs\/package\.json @types\/node major 25/);
});

test("Node declaration checks reject a missing governed package declaration", () => {
  const root = createConformingFixture();
  updatePackage(root, "apps/docs/package.json", (pkg) => {
    const devDependencies = { ...pkg.devDependencies };
    delete devDependencies["@types/node"];
    return { ...pkg, devDependencies };
  });

  const [result] = runFixture(root, { checks: [checkNodeDeclarationsMatchRuntime] });

  assert.equal(result.ok, false);
  assert.match(result.details, /apps\/docs\/package\.json must declare @types\/node/);
});

test("Node declaration checks reject a runner pinned outside the composite action", () => {
  const root = createConformingFixture();
  writeText(
    root,
    ".github/workflows/deploy.yml",
    [
      "jobs:",
      "  promote-deploy:",
      "    steps:",
      "      - uses: actions/setup-node@fixture",
      "        with:",
      "          node-version: 20",
      "",
    ].join("\n"),
  );

  const [result] = runFixture(root, {
    checks: [checkNodeDeclarationsMatchRuntime],
    repoFiles: [...FIXTURE_REPO_FILES, ".github/workflows/deploy.yml"],
  });

  assert.equal(result.ok, false);
  assert.match(result.details, /\.github\/workflows\/deploy\.yml pins Node 20 != CI Node 22/);
});

test("Node declaration checks govern a workspace no literal list names", () => {
  const root = createConformingFixture();
  writeJson(root, "libs/new/package.json", {
    name: "@diffgazer/new",
    private: true,
    engines: { node: ">=20.0.0" },
  });

  const [result] = runFixture(root, {
    checks: [checkNodeDeclarationsMatchRuntime],
    packageFiles: [...PACKAGE_FILES, "libs/new/package.json"],
  });

  assert.equal(result.ok, false);
  assert.match(result.details, /libs\/new\/package\.json must declare @types\/node/);
  assert.match(result.details, /libs\/new\/package\.json engines\.node major 20/);
});

test("Node declaration checks reject package engine drift", () => {
  const root = createConformingFixture();
  updatePackage(root, "libs/registry/package.json", (pkg) => ({
    ...pkg,
    engines: { node: ">=18.0.0" },
  }));

  const [result] = runFixture(root, { checks: [checkNodeDeclarationsMatchRuntime] });

  assert.equal(result.ok, false);
  assert.match(result.details, /libs\/registry\/package\.json engines\.node major 18/);
});

function createApprovedBuildFixture() {
  const root = createConformingFixture();
  updatePackage(root, "package.json", (pkg) => ({
    ...pkg,
    devDependencies: { ...pkg.devDependencies, leftpad: "1.0.0" },
  }));
  writeText(
    root,
    "pnpm-workspace.yaml",
    [
      "allowBuilds:",
      '  "leftpad@1.0.0": true',
      "  rightpad: false",
      "patchedDependencies:",
      "  leftpad@1.0.0: patches/leftpad@1.0.0.patch",
      "",
    ].join("\n"),
  );
  writeText(
    root,
    "PACKAGE_GOVERNANCE.md",
    "## Dependency Governance\n\n- `leftpad@1.0.0` — allowed.\n- `rightpad` — denied.\n\n## Licensing\n",
  );
  writeText(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\npackages:\n  leftpad@1.0.0: {}\n");
  return root;
}

test("install-script approvals must be named in the governance doc", () => {
  const root = createConformingFixture();
  writeText(
    root,
    "pnpm-workspace.yaml",
    'allowBuilds:\n  "leftpad@1.0.0": true\n  rightpad: false\n',
  );
  writeText(
    root,
    "PACKAGE_GOVERNANCE.md",
    "## Dependency Governance\n\n- `rightpad` — denied.\n\n## Licensing\n",
  );

  const [result] = runFixture(root, { checks: [checkAllowBuildsDocumented] });

  assert.equal(result.ok, false);
  assert.match(result.details, /leftpad@1\.0\.0/);
});

test("install-script approvals pass once every entry is named verbatim", () => {
  const root = createApprovedBuildFixture();

  const [result] = runFixture(root, { checks: [checkAllowBuildsDocumented] });

  assert.equal(result.ok, true);
});

test("positive install-script approvals require an exact version", () => {
  const root = createApprovedBuildFixture();
  writeText(
    root,
    "pnpm-workspace.yaml",
    [
      "allowBuilds:",
      "  leftpad: true",
      "  rightpad: false",
      "patchedDependencies:",
      "  leftpad@1.0.0: patches/leftpad@1.0.0.patch",
      "",
    ].join("\n"),
  );
  writeText(
    root,
    "PACKAGE_GOVERNANCE.md",
    "## Dependency Governance\n\n- `leftpad` — allowed.\n- `rightpad` — denied.\n\n## Licensing\n",
  );

  const [result] = runFixture(root, { checks: [checkAllowBuildsDocumented] });

  assert.equal(result.ok, false);
  assert.match(result.details, /allowBuilds leftpad must use an exact version/);
});

test("positive install-script approvals match exact root dependency pins", () => {
  const root = createApprovedBuildFixture();
  updatePackage(root, "package.json", (pkg) => ({
    ...pkg,
    devDependencies: { ...pkg.devDependencies, leftpad: "^1.0.0" },
  }));

  const [result] = runFixture(root, { checks: [checkAllowBuildsDocumented] });

  assert.equal(result.ok, false);
  assert.match(result.details, /does not match root specifier \^1\.0\.0/);
});

test("an approval with no lockfile package is rejected", () => {
  const root = createApprovedBuildFixture();
  writeText(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\npackages: {}\n");

  const [result] = runFixture(root, { checks: [checkAllowBuildsDocumented] });

  assert.equal(result.ok, false);
  assert.match(result.details, /has no matching pnpm-lock\.yaml package/);
});

test("an approval whose patched version differs is rejected", () => {
  const root = createApprovedBuildFixture();
  writeText(
    root,
    "pnpm-workspace.yaml",
    [
      "allowBuilds:",
      '  "leftpad@1.0.0": true',
      "  rightpad: false",
      "patchedDependencies:",
      "  leftpad@1.1.0: patches/leftpad@1.1.0.patch",
      "",
    ].join("\n"),
  );

  const [result] = runFixture(root, { checks: [checkAllowBuildsDocumented] });

  assert.equal(result.ok, false);
  assert.match(result.details, /does not match patched dependency leftpad@1\.1\.0/);
});

test("an unversioned approval does not satisfy a version-qualified allowBuilds key", () => {
  const root = createConformingFixture();
  writeText(root, "pnpm-workspace.yaml", 'allowBuilds:\n  "leftpad@1.0.0": true\n');
  writeText(
    root,
    "PACKAGE_GOVERNANCE.md",
    "## Dependency Governance\n\n- `leftpad` — allowed.\n\n## Licensing\n",
  );

  const [result] = runFixture(root, { checks: [checkAllowBuildsDocumented] });

  assert.equal(result.ok, false);
});
