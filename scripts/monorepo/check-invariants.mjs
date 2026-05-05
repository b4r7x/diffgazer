#!/usr/bin/env node

import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const output = [];
const childProcess = createRequire(import.meta.url)("node:child_process");
const { execSync } = childProcess;

function addResult(name, ok, details = "") {
  const check = `${name}: ${ok ? "PASS" : "FAIL"}${details ? ` (${details})` : ""}`;
  output.push({ name, ok, details });
  console.log(check);
}

function fail(msg) {
  console.error(msg);
  process.exitCode = 1;
  throw new Error(msg);
}

function readJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function ensureContainsFiles(fileList, required, label) {
  const normalized = Array.isArray(fileList) ? fileList : [];
  const missing = required.filter((name) => !normalized.includes(name));
  return { ok: missing.length === 0, missing };
}

function assertPackageMetadata(path, expectedName, expectedHomePageSuffix, expectedRepoDir, expectedExports, expectedFiles, requireSideEffects) {
  const pkg = readJSON(path);
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
  if (typeof pkg.sideEffects !== "boolean" || pkg.sideEffects !== requireSideEffects) {
    missing.push(`sideEffects: ${String(pkg.sideEffects)}`);
  }

  const fileCheck = ensureContainsFiles(pkg.files, expectedFiles, "files");
  if (!fileCheck.ok) {
    missing.push(`files missing: ${fileCheck.missing.join(", ")}`);
  }

  const exportsKeys = pkg.exports ? Object.keys(pkg.exports) : [];
  const missingExports = expectedExports.filter((name) => !exportsKeys.includes(name));
  if (missingExports.length) {
    missing.push(`exports missing: ${missingExports.join(", ")}`);
  }

  const readmePath = path.replace("package.json", "README.md");
  if (!existsSync(readmePath)) {
    missing.push(`README missing: ${readmePath}`);
  }

  addResult(
    `${path}: package metadata`,
    missing.length === 0,
    missing.join("; "),
  );
}

function assertCliPackageMetadata(path, expectedName, expectedBinName, expectedRepoDir, expectedFiles) {
  const pkg = readJSON(path);
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

  const fileCheck = ensureContainsFiles(pkg.files, expectedFiles, "files");
  if (!fileCheck.ok) {
    missing.push(`files missing: ${fileCheck.missing.join(", ")}`);
  }

  const readmePath = path.replace("package.json", "README.md");
  if (!existsSync(readmePath)) {
    missing.push(`README missing: ${readmePath}`);
  }

  addResult(
    `${path}: CLI package metadata`,
    missing.length === 0,
    missing.join("; "),
  );
}

function assertRootMetadata() {
  const pkg = readJSON("package.json");
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
assertRootMetadata();

const workspaceYaml = readFileSync("pnpm-workspace.yaml", "utf8");
const globs = workspaceYaml
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.startsWith('- '))
  .map((line) => line.slice(2).replace(/"|'/g, ''));
addResult(
  "workspace globs match target roots",
  JSON.stringify(globs.slice().sort()) === JSON.stringify(["apps/*", "cli/*", "libs/*"]),
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
  nestedRepoConfig = execSync(`git config --get-regexp '^${"sub"}${"module"}\\.'`, { encoding: "utf8" }).trim();
} catch {
  nestedRepoConfig = "";
}
addResult("no nested repo config", nestedRepoConfig.length === 0, nestedRepoConfig.split("\n").slice(0, 10).join(", "));

const nestedGitDirs = execSync(
  "find . -type d -name .git -not -path './.git'",
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
addResult("no nested .git directories", nestedGitDirs.length === 0, nestedGitDirs.slice(0, 5).join(", "));

const nestedLocks = execSync(
  "find . -name pnpm-lock.yaml -type f -not -path './pnpm-lock.yaml' -not -path './node_modules/*'",
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
addResult("no nested pnpm-lock.yaml", nestedLocks.length === 0, nestedLocks.slice(0, 5).join(", "));

const nestedWorkspaces = execSync(
  "find . -name pnpm-workspace.yaml -type f -not -path './pnpm-workspace.yaml' -not -path './node_modules/*'",
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

for (const file of packageFiles) {
  const parsed = readJSON(file);
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

for (const file of packageFiles) {
  const parsed = readJSON(file);
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

const expectedWorkspacePackageFiles = [
  "apps/docs/package.json",
  "apps/web/package.json",
  "cli/add/package.json",
  "cli/diffgazer/package.json",
  "libs/core/package.json",
  "libs/keys/package.json",
  "libs/registry/package.json",
  "libs/server/package.json",
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
  ["./components/*", "./hooks/*", "./lib/*", "./theme-base.css", "./theme.css", "./styles.css"],
  ["dist"],
  false,
);

assertPackageMetadata(
  "libs/keys/package.json",
  "@diffgazer/keys",
  "libs/keys",
  "libs/keys",
  ["."],
  ["dist", "registry", "public/r", "internal-docs-manifest.json"],
  false,
);

assertCliPackageMetadata(
  "cli/diffgazer/package.json",
  "diffgazer",
  "diffgazer",
  "cli/diffgazer",
  ["dist", "bin/diffgazer.js"],
);

assertCliPackageMetadata(
  "cli/add/package.json",
  "@diffgazer/add",
  "dgadd",
  "cli/add",
  ["dist", "README.md"],
);

if (jsonOut) {
  writeFileSync(
    "docs/migration/014-monorepo-restructure/invariant-check-results.json",
    JSON.stringify(output, null, 2),
  );
}

if (output.some((x) => !x.ok)) {
  fail("Invariant checks failed");
}
