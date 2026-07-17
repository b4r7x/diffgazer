import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import {
  checkCoreUsesExplicitSubpathExports,
  checkDependencyOverridesDocumented,
  checkDockerArtifactFormatterInputs,
  checkDockerFrozenInstallsCopyPatches,
  checkDocsE2eScreenshotsUseBaselineDirectory,
  checkInternalLocalDepsUseWorkspaceProtocol,
  checkLicenseFilesMatch,
  checkNoLinkOrFileLocalDeps,
  checkNoNestedGitDirectories,
  checkNoNestedPnpmLocks,
  checkNoNestedPnpmWorkspaces,
  checkPnpmPinsMatchRootPackageManager,
  checkSecurityReportingChannelsAgree,
  checkTurboDocsBuildIncludesOutput,
  checkWebBuildUsesTurbo,
  INVARIANT_CHECKS,
  runInvariantChecks,
} from "./check-invariants.mjs";

const PACKAGE_FILES = [
  "apps/docs/package.json",
  "apps/landing/package.json",
  "apps/web/package.json",
  "cli/add/package.json",
  "cli/diffgazer/package.json",
  "cli/server/package.json",
  "libs/core/package.json",
  "libs/keys/package.json",
  "libs/registry/package.json",
  "libs/ui/package.json",
];

const FIXTURE_REPO_FILES = ["Dockerfile", "deploy/landing.Dockerfile"];

const EMPTY_COMMAND_OUTPUTS = {
  gitLsFilesStaged: "",
  nestedRepoConfig: "",
  nestedGitDirs: "",
  nestedLocks: "",
  nestedWorkspaces: "",
};

const STALE_DOCS_E2E_SNAPSHOT_PATH =
  "apps/docs/tests/e2e/select.e2e.ts-snapshots/select-listbox-open-chromium-darwin.png";
const CANONICAL_DOCS_E2E_SNAPSHOT_PATH =
  "apps/docs/tests/e2e/baselines/select.e2e.ts-snapshots/select-listbox-open-chromium-darwin.png";

const tempRoots = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop(), { recursive: true, force: true });
  }
});

function makeTempRoot() {
  const root = mkdtempSync(join(tmpdir(), "dg-invariants-"));
  tempRoots.push(root);
  return root;
}

function writeText(root, relPath, content) {
  const path = join(root, relPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function writeJson(root, relPath, value) {
  writeText(root, relPath, `${JSON.stringify(value, null, 2)}\n`);
}

function trackedFileEntry(path) {
  return `100644 ${"a".repeat(40)} 0\t${path}\n`;
}

function readPackage(root, relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}

function updatePackage(root, relPath, update) {
  writeJson(root, relPath, update(readPackage(root, relPath)));
}

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

function createWorkspacePackage(root, relPath, pkg) {
  writeJson(root, relPath, pkg);
}

function writePackagePolicyFiles(root, packageDir, licenseText = "MIT License\n") {
  for (const file of ["README.md", "SECURITY.md", "SUPPORT.md"]) {
    writeText(root, `${packageDir}/${file}`, `${file}\n`);
  }
  writeText(root, `${packageDir}/LICENSE`, licenseText);
}

function createConformingFixture() {
  const root = makeTempRoot();

  writeJson(root, "package.json", {
    private: true,
    packageManager: "pnpm@11.13.0",
    repository: { url: "git+https://github.com/b4r7x/diffgazer.git" },
    homepage: "https://github.com/b4r7x/diffgazer",
    bugs: { url: "https://github.com/b4r7x/diffgazer/issues" },
    scripts: { "web:build": "turbo run build --filter=@diffgazer/web" },
  });
  writeText(root, "SECURITY.md", "security\n");
  writeText(root, "SUPPORT.md", "support\n");
  const dockerfile = [
    "COPY biome.json .gitignore ./",
    "COPY patches/ patches/",
    "RUN corepack prepare pnpm@11.13.0 --activate",
    "RUN pnpm install --frozen-lockfile",
    "",
  ].join("\n");
  writeText(root, "Dockerfile", dockerfile);
  writeText(root, "deploy/landing.Dockerfile", dockerfile);
  writeText(
    root,
    "pnpm-workspace.yaml",
    [
      "packages:",
      "  - apps/*",
      "  - cli/*",
      "  - libs/*",
      "  - libs/keys/artifacts",
      "  - libs/keys/examples/*",
      "patchedDependencies:",
      "  nitro@3.0.260429-beta: patches/nitro@3.0.260429-beta.patch",
      "",
    ].join("\n"),
  );
  writeJson(root, "turbo.json", {
    tasks: { "@diffgazer/docs#build": { outputs: ["dist/**", ".output/**"] } },
  });

  createWorkspacePackage(root, "apps/docs/package.json", {
    name: "@diffgazer/docs",
    private: true,
  });
  createWorkspacePackage(root, "apps/landing/package.json", {
    name: "@diffgazer/landing",
    private: true,
  });
  createWorkspacePackage(root, "apps/web/package.json", {
    name: "@diffgazer/web",
    private: true,
  });
  createWorkspacePackage(root, "cli/server/package.json", {
    name: "@diffgazer/server",
    private: true,
  });
  createWorkspacePackage(root, "libs/core/package.json", {
    name: "@diffgazer/core",
    private: true,
    exports: {
      "./errors": "./dist/errors.js",
    },
  });
  createWorkspacePackage(root, "libs/registry/package.json", {
    name: "@diffgazer/registry",
    private: true,
  });

  createWorkspacePackage(root, "libs/ui/package.json", {
    name: "@diffgazer/ui",
    author: "diffgazer",
    license: "MIT",
    repository: {
      url: "git+https://github.com/b4r7x/diffgazer.git",
      directory: "libs/ui",
    },
    homepage: "https://github.com/b4r7x/diffgazer/tree/main/libs/ui",
    sideEffects: ["**/*.css"],
    files: ["dist", "LICENSE", "README.md", "SECURITY.md", "SUPPORT.md"],
    exports: {
      ".": "./dist/index.js",
      "./components/button": "./dist/components/button.js",
      "./hooks/use-demo": "./dist/hooks/use-demo.js",
      "./lib/utils": "./dist/lib/utils.js",
      "./theme-base.css": "./theme-base.css",
      "./theme.css": "./theme.css",
      "./sources.css": "./sources.css",
      "./styles.css": "./styles.css",
    },
    publishConfig: { access: "public", provenance: true },
    engines: { node: ">=22.0.0" },
  });
  writePackagePolicyFiles(root, "libs/ui");

  createWorkspacePackage(root, "libs/keys/package.json", {
    name: "@diffgazer/keys",
    author: "diffgazer",
    license: "MIT",
    repository: {
      url: "git+https://github.com/b4r7x/diffgazer.git",
      directory: "libs/keys",
    },
    homepage: "https://github.com/b4r7x/diffgazer/tree/main/libs/keys",
    sideEffects: false,
    files: ["dist", "README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"],
    exports: { ".": "./dist/index.js" },
    publishConfig: { access: "public", provenance: true },
    engines: { node: ">=22.0.0" },
  });
  writePackagePolicyFiles(root, "libs/keys");

  createWorkspacePackage(root, "cli/diffgazer/package.json", {
    name: "diffgazer",
    author: "diffgazer",
    license: "Apache-2.0",
    bin: { diffgazer: "bin/diffgazer.js" },
    repository: {
      url: "git+https://github.com/b4r7x/diffgazer.git",
      directory: "cli/diffgazer",
    },
    homepage: "https://github.com/b4r7x/diffgazer/tree/main/cli/diffgazer",
    files: ["dist", "bin/diffgazer.js", "README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"],
    publishConfig: { access: "public", provenance: true },
    engines: { node: ">=22.0.0" },
  });
  writePackagePolicyFiles(root, "cli/diffgazer", "Apache License\n");

  createWorkspacePackage(root, "cli/add/package.json", {
    name: "@diffgazer/add",
    author: "diffgazer",
    license: "MIT",
    bin: { dgadd: "dist/index.js" },
    repository: {
      url: "git+https://github.com/b4r7x/diffgazer.git",
      directory: "cli/add",
    },
    homepage: "https://github.com/b4r7x/diffgazer/tree/main/cli/add",
    files: ["dist", "README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"],
    publishConfig: { access: "public", provenance: true },
    engines: { node: ">=22.0.0" },
  });
  writePackagePolicyFiles(root, "cli/add");

  return root;
}

function runFixture(root, options = {}) {
  return runInvariantChecks({
    rootDir: root,
    packageFiles: options.packageFiles ?? PACKAGE_FILES,
    repoFiles: options.repoFiles ?? FIXTURE_REPO_FILES,
    commandOutputs: { ...EMPTY_COMMAND_OUTPUTS, ...(options.commandOutputs ?? {}) },
    checks: options.checks,
  });
}

function resultByName(results, name) {
  const result = results.find((entry) => entry.name === name);
  assert.ok(result, `missing result ${name}`);
  return result;
}

test("the conforming fixture passes every invariant", () => {
  const root = createConformingFixture();
  const failures = runFixture(root).filter((result) => !result.ok);

  assert.deepEqual(failures, []);
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
      commandOutputs: { gitLsFilesStaged: "", nestedRepoConfig: "" },
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
      commandOutputs: { gitLsFilesStaged: "", nestedRepoConfig: "" },
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
      checks: [checkDocsE2eScreenshotsUseBaselineDirectory],
    }),
    "docs e2e screenshots use configured baseline directory",
  );
  const canonical = resultByName(
    runFixture(root, {
      commandOutputs: {
        gitLsFilesStaged: trackedFileEntry(CANONICAL_DOCS_E2E_SNAPSHOT_PATH),
      },
      checks: [checkDocsE2eScreenshotsUseBaselineDirectory],
    }),
    "docs e2e screenshots use configured baseline directory",
  );

  assert.equal(stale.ok, false);
  assert.match(stale.details, /apps\/docs\/tests\/e2e\/select\.e2e\.ts-snapshots/);
  assert.equal(canonical.ok, true);
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

test("Docker pnpm pins must match the root packageManager", () => {
  const root = createConformingFixture();
  writeText(root, "deploy/landing.Dockerfile", "RUN corepack prepare pnpm@10.28.2 --activate\n");

  const [result] = runFixture(root, { checks: [checkPnpmPinsMatchRootPackageManager] });

  assert.equal(result.ok, false);
  assert.match(result.details, /deploy\/landing\.Dockerfile/);
});

test("Docker artifact builds must copy formatter inputs", () => {
  const root = createConformingFixture();
  writeText(
    root,
    "deploy/landing.Dockerfile",
    ["COPY biome.json ./", "RUN corepack prepare pnpm@11.13.0 --activate", ""].join("\n"),
  );

  const [result] = runFixture(root, { checks: [checkDockerArtifactFormatterInputs] });

  assert.equal(result.ok, false);
  assert.match(result.details, /deploy\/landing\.Dockerfile: \.gitignore/);
});

test("Docker frozen installs must copy configured patches before installing", () => {
  const root = createConformingFixture();
  writeText(
    root,
    "deploy/landing.Dockerfile",
    [
      "COPY biome.json .gitignore ./",
      "RUN corepack prepare pnpm@11.13.0 --activate",
      "RUN pnpm install --frozen-lockfile",
      "COPY patches/ patches/",
      "",
    ].join("\n"),
  );

  const [result] = runFixture(root, { checks: [checkDockerFrozenInstallsCopyPatches] });

  assert.equal(result.ok, false);
  assert.match(
    result.details,
    /deploy\/landing\.Dockerfile: stage 0: patches\/nitro@3\.0\.260429-beta\.patch/,
  );
});

test("Docker patch validation rejects copies to a path pnpm does not read", () => {
  const root = createConformingFixture();
  writeText(
    root,
    "deploy/landing.Dockerfile",
    [
      "FROM node:22-alpine",
      "WORKDIR /app",
      "COPY patches/ /tmp/patches/",
      "RUN pnpm install --frozen-lockfile",
      "",
    ].join("\n"),
  );

  const [result] = runFixture(root, { checks: [checkDockerFrozenInstallsCopyPatches] });

  assert.equal(result.ok, false);
  assert.match(result.details, /deploy\/landing\.Dockerfile: stage 1/);
});

test("Docker patch validation retains the workdir where a relative copy occurred", () => {
  const root = createConformingFixture();
  writeText(
    root,
    "deploy/landing.Dockerfile",
    [
      "FROM node:22-alpine",
      "WORKDIR /app",
      "COPY patches/ patches/",
      "WORKDIR /other",
      "RUN pnpm install --frozen-lockfile",
      "",
    ].join("\n"),
  );

  const [result] = runFixture(root, { checks: [checkDockerFrozenInstallsCopyPatches] });

  assert.equal(result.ok, false);
  assert.match(result.details, /deploy\/landing\.Dockerfile: stage 1/);
});

test("Docker patch validation tracks a relative workdir after a copy", () => {
  const root = createConformingFixture();
  writeText(
    root,
    "deploy/landing.Dockerfile",
    [
      "FROM node:22-alpine",
      "COPY patches/ patches/",
      "WORKDIR app",
      "RUN pnpm install --frozen-lockfile",
      "",
    ].join("\n"),
  );

  const [result] = runFixture(root, { checks: [checkDockerFrozenInstallsCopyPatches] });

  assert.equal(result.ok, false);
  assert.match(result.details, /deploy\/landing\.Dockerfile: stage 1/);
});

for (const [caseName, runInstruction] of [
  ["chained command", "RUN cd /app && pnpm install --prod --frozen-lockfile"],
  ["BuildKit option", "RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile"],
  [
    "multiline command",
    ["RUN corepack enable && \\", "    pnpm install \\", "      --frozen-lockfile"].join("\n"),
  ],
  ["exec-form command", 'RUN ["pnpm", "install", "--prod", "--frozen-lockfile"]'],
]) {
  test(`Docker patch validation detects a frozen install in ${caseName}`, () => {
    const root = createConformingFixture();
    writeText(
      root,
      "deploy/landing.Dockerfile",
      [
        "FROM node:22-alpine",
        "COPY biome.json .gitignore ./",
        "RUN corepack prepare pnpm@11.13.0 --activate",
        runInstruction,
        "",
      ].join("\n"),
    );

    const [result] = runFixture(root, { checks: [checkDockerFrozenInstallsCopyPatches] });

    assert.equal(result.ok, false);
    assert.match(
      result.details,
      /deploy\/landing\.Dockerfile: stage 1: patches\/nitro@3\.0\.260429-beta\.patch/,
    );
  });
}

for (const runInstruction of [
  'RUN echo "pnpm install --frozen-lockfile"',
  "RUN pnpm install --frozen-lockfile=false",
]) {
  test(`Docker patch validation ignores non-install text: ${runInstruction}`, () => {
    const root = createConformingFixture();
    writeText(root, "deploy/landing.Dockerfile", `${runInstruction}\n`);

    const [result] = runFixture(root, { checks: [checkDockerFrozenInstallsCopyPatches] });

    assert.equal(result.ok, true);
  });
}

test("Docker patch validation discovers additional frozen-install Dockerfiles", () => {
  const root = createConformingFixture();
  const dockerfile = "deploy/preview.Dockerfile";
  writeText(
    root,
    dockerfile,
    ["FROM node:22-alpine", "RUN pnpm install --frozen-lockfile", ""].join("\n"),
  );

  const [result] = runFixture(root, {
    repoFiles: [...FIXTURE_REPO_FILES, dockerfile],
    checks: [checkDockerFrozenInstallsCopyPatches],
  });

  assert.equal(result.ok, false);
  assert.match(result.details, /deploy\/preview\.Dockerfile: stage 1/);
});

test("Docker patch validation resets copied inputs for every build stage", () => {
  const root = createConformingFixture();
  writeText(
    root,
    "deploy/landing.Dockerfile",
    [
      "FROM node:22-alpine AS first",
      "COPY patches/ patches/",
      "RUN pnpm install --frozen-lockfile",
      "FROM node:22-alpine AS second",
      "RUN pnpm install --frozen-lockfile",
      "",
    ].join("\n"),
  );

  const [result] = runFixture(root, { checks: [checkDockerFrozenInstallsCopyPatches] });

  assert.equal(result.ok, false);
  assert.match(result.details, /deploy\/landing\.Dockerfile: stage 2/);
  assert.doesNotMatch(result.details, /deploy\/landing\.Dockerfile: stage 1/);
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

const failureCases = [
  {
    name: "root workspace file exists",
    mutate: (root) => rmSync(join(root, "pnpm-workspace.yaml")),
  },
  {
    name: "root policy files exist",
    mutate: (root) => rmSync(join(root, "SUPPORT.md")),
  },
  {
    name: "root repository metadata",
    mutate: (root) =>
      updatePackage(root, "package.json", (pkg) => ({ ...pkg, homepage: "https://example.com" })),
  },
  {
    name: "pnpm pins match root packageManager",
    mutate: (root) =>
      writeText(
        root,
        "deploy/landing.Dockerfile",
        "RUN corepack prepare pnpm@10.28.2 --activate\n",
      ),
  },
  {
    name: "Docker artifact builds copy formatter inputs",
    mutate: (root) =>
      writeText(
        root,
        "deploy/landing.Dockerfile",
        ["COPY biome.json ./", "RUN corepack prepare pnpm@11.13.0 --activate", ""].join("\n"),
      ),
  },
  {
    name: "Docker frozen installs copy configured patches",
    mutate: (root) =>
      writeText(
        root,
        "deploy/landing.Dockerfile",
        [
          "COPY biome.json .gitignore ./",
          "RUN corepack prepare pnpm@11.13.0 --activate",
          "RUN pnpm install --frozen-lockfile",
          "",
        ].join("\n"),
      ),
  },
  {
    name: "workspace globs match target roots",
    mutate: (root) => writeText(root, "pnpm-workspace.yaml", "packages:\n  - apps/*\n"),
  },
  {
    name: "no .gitmodules",
    mutate: (root) => writeText(root, ".gitmodules", "[submodule]\n"),
  },
  {
    name: "no gitlink entries",
    options: { commandOutputs: { gitLsFilesStaged: "160000 abcdef 0\tvendor/lib\n" } },
  },
  {
    name: "no nested repo config",
    options: { commandOutputs: { nestedRepoConfig: "submodule.vendor.url git@example.com:x/y" } },
  },
  {
    name: "no nested .git directories",
    options: { commandOutputs: { nestedGitDirs: "./vendor/.git\n" } },
  },
  {
    name: "no nested pnpm-lock.yaml",
    options: { commandOutputs: { nestedLocks: "./vendor/pnpm-lock.yaml\n" } },
  },
  {
    name: "no nested pnpm-workspace.yaml",
    options: { commandOutputs: { nestedWorkspaces: "./vendor/pnpm-workspace.yaml\n" } },
  },
  {
    name: "docs e2e screenshots use configured baseline directory",
    mutate: (root) => writeText(root, STALE_DOCS_E2E_SNAPSHOT_PATH, "stale"),
    options: {
      commandOutputs: {
        gitLsFilesStaged: trackedFileEntry(STALE_DOCS_E2E_SNAPSHOT_PATH),
      },
    },
  },
  {
    name: "no link: or file: local deps",
    mutate: (root) =>
      updatePackage(root, "apps/docs/package.json", (pkg) => ({
        ...pkg,
        dependencies: { fixture: "file:../fixture" },
      })),
  },
  {
    name: "internal local deps use workspace protocol",
    mutate: (root) =>
      updatePackage(root, "apps/docs/package.json", (pkg) => ({
        ...pkg,
        dependencies: { "@diffgazer/ui": "^1.0.0" },
      })),
  },
  {
    name: "package license fields match LICENSE files",
    mutate: (root) =>
      updatePackage(root, "libs/ui/package.json", (pkg) => ({ ...pkg, license: "MIT" })),
    afterMutate: (root) => writeText(root, "libs/ui/LICENSE", "Apache License\n"),
  },
  {
    name: "workspace package list under target roots",
    options: { packageFiles: PACKAGE_FILES.filter((path) => path !== "apps/web/package.json") },
  },
  {
    name: "nested package.json files are documented exceptions",
    mutate: (root) => writeJson(root, "apps/web/fixtures/package.json", { name: "fixture" }),
    options: { packageFiles: [...PACKAGE_FILES, "apps/web/fixtures/package.json"] },
  },
  {
    name: "@diffgazer/core uses explicit subpath exports without a root entry",
    mutate: (root) =>
      updatePackage(root, "libs/core/package.json", (pkg) => ({
        ...pkg,
        exports: { ...pkg.exports, ".": "./dist/index.js" },
      })),
  },
  {
    name: "libs/ui/package.json: package metadata",
    mutate: (root) =>
      updatePackage(root, "libs/ui/package.json", (pkg) => {
        const exports = { ...pkg.exports };
        delete exports["./components/button"];
        return { ...pkg, exports };
      }),
  },
  {
    name: "libs/keys/package.json: package metadata",
    mutate: (root) =>
      updatePackage(root, "libs/keys/package.json", (pkg) => ({ ...pkg, sideEffects: [] })),
  },
  {
    name: "cli/diffgazer/package.json: CLI package metadata",
    mutate: (root) =>
      updatePackage(root, "cli/diffgazer/package.json", (pkg) => {
        const rest = { ...pkg };
        delete rest.bin;
        return rest;
      }),
  },
  {
    name: "cli/add/package.json: CLI package metadata",
    mutate: (root) =>
      updatePackage(root, "cli/add/package.json", (pkg) => ({ ...pkg, private: true })),
  },
  {
    name: "no publishable package ships internal-docs-manifest.json",
    mutate: (root) =>
      updatePackage(root, "libs/ui/package.json", (pkg) => ({
        ...pkg,
        files: [...pkg.files, "internal-docs-manifest.json"],
      })),
  },
  {
    name: "publishable packages set publish metadata policy",
    mutate: (root) =>
      updatePackage(root, "libs/ui/package.json", (pkg) => ({
        ...pkg,
        publishConfig: { access: "public" },
      })),
  },
  {
    name: "publishable package set matches fixed policy list",
    mutate: (root) =>
      updatePackage(root, "libs/registry/package.json", (pkg) => {
        const rest = { ...pkg };
        delete rest.private;
        return { ...rest, publishConfig: { access: "public", provenance: true } };
      }),
  },
  {
    name: "publishable packages share one engines.node",
    mutate: (root) =>
      updatePackage(root, "cli/add/package.json", (pkg) => ({
        ...pkg,
        engines: { node: ">=20.0.0" },
      })),
  },
  {
    name: "turbo docs build includes .output",
    mutate: (root) =>
      writeJson(root, "turbo.json", {
        tasks: { "@diffgazer/docs#build": { outputs: ["dist/**"] } },
      }),
  },
  {
    name: "web:build uses turbo for dependency chain",
    mutate: (root) =>
      updatePackage(root, "package.json", (pkg) => ({
        ...pkg,
        scripts: { ...pkg.scripts, "web:build": "vite build" },
      })),
  },
  {
    name: "security and support reporting channels match root policy",
    mutate: (root) =>
      writeText(
        root,
        "cli/add/SECURITY.md",
        "Report through https://github.com/b4r7x/diffgazer/security/advisories/new\n",
      ),
  },
  {
    name: "dependency overrides match governance doc",
    mutate: (root) => {
      writeText(
        root,
        "pnpm-workspace.yaml",
        "packages:\n  - apps/*\noverrides:\n  leftpad: ^1.0.0\n",
      );
      writeText(
        root,
        "PACKAGE_GOVERNANCE.md",
        "## Dependency Governance\n\nNo pins documented here.\n\n## Licensing\n",
      );
    },
  },
  {
    name: "licensed packages appear in governance split",
    mutate: (root) =>
      writeText(
        root,
        "PACKAGE_GOVERNANCE.md",
        "## Licensing\n\n- **MIT** covers `libs/keys`.\n- **Apache-2.0** covers `cli/diffgazer`.\n",
      ),
  },
];

test("failure fixtures cover every exported invariant check", () => {
  assert.equal(failureCases.length, INVARIANT_CHECKS.length);
});

for (const [index, fixtureCase] of failureCases.entries()) {
  test(`${fixtureCase.name} fails on a minimal violating fixture`, () => {
    const root = createConformingFixture();
    fixtureCase.mutate?.(root);
    fixtureCase.afterMutate?.(root);

    const result = resultByName(
      runFixture(root, { ...fixtureCase.options, checks: [INVARIANT_CHECKS[index]] }),
      fixtureCase.name,
    );

    assert.equal(result.ok, false);
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
