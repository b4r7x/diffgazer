import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  createConformingFixture,
  FIXTURE_REPO_FILES,
  PACKAGE_FILES,
  resultByName,
  runFixture,
  STALE_DOCS_E2E_SNAPSHOT_PATH,
  trackedFileEntry,
  updatePackage,
  writeJson,
  writeText,
} from "./check-invariants/fixture.mjs";
import {
  checkAllowBuildsDocumented,
  checkDependencyOverridesDocumented,
  checkNodeDeclarationsMatchRuntime,
  checkSecurityReportingChannelsAgree,
  checkSurfaceEnvExampleKeysStayInRootExample,
  documentedEnvKeys,
} from "./check-invariants/governance.mjs";
import {
  checkE2eScreenshotsUseBaselineDirectory,
  checkNoNestedGitDirectories,
  checkNoNestedPnpmLocks,
  checkNoNestedPnpmWorkspaces,
  checkTurboDocsBuildIncludesOutput,
  checkWebBuildUsesTurbo,
} from "./check-invariants/topology.mjs";
import { runInvariantChecks } from "./check-invariants.mjs";

const CANONICAL_DOCS_E2E_SNAPSHOT_PATH =
  "apps/docs/testing/e2e/baselines/select.e2e.ts-snapshots/select-listbox-open-chromium-darwin.png";
const WEB_E2E_SNAPSHOT_PATH =
  "apps/web/testing/e2e/baselines/review-parity.e2e.ts-snapshots/results-layout-chromium-darwin.png";

test("documentedEnvKeys collects active and commented optional variables", () => {
  const keys = documentedEnvKeys("# OPTIONAL=1\nACTIVE=2\n");
  assert.deepEqual([...keys].sort(), ["ACTIVE", "OPTIONAL"]);
});

test("surface env.example keys stay within the root canonical example", () => {
  const root = createConformingFixture();
  const result = resultByName(
    runFixture(root, { checks: [checkSurfaceEnvExampleKeysStayInRootExample] }),
    "surface env.example keys stay in root .env.example",
  );

  assert.equal(result.ok, true);
});

test("surface env.example keys reject variables absent from the root example", () => {
  const root = createConformingFixture();
  writeText(root, "apps/landing/.env.example", "ORPHAN_ONLY=1\nVITE_SURFACE=1\n");

  const result = resultByName(
    runFixture(root, { checks: [checkSurfaceEnvExampleKeysStayInRootExample] }),
    "surface env.example keys stay in root .env.example",
  );

  assert.equal(result.ok, false);
  assert.match(result.details, /apps\/landing\/\.env\.example.*ORPHAN_ONLY/);
});

test("nested metadata scan ignores git-ignored paths and reports nonignored paths", () => {
  const root = createConformingFixture();
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  writeText(root, ".gitignore", "ignored-fixtures/\n");

  for (const base of ["ignored-fixtures/repo", "visible-fixtures/repo"]) {
    mkdirSync(join(root, base, ".git"), { recursive: true });
    writeText(root, `${base}/pnpm-lock.yaml`, "lockfileVersion: '9.0'\n");
    writeText(root, `${base}/pnpm-workspace.yaml`, "packages: []\n");
  }

  const checks = [checkNoNestedGitDirectories, checkNoNestedPnpmLocks, checkNoNestedPnpmWorkspaces];
  const scan = () =>
    runInvariantChecks({
      rootDir: root,
      packageFiles: PACKAGE_FILES,
      commandOutputs: { gitLsFilesStaged: "", submoduleConfig: "" },
      checks,
    });

  for (const result of scan()) {
    assert.equal(result.ok, false);
    assert.match(result.details, /visible-fixtures\/repo/);
    assert.doesNotMatch(result.details, /ignored-fixtures\/repo/);
  }

  rmSync(join(root, "visible-fixtures"), { recursive: true });
  assert.deepEqual(
    scan().map(({ ok }) => ok),
    [true, true, true],
  );
});

test("nested metadata scan prunes nuke audit workspaces but still reports authored topology", () => {
  const root = createConformingFixture();
  execFileSync("git", ["init", "--quiet"], { cwd: root });

  for (const base of [".nuke/audit-probe/repo", "visible-fixtures/repo"]) {
    mkdirSync(join(root, base, ".git"), { recursive: true });
    writeText(root, `${base}/pnpm-lock.yaml`, "lockfileVersion: '9.0'\n");
    writeText(root, `${base}/pnpm-workspace.yaml`, "packages: []\n");
  }

  const checks = [checkNoNestedGitDirectories, checkNoNestedPnpmLocks, checkNoNestedPnpmWorkspaces];
  const scan = () =>
    runInvariantChecks({
      rootDir: root,
      packageFiles: PACKAGE_FILES,
      commandOutputs: { gitLsFilesStaged: "", submoduleConfig: "" },
      checks,
    });

  for (const result of scan()) {
    assert.equal(result.ok, false);
    assert.match(result.details, /visible-fixtures\/repo/);
    assert.doesNotMatch(result.details, /\.nuke\/audit-probe/);
  }

  rmSync(join(root, "visible-fixtures"), { recursive: true });
  assert.deepEqual(
    scan().map(({ ok }) => ok),
    [true, true, true],
  );
});

test("docs e2e snapshot invariant rejects the stale default Playwright path", () => {
  const root = createConformingFixture();
  writeText(root, STALE_DOCS_E2E_SNAPSHOT_PATH, "stale");
  writeText(root, CANONICAL_DOCS_E2E_SNAPSHOT_PATH, "canonical");

  const stale = resultByName(
    runFixture(root, {
      commandOutputs: {
        gitLsFilesStaged: trackedFileEntry(STALE_DOCS_E2E_SNAPSHOT_PATH),
      },
      checks: [checkE2eScreenshotsUseBaselineDirectory],
    }),
    "e2e screenshots use configured baseline directory",
  );
  const canonical = resultByName(
    runFixture(root, {
      commandOutputs: {
        gitLsFilesStaged: trackedFileEntry(CANONICAL_DOCS_E2E_SNAPSHOT_PATH),
      },
      checks: [checkE2eScreenshotsUseBaselineDirectory],
    }),
    "e2e screenshots use configured baseline directory",
  );

  assert.equal(stale.ok, false);
  assert.match(stale.details, /apps\/docs\/testing\/e2e\/select\.e2e\.ts-snapshots/);
  assert.equal(canonical.ok, true);
});

test("e2e snapshot invariant accepts any workspace's configured baseline directory", () => {
  const root = createConformingFixture();
  writeText(root, WEB_E2E_SNAPSHOT_PATH, "web baseline");

  const result = resultByName(
    runFixture(root, {
      commandOutputs: {
        gitLsFilesStaged: trackedFileEntry(WEB_E2E_SNAPSHOT_PATH),
      },
      checks: [checkE2eScreenshotsUseBaselineDirectory],
    }),
    "e2e screenshots use configured baseline directory",
  );

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

test("Node declarations match the CI runtime and package compatibility floors", () => {
  const root = createConformingFixture();

  const [result] = runFixture(root, { checks: [checkNodeDeclarationsMatchRuntime] });

  assert.equal(result.ok, true);
});

test("Node declaration checks reject workspace and package major drift", () => {
  const overrideRoot = createConformingFixture();
  writeText(
    overrideRoot,
    "pnpm-workspace.yaml",
    'packages:\n  - apps/*\noverrides:\n  "@types/node": ^25.2.3\n',
  );
  const [overrideResult] = runFixture(overrideRoot, {
    checks: [checkNodeDeclarationsMatchRuntime],
  });

  const packageRoot = createConformingFixture();
  updatePackage(packageRoot, "apps/docs/package.json", (pkg) => ({
    ...pkg,
    devDependencies: { ...pkg.devDependencies, "@types/node": "^25.2.3" },
  }));
  const [packageResult] = runFixture(packageRoot, {
    checks: [checkNodeDeclarationsMatchRuntime],
  });

  assert.equal(overrideResult.ok, false);
  assert.match(overrideResult.details, /override major 25 != CI Node 22/);
  assert.equal(packageResult.ok, false);
  assert.match(packageResult.details, /apps\/docs\/package\.json @types\/node major 25/);
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

test("positive install-script approvals match resolved and patched versions", () => {
  const unresolvedRoot = createApprovedBuildFixture();
  writeText(unresolvedRoot, "pnpm-lock.yaml", "lockfileVersion: '9.0'\npackages: {}\n");
  const [unresolved] = runFixture(unresolvedRoot, { checks: [checkAllowBuildsDocumented] });

  assert.equal(unresolved.ok, false);
  assert.match(unresolved.details, /has no matching pnpm-lock\.yaml package/);

  const mismatchedPatchRoot = createApprovedBuildFixture();
  writeText(
    mismatchedPatchRoot,
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
  const [mismatchedPatch] = runFixture(mismatchedPatchRoot, {
    checks: [checkAllowBuildsDocumented],
  });

  assert.equal(mismatchedPatch.ok, false);
  assert.match(mismatchedPatch.details, /does not match patched dependency leftpad@1\.1\.0/);
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

test("docs build output rejects paths that only contain the .output sentinel", () => {
  const root = createConformingFixture();
  writeJson(root, "turbo.json", {
    tasks: { "@diffgazer/docs#build": { outputs: ["dist/**", "not.output/**"] } },
  });

  const [result] = runFixture(root, { checks: [checkTurboDocsBuildIncludesOutput] });

  assert.equal(result.ok, false);
});

for (const script of [
  "echo turbo run build --filter=@diffgazer/web",
  "# turbo run build --filter=@diffgazer/web",
  "turbo run build --filter=@diffgazer/docs",
  "turbo run test --filter=@diffgazer/web",
  "turbo run build --filter=@diffgazer/web --dry-run",
  "turbo run build --filter=@diffgazer/web --dry-run=json",
  "turbo run build --filter=@diffgazer/web --dry",
  "turbo run build --filter=@diffgazer/web --dry=json",
  "turbo run build --filter=@diffgazer/web --graph",
  "turbo run build --filter=@diffgazer/web --graph=graph.dot",
  "turbo run build --filter=@diffgazer/web --graph graph.dot",
  "turbo run build --filter=@diffgazer/web --help",
  "turbo run build --filter=@diffgazer/web -h",
  "turbo run build --filter=@diffgazer/web --version",
  "turbo run build --filter=@diffgazer/web -v",
  "turbo run build --filter=@diffgazer/web --force",
]) {
  test(`web build rejects non-semantic Turbo command: ${script}`, () => {
    const root = createConformingFixture();
    updatePackage(root, "package.json", (pkg) => ({
      ...pkg,
      scripts: { ...pkg.scripts, "web:build": script },
    }));

    const [result] = runFixture(root, { checks: [checkWebBuildUsesTurbo] });

    assert.equal(result.ok, false);
  });
}

for (const script of [
  "turbo run build --filter=@diffgazer/web",
  "pnpm exec turbo run build --filter @diffgazer/web",
]) {
  test(`web build accepts the Web Turbo dependency chain: ${script}`, () => {
    const root = createConformingFixture();
    updatePackage(root, "package.json", (pkg) => ({
      ...pkg,
      scripts: { ...pkg.scripts, "web:build": script },
    }));

    const [result] = runFixture(root, { checks: [checkWebBuildUsesTurbo] });

    assert.equal(result.ok, true);
  });
}

const ROOT_REPORTING_POLICY =
  "Report through https://github.com/b4r7x/diffgazer/security/advisories/new or email b4r7dev@gmail.com.\n";
const PUBLISHABLE_SECURITY_DIRS = ["cli/add", "cli/diffgazer", "libs/keys", "libs/ui"];

function writeReportingPolicyEverywhere(root, policy = ROOT_REPORTING_POLICY) {
  writeText(root, "SECURITY.md", ROOT_REPORTING_POLICY);
  writeText(root, "SUPPORT.md", policy);
  for (const dir of PUBLISHABLE_SECURITY_DIRS) {
    writeText(root, `${dir}/SECURITY.md`, policy);
    writeText(root, `${dir}/SUPPORT.md`, policy);
  }
}

test("security reporting parity fails when a package omits a root reporting channel", () => {
  const root = createConformingFixture();
  writeReportingPolicyEverywhere(root);
  for (const dir of PUBLISHABLE_SECURITY_DIRS) {
    writeText(
      root,
      `${dir}/SECURITY.md`,
      "Report through https://github.com/b4r7x/diffgazer/security/advisories/new\n",
    );
  }

  const result = resultByName(
    runFixture(root, { checks: [checkSecurityReportingChannelsAgree] }),
    "security and support reporting channels match root policy",
  );

  assert.equal(result.ok, false);
});

test("security reporting parity fails when a support doc introduces an off-policy channel", () => {
  const root = createConformingFixture();
  writeReportingPolicyEverywhere(root);
  writeText(
    root,
    "libs/keys/SUPPORT.md",
    "Report through https://github.com/b4r7x/diffgazer/security/advisories/new or email rogue@example.com.\n",
  );

  const result = resultByName(
    runFixture(root, { checks: [checkSecurityReportingChannelsAgree] }),
    "security and support reporting channels match root policy",
  );

  assert.equal(result.ok, false);
});

test("security reporting parity allows a support doc to reference a subset of root channels", () => {
  const root = createConformingFixture();
  writeReportingPolicyEverywhere(root);
  writeText(
    root,
    "libs/keys/SUPPORT.md",
    "Report through https://github.com/b4r7x/diffgazer/security/advisories/new\n",
  );

  const result = resultByName(
    runFixture(root, { checks: [checkSecurityReportingChannelsAgree] }),
    "security and support reporting channels match root policy",
  );

  assert.equal(result.ok, true);
});

test("security reporting parity passes when every security and support doc carries each root channel", () => {
  const root = createConformingFixture();
  writeReportingPolicyEverywhere(root);

  const result = resultByName(
    runFixture(root, { checks: [checkSecurityReportingChannelsAgree] }),
    "security and support reporting channels match root policy",
  );

  assert.equal(result.ok, true);
});

test("security reporting parity fails when a package README Security link omits a root channel", () => {
  const root = createConformingFixture();
  writeReportingPolicyEverywhere(root);
  writeText(
    root,
    "libs/ui/README.md",
    "## Repository metadata\n\n- **Security:** https://github.com/b4r7x/diffgazer/security/advisories/new\n",
  );

  const result = resultByName(
    runFixture(root, { checks: [checkSecurityReportingChannelsAgree] }),
    "security and support reporting channels match root policy",
  );

  assert.equal(result.ok, false);
});

test("security reporting parity fails when a package README Security link introduces an off-policy channel", () => {
  const root = createConformingFixture();
  writeReportingPolicyEverywhere(root);
  writeText(
    root,
    "libs/ui/README.md",
    "## Repository metadata\n\n- **Security:** https://github.com/b4r7x/diffgazer/security/advisories/new or rogue@example.com\n",
  );

  const result = resultByName(
    runFixture(root, { checks: [checkSecurityReportingChannelsAgree] }),
    "security and support reporting channels match root policy",
  );

  assert.equal(result.ok, false);
});

test("security reporting parity passes when a package README Security link carries each root channel", () => {
  const root = createConformingFixture();
  writeReportingPolicyEverywhere(root);
  writeText(
    root,
    "libs/ui/README.md",
    "## Repository metadata\n\n- **Security:** https://github.com/b4r7x/diffgazer/security/advisories/new or b4r7dev@gmail.com\n",
  );

  const result = resultByName(
    runFixture(root, { checks: [checkSecurityReportingChannelsAgree] }),
    "security and support reporting channels match root policy",
  );

  assert.equal(result.ok, true);
});
