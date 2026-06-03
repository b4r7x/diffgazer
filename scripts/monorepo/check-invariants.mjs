#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readJson } from "./artifacts/json.mjs";
import { runValidationChecks } from "./artifacts/run-checks.mjs";

const output = [];

function addResult(name, ok, details = "") {
  const check = `${name}: ${ok ? "PASS" : "FAIL"}${details ? ` (${details})` : ""}`;
  output.push({ name, ok, details });
  console.log(check);
}

function ensureContainsFiles(fileList, required) {
  const normalized = Array.isArray(fileList) ? fileList : [];
  const missing = required.filter((name) => !normalized.includes(name));
  return { ok: missing.length === 0, missing };
}

function checkPolicyFiles(pkgJsonPath, missing) {
  const readmePath = pkgJsonPath.replace(/package\.json$/, "README.md");
  if (!existsSync(readmePath)) {
    missing.push(`README missing: ${readmePath}`);
  }
  for (const policyFile of ["SECURITY.md", "SUPPORT.md"]) {
    const policyPath = pkgJsonPath.replace(/package\.json$/, policyFile);
    if (!existsSync(policyPath)) {
      missing.push(`${policyFile} missing: ${policyPath}`);
    }
  }
}

function hasExport(exportsKeys, expectedExport) {
  if (!expectedExport.endsWith("/*")) {
    return exportsKeys.includes(expectedExport);
  }

  const prefix = expectedExport.slice(0, -1);
  return exportsKeys.some((name) => name.startsWith(prefix) && !name.includes("*"));
}

function assertPackageMetadata(path, expectedName, expectedHomePageSuffix, expectedRepoDir, expectedExports, expectedFiles, expectedSideEffects) {
  const pkg = readJson(path);
  const missing = [];

  if (pkg.name !== expectedName) {
    missing.push(`name: ${pkg.name}`);
  }
  if (pkg.homepage && !pkg.homepage.includes(expectedHomePageSuffix)) {
    missing.push(`homepage: ${pkg.homepage}`);
  }
  const repoDir = pkg.repository?.directory;
  if (repoDir !== expectedRepoDir) {
    missing.push(`repository.directory: ${repoDir}`);
  }
  if (JSON.stringify(pkg.sideEffects) !== JSON.stringify(expectedSideEffects)) {
    missing.push(`sideEffects: ${JSON.stringify(pkg.sideEffects)}`);
  }

  const fileCheck = ensureContainsFiles(pkg.files, expectedFiles);
  if (!fileCheck.ok) {
    missing.push(`files missing: ${fileCheck.missing.join(", ")}`);
  }

  const exportsKeys = pkg.exports ? Object.keys(pkg.exports) : [];
  const wildcardExports = exportsKeys.filter((name) => name.includes("*"));
  if (wildcardExports.length) {
    missing.push(`wildcard exports: ${wildcardExports.join(", ")}`);
  }

  const missingExports = expectedExports.filter((name) => !hasExport(exportsKeys, name));
  if (missingExports.length) {
    missing.push(`exports missing: ${missingExports.join(", ")}`);
  }

  checkPolicyFiles(path, missing);

  addResult(
    `${path}: package metadata`,
    missing.length === 0,
    missing.join("; "),
  );
}

function assertCliPackageMetadata(path, expectedName, expectedBinName, expectedRepoDir, expectedFiles) {
  const pkg = readJson(path);
  const missing = [];

  if (pkg.name !== expectedName) {
    missing.push(`name: ${pkg.name}`);
  }
  if (pkg.private) {
    missing.push("private: true");
  }
  if (pkg.bin?.[expectedBinName] == null) {
    missing.push(`bin missing: ${expectedBinName}`);
  }
  const repoDir = pkg.repository?.directory;
  if (repoDir !== expectedRepoDir) {
    missing.push(`repository.directory: ${repoDir}`);
  }
  if (pkg.repository?.url && !pkg.repository.url.includes("github.com/b4r7x/diffgazer")) {
    missing.push(`repository.url: ${pkg.repository.url}`);
  }
  if (pkg.homepage && !pkg.homepage.includes(expectedRepoDir)) {
    missing.push(`homepage: ${pkg.homepage}`);
  }

  const fileCheck = ensureContainsFiles(pkg.files, expectedFiles);
  if (!fileCheck.ok) {
    missing.push(`files missing: ${fileCheck.missing.join(", ")}`);
  }

  checkPolicyFiles(path, missing);

  addResult(
    `${path}: CLI package metadata`,
    missing.length === 0,
    missing.join("; "),
  );
}

function assertRootMetadata() {
  const pkg = readJson("package.json");
  const missing = [];

  if (pkg.repository?.url !== "git+https://github.com/b4r7x/diffgazer.git") {
    missing.push(`repository.url: ${pkg.repository?.url}`);
  }
  if (pkg.homepage !== "https://github.com/b4r7x/diffgazer") {
    missing.push(`homepage: ${pkg.homepage}`);
  }
  if (pkg.bugs?.url !== "https://github.com/b4r7x/diffgazer/issues") {
    missing.push(`bugs.url: ${pkg.bugs?.url}`);
  }

  addResult("root repository metadata", missing.length === 0, missing.join("; "));
}

// Markers for the two licenses Diffgazer ships (PACKAGE_GOVERNANCE.md): MIT for
// the libraries/add/root, Apache-2.0 for the diffgazer CLI. A package's
// `license` field must match the LICENSE file shipped next to it.
const LICENSE_MARKERS = {
  MIT: "MIT License",
  "Apache-2.0": "Apache License",
};

function assertLicenseFilesMatch(parsedPackages) {
  const mismatches = [];

  for (const [file, parsed] of parsedPackages) {
    const licenseField = parsed.license;
    if (!licenseField) continue;

    const licensePath = file.replace(/package\.json$/, "LICENSE");
    if (!existsSync(licensePath)) continue;

    const marker = LICENSE_MARKERS[licenseField];
    if (!marker) {
      mismatches.push(`${file}: unknown license "${licenseField}" (expected one of ${Object.keys(LICENSE_MARKERS).join(", ")})`);
      continue;
    }

    if (!readFileSync(licensePath, "utf8").includes(marker)) {
      mismatches.push(`${file}: license "${licenseField}" does not match ${licensePath}`);
    }
  }

  addResult("package license fields match LICENSE files", mismatches.length === 0, mismatches.slice(0, 10).join("; "));
}

function listPackageJsonFiles() {
  const files = execSync("rg --files -g 'package.json' -g '!node_modules/**' --no-heading", {
    encoding: "utf8",
  });
  return files
    .trim()
    .split("\n")
    .filter(Boolean);
}

const jsonOut = process.argv.includes("--json");

addResult("root workspace file exists", existsSync("pnpm-workspace.yaml"));
addResult("root policy files exist", existsSync("SECURITY.md") && existsSync("SUPPORT.md"));
assertRootMetadata();

const workspaceYaml = readFileSync("pnpm-workspace.yaml", "utf8");
const globs = workspaceYaml
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.startsWith('- '))
  .map((line) => line.slice(2).replace(/"|'/g, ''));
addResult(
  "workspace globs match target roots",
  JSON.stringify(globs.slice().sort()) === JSON.stringify(["apps/*", "cli/*", "libs/*", "libs/keys/artifacts"]),
  `found ${JSON.stringify(globs)}`,
);

addResult("no .gitmodules", !existsSync(".gitmodules"));

const gitLinks = execSync("git ls-files -s", { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter((line) => line.startsWith("160000 "))
  .map((line) => line.split(/\s+/).at(-1) ?? "")
  .filter(Boolean);
addResult("no gitlink entries", gitLinks.length === 0, gitLinks.slice(0, 10).join(", "));

let nestedRepoConfig = "";
try {
  // Split to avoid grep self-match
  nestedRepoConfig = execSync(`git config --get-regexp '^${"sub"}${"module"}\\.'`, { encoding: "utf8" }).trim();
} catch {
  nestedRepoConfig = "";
}
addResult("no nested repo config", nestedRepoConfig.length === 0, nestedRepoConfig.split("\n").slice(0, 10).join(", "));

const nestedGitDirs = execSync(
  "find . -path './.worktrees' -prune -o -type d -name .git -not -path './.git' -print",
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
addResult("no nested .git directories", nestedGitDirs.length === 0, nestedGitDirs.slice(0, 5).join(", "));

const nestedLocks = execSync(
  "find . -path './.worktrees' -prune -o -name pnpm-lock.yaml -type f -not -path './pnpm-lock.yaml' -not -path './node_modules/*' -print",
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
addResult("no nested pnpm-lock.yaml", nestedLocks.length === 0, nestedLocks.slice(0, 5).join(", "));

const nestedWorkspaces = execSync(
  "find . -path './.worktrees' -prune -o -name pnpm-workspace.yaml -type f -not -path './pnpm-workspace.yaml' -not -path './node_modules/*' -print",
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
addResult("no nested pnpm-workspace.yaml", nestedWorkspaces.length === 0, nestedWorkspaces.slice(0, 5).join(", "));

const packageFiles = listPackageJsonFiles();
const badLinkFile = [];
const workspaceNames = new Set();
const badInternalProtocol = [];
const parsedPackages = new Map();

for (const file of packageFiles) {
  const parsed = readJson(file);
  parsedPackages.set(file, parsed);
  if (parsed.name && !parsed.private) {
    workspaceNames.add(parsed.name);
  }

  const depSets = {
    ...(parsed.dependencies || {}),
    ...(parsed.devDependencies || {}),
    ...(parsed.peerDependencies || {}),
  };

  for (const [name, value] of Object.entries(depSets)) {
    if (typeof value !== "string") continue;
    if (value.startsWith("link:") || value.startsWith("file:")) {
      badLinkFile.push(`${file}: ${name}:${value}`);
    }
  }
}

for (const [file, parsed] of parsedPackages) {
  const localDeps = {
    ...(parsed.dependencies || {}),
    ...(parsed.devDependencies || {}),
  };

  for (const [name, value] of Object.entries(localDeps)) {
    if (typeof value !== "string") continue;
    if (!workspaceNames.has(name)) continue;
    if (!value.startsWith("workspace:")) {
      badInternalProtocol.push(`${file} -> ${name}:${value}`);
    }
  }
}

addResult("no link: or file: local deps", badLinkFile.length === 0, badLinkFile.slice(0, 10).join(", "));
addResult("internal local deps use workspace protocol", badInternalProtocol.length === 0, badInternalProtocol.slice(0, 10).join(", "));

assertLicenseFilesMatch(parsedPackages);

const expectedWorkspacePackageFiles = [
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
const workspacePackageFiles = packageFiles
  .filter((path) => /^(apps|cli|libs)\/[^/]+\/package\.json$/.test(path))
  .sort();
const allowedNestedPackageFiles = [
  "libs/keys/artifacts/package.json",
  "libs/keys/examples/playground/package.json",
];
const nestedPackageFiles = packageFiles
  .filter((path) => /^(apps|cli|libs)\/.+\/package\.json$/.test(path))
  .filter((path) => !workspacePackageFiles.includes(path))
  .sort();
const unexpectedNestedPackageFiles = nestedPackageFiles.filter((path) => !allowedNestedPackageFiles.includes(path));
addResult(
  "workspace package list under target roots",
  JSON.stringify(workspacePackageFiles) === JSON.stringify(expectedWorkspacePackageFiles.slice().sort()),
  `found ${workspacePackageFiles.length}: ${workspacePackageFiles.join(", ")}`,
);
addResult(
  "nested package.json files are documented exceptions",
  unexpectedNestedPackageFiles.length === 0,
  nestedPackageFiles.length ? nestedPackageFiles.join(", ") : "none",
);

assertPackageMetadata(
  "libs/ui/package.json",
  "@diffgazer/ui",
  "libs/ui",
  "libs/ui",
  ["./components/*", "./hooks/*", "./lib/*", "./theme-base.css", "./theme.css", "./sources.css", "./styles.css"],
  ["dist", "LICENSE", "README.md", "SECURITY.md", "SUPPORT.md"],
  ["**/*.css"],
);

assertPackageMetadata(
  "libs/keys/package.json",
  "@diffgazer/keys",
  "libs/keys",
  "libs/keys",
  ["."],
  ["dist", "internal-docs-manifest.json", "README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"],
  false,
);

assertCliPackageMetadata(
  "cli/diffgazer/package.json",
  "diffgazer",
  "diffgazer",
  "cli/diffgazer",
  ["dist", "bin/diffgazer.js", "README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"],
);

assertCliPackageMetadata(
  "cli/add/package.json",
  "@diffgazer/add",
  "dgadd",
  "cli/add",
  ["dist", "README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"],
);

const turboConfig = readJson("turbo.json");
const docsOutputs = turboConfig.tasks?.["@diffgazer/docs#build"]?.outputs ?? [];
addResult(
  "turbo docs build includes .output",
  docsOutputs.some((o) => o.includes(".output")),
  `outputs: ${JSON.stringify(docsOutputs)}`,
);

const rootPkg = readJson("package.json");
const webBuildScript = rootPkg.scripts?.["web:build"] ?? "";
addResult(
  "web:build uses turbo for dependency chain",
  webBuildScript.includes("turbo"),
  webBuildScript,
);

if (jsonOut) {
  writeFileSync(
    "docs/migration/014-monorepo-restructure/invariant-check-results.json",
    JSON.stringify(output, null, 2),
  );
}

// Exit-code contract: this script exits non-zero when any invariant fails so
// CI gates can branch on it. Per-check PASS/FAIL lines are printed above; the
// shared runner prints the failure header plus the failed checks and exits 1
// explicitly here rather than relying on an uncaught throw.
const failures = output
  .filter((x) => !x.ok)
  .map((x) => `  ${x.name}${x.details ? ` (${x.details})` : ""}`);
runValidationChecks(failures, { failureHeader: "Invariant checks failed" });
