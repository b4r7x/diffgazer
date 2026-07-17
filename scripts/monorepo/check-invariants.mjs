#!/usr/bin/env node

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { listRepoFiles as listTrackedRepoFiles } from "./lib/files.mjs";
import { readJson } from "./lib/json.mjs";
import { runValidationChecks } from "./lib/run-checks.mjs";

const EXPECTED_WORKSPACE_GLOBS = [
  "apps/*",
  "cli/*",
  "libs/*",
  "libs/keys/artifacts",
  "libs/keys/examples/*",
];

const EXPECTED_WORKSPACE_PACKAGE_FILES = [
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

const ALLOWED_NESTED_PACKAGE_FILES = [
  "libs/keys/artifacts/package.json",
  "libs/keys/examples/playground/package.json",
];

const DOCS_E2E_BASELINE_DIR = "apps/docs/tests/e2e/baselines/";
const PLAYWRIGHT_SCREENSHOT_RE = /\.e2e\.ts-snapshots\/[^/]+\.png$/;
const PNPM_DOCKERFILES = ["Dockerfile", "deploy/landing.Dockerfile"];
const DOCKER_ARTIFACT_FORMATTER_INPUTS = ["biome.json", ".gitignore"];

// Pinned, not derived: a derived scan stops covering a package the moment its publish metadata is removed.
const PUBLISHABLE_PACKAGE_FILES = [
  "cli/add/package.json",
  "cli/diffgazer/package.json",
  "libs/keys/package.json",
  "libs/ui/package.json",
];

const LICENSE_MARKERS = {
  MIT: "MIT License",
  "Apache-2.0": "Apache License",
};

function invariantResult(name, ok, details = "") {
  return { name, ok, details };
}

function formatInvariantResult({ name, ok, details }) {
  return `${name}: ${ok ? "PASS" : "FAIL"}${details ? ` (${details})` : ""}`;
}

function resolveRootPath(context, path) {
  return resolve(context.rootDir, path);
}

function existsInRoot(context, path) {
  return existsSync(resolveRootPath(context, path));
}

function readTextInRoot(context, path) {
  return readFileSync(resolveRootPath(context, path), "utf8");
}

function readJsonInRoot(context, path) {
  return readJson(resolveRootPath(context, path));
}

function parseLines(output) {
  if (Array.isArray(output)) return output.filter(Boolean);
  return String(output).trim().split("\n").filter(Boolean);
}

function parseGitIndexPaths(output) {
  return parseLines(output).flatMap((line) => {
    const separator = line.indexOf("\t");
    return separator === -1 ? [] : [line.slice(separator + 1)];
  });
}

function runGitLsFilesStaged(rootDir) {
  return execSync("git ls-files -s", { cwd: rootDir, encoding: "utf8" });
}

function readNestedRepoConfig(rootDir) {
  try {
    return execSync(`git config --get-regexp '^${"sub"}${"module"}\\.'`, {
      cwd: rootDir,
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

function runFind(rootDir, command) {
  const paths = parseLines(execSync(command, { cwd: rootDir, encoding: "utf8" }));

  return paths.filter((path) => {
    try {
      execFileSync("git", ["check-ignore", "--quiet", "--", path], {
        cwd: rootDir,
        stdio: "ignore",
      });
      return false;
    } catch (error) {
      if (error?.status === 1) return true;
      throw error;
    }
  });
}

export function listPackageJsonFiles(rootDir = process.cwd()) {
  return listTrackedRepoFiles(rootDir).filter(
    (path) => path.endsWith("package.json") && !path.includes("node_modules/"),
  );
}

export function ensureContainsFiles(fileList, required) {
  const normalized = Array.isArray(fileList) ? fileList : [];
  const missing = required.filter((name) => !normalized.includes(name));
  return { ok: missing.length === 0, missing };
}

function checkPolicyFiles(context, pkgJsonPath, missing) {
  const readmePath = pkgJsonPath.replace(/package\.json$/, "README.md");
  if (!existsInRoot(context, readmePath)) {
    missing.push(`README missing: ${readmePath}`);
  }
  for (const policyFile of ["SECURITY.md", "SUPPORT.md"]) {
    const policyPath = pkgJsonPath.replace(/package\.json$/, policyFile);
    if (!existsInRoot(context, policyPath)) {
      missing.push(`${policyFile} missing: ${policyPath}`);
    }
  }
}

export function hasExport(exportsKeys, expectedExport) {
  if (!expectedExport.endsWith("/*")) {
    return exportsKeys.includes(expectedExport);
  }

  const prefix = expectedExport.slice(0, -1);
  return exportsKeys.some((name) => name.startsWith(prefix) && !name.includes("*"));
}

export function checkPackageMetadata(
  context,
  {
    path,
    expectedName,
    expectedHomePageSuffix,
    expectedRepoDir,
    expectedExports,
    expectedFiles,
    expectedSideEffects,
  },
) {
  const pkg = readJsonInRoot(context, path);
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

  checkPolicyFiles(context, path, missing);

  return invariantResult(`${path}: package metadata`, missing.length === 0, missing.join("; "));
}

export function checkCliPackageMetadata(
  context,
  { path, expectedName, expectedBinName, expectedRepoDir, expectedFiles },
) {
  const pkg = readJsonInRoot(context, path);
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

  checkPolicyFiles(context, path, missing);

  return invariantResult(`${path}: CLI package metadata`, missing.length === 0, missing.join("; "));
}

export function checkRootWorkspaceFile(context) {
  return invariantResult(
    "root workspace file exists",
    existsInRoot(context, "pnpm-workspace.yaml"),
  );
}

export function checkRootPolicyFiles(context) {
  return invariantResult(
    "root policy files exist",
    existsInRoot(context, "SECURITY.md") && existsInRoot(context, "SUPPORT.md"),
  );
}

export function checkRootMetadata(context) {
  const pkg = readJsonInRoot(context, "package.json");
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

  return invariantResult("root repository metadata", missing.length === 0, missing.join("; "));
}

export function checkPnpmPinsMatchRootPackageManager(context) {
  const packageManager = readJsonInRoot(context, "package.json").packageManager;
  const expected = `corepack prepare ${packageManager} --activate`;
  const mismatches = PNPM_DOCKERFILES.filter(
    (file) => !existsInRoot(context, file) || !readTextInRoot(context, file).includes(expected),
  );

  return invariantResult(
    "pnpm pins match root packageManager",
    typeof packageManager === "string" &&
      packageManager.startsWith("pnpm@") &&
      mismatches.length === 0,
    mismatches.join(", "),
  );
}

function getDockerEscapeCharacter(content) {
  for (const line of content.split(/\r?\n/)) {
    const directive = /^\s*#\s*([a-z]+)\s*=\s*(.*?)\s*$/i.exec(line);
    if (!directive) break;
    if (directive[1].toLowerCase() === "escape" && ["\\", "`"].includes(directive[2])) {
      return directive[2];
    }
  }

  return "\\";
}

function hasDockerLineContinuation(line, escapeCharacter) {
  if (!line.endsWith(escapeCharacter)) return false;

  let count = 0;
  for (let index = line.length - 1; line[index] === escapeCharacter; index -= 1) count += 1;
  return count % 2 === 1;
}

function parseDockerInstructions(content) {
  const escapeCharacter = getDockerEscapeCharacter(content);
  const instructions = [];
  let logicalLine = "";

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("#")) continue;
    if (logicalLine === "" && trimmed === "") continue;

    const continued = hasDockerLineContinuation(line, escapeCharacter);
    const fragment = continued ? line.slice(0, -1) : line;
    logicalLine = logicalLine === "" ? fragment : `${logicalLine} ${fragment.trimStart()}`;
    if (continued) continue;

    const match = /^\s*([a-z]+)(?:\s+([\s\S]*))?$/i.exec(logicalLine);
    if (match) instructions.push({ name: match[1].toUpperCase(), arguments: match[2] ?? "" });
    logicalLine = "";
  }

  return instructions;
}

function stripDockerInstructionOptions(argumentsText) {
  let command = argumentsText.trimStart();
  const optionPattern = /^--[a-z][a-z0-9-]*(?:=(?:"(?:\\.|[^"])*"|'[^']*'|\S+))?(?:\s+|$)/i;

  while (command.startsWith("--")) {
    const option = optionPattern.exec(command);
    if (!option) break;
    command = command.slice(option[0].length).trimStart();
  }

  return command;
}

function tokenizeShellCommand(command) {
  const tokens = [];
  let index = 0;

  while (index < command.length) {
    while (/\s/.test(command[index] ?? "")) index += 1;
    if (index >= command.length || command[index] === "#") break;

    const operator = ["&&", "||", ";", "|", "&", "(", ")"].find((value) =>
      command.startsWith(value, index),
    );
    if (operator) {
      tokens.push({ type: "operator", value: operator });
      index += operator.length;
      continue;
    }

    let quote = null;
    let value = "";
    while (index < command.length) {
      const character = command[index];
      if (quote) {
        if (character === quote) {
          quote = null;
        } else if (character === "\\" && quote === '"' && index + 1 < command.length) {
          index += 1;
          value += command[index];
        } else {
          value += character;
        }
        index += 1;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        index += 1;
        continue;
      }
      if (character === "\\" && index + 1 < command.length) {
        index += 1;
        value += command[index];
        index += 1;
        continue;
      }
      if (/\s/.test(character) || [";", "|", "&", "(", ")"].includes(character)) break;
      value += character;
      index += 1;
    }
    tokens.push({ type: "word", value });
  }

  return tokens;
}

function hasFrozenPnpmInstall(argumentsText) {
  const command = stripDockerInstructionOptions(argumentsText);
  if (command.startsWith("[")) {
    try {
      const args = JSON.parse(command);
      return (
        Array.isArray(args) &&
        args[0] === "pnpm" &&
        args[1] === "install" &&
        args.slice(2).includes("--frozen-lockfile")
      );
    } catch {
      return false;
    }
  }

  const tokens = tokenizeShellCommand(command);
  let commandStart = true;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "operator") {
      commandStart = true;
      continue;
    }
    if (!commandStart || /^[A-Za-z_][A-Za-z0-9_]*=/.test(token.value)) continue;
    if (token.value === "pnpm" && tokens[index + 1]?.value === "install") {
      for (let argumentIndex = index + 2; argumentIndex < tokens.length; argumentIndex += 1) {
        if (tokens[argumentIndex].type === "operator") break;
        if (tokens[argumentIndex].value === "--frozen-lockfile") return true;
      }
    }
    commandStart = false;
  }

  return false;
}

export function checkDockerArtifactFormatterInputs(context) {
  const missing = PNPM_DOCKERFILES.flatMap((file) => {
    if (!existsInRoot(context, file)) return [`${file}: missing Dockerfile`];

    const copiedSources = new Set(
      parseDockerInstructions(readTextInRoot(context, file))
        .filter((instruction) => instruction.name === "COPY")
        .flatMap((instruction) => parseDockerCopySources(instruction.arguments)),
    );

    return DOCKER_ARTIFACT_FORMATTER_INPUTS.filter((input) => !copiedSources.has(input)).map(
      (input) => `${file}: ${input}`,
    );
  });

  return invariantResult(
    "Docker artifact builds copy formatter inputs",
    missing.length === 0,
    missing.join(", "),
  );
}

function parseDockerCopySources(argumentsText) {
  return parseDockerCopy(argumentsText)?.sources ?? [];
}

function parseDockerCopy(argumentsText) {
  const sources = stripDockerInstructionOptions(argumentsText);
  let args;

  if (sources.startsWith("[")) {
    try {
      args = JSON.parse(sources);
    } catch {
      return null;
    }
    if (!Array.isArray(args) || !args.every((value) => typeof value === "string")) return null;
  } else {
    args = sources.split(/\s+/);
  }

  if (args.length < 2) return null;
  return {
    sources: args.slice(0, -1).map((source) => source.replace(/^\.\//, "").replace(/\/$/, "")),
    destination: args.at(-1),
    destinationIsDirectory: args.length > 2 || args.at(-1).endsWith("/"),
  };
}

function dockerCopyTarget(copy, source, path) {
  const destination = copy.destination;
  if (source === "." || path.startsWith(`${source}/`)) {
    const relativePath = source === "." ? path : path.slice(source.length + 1);
    return posix.join(destination, relativePath);
  }
  if (source !== path) return null;
  if (copy.destinationIsDirectory || destination === "." || destination === "..") {
    return posix.join(destination, posix.basename(source));
  }
  return destination;
}

function resolveDockerContainerPath(path, workdir) {
  if (posix.isAbsolute(path)) return posix.normalize(path);
  return workdir === null ? null : posix.join(workdir, path);
}

function dockerCopyCoversPath(copy, path, installWorkdir) {
  return copy.sources.some((source) => {
    const target = dockerCopyTarget(copy, source, path);
    if (!target) return false;
    const targetPath = resolveDockerContainerPath(target, copy.workdir);
    const expectedPath =
      installWorkdir === null ? null : resolveDockerContainerPath(path, installWorkdir);
    return targetPath !== null && expectedPath !== null && targetPath === expectedPath;
  });
}

function resolveDockerWorkdir(argumentsText, currentWorkdir) {
  const workdir = argumentsText.trim();
  if (workdir === "" || workdir.includes("$")) return null;
  if (posix.isAbsolute(workdir)) return posix.normalize(workdir);
  return currentWorkdir === null ? null : posix.join(currentWorkdir, workdir);
}

export function checkDockerFrozenInstallsCopyPatches(context) {
  const workspace = parseYaml(readTextInRoot(context, "pnpm-workspace.yaml"));
  const patchPaths = Object.values(workspace?.patchedDependencies ?? {}).filter(
    (path) => typeof path === "string",
  );
  const dockerfiles = context.repoFiles.filter((path) =>
    /(^|\/)(?:Dockerfile|[^/]+\.Dockerfile)$/.test(path),
  );
  const missing = [];

  for (const file of dockerfiles) {
    const copies = [];
    let workdir = ".";
    let stage = 0;

    for (const instruction of parseDockerInstructions(readTextInRoot(context, file))) {
      if (instruction.name === "FROM") {
        copies.length = 0;
        workdir = ".";
        stage += 1;
        continue;
      }
      if (instruction.name === "WORKDIR") {
        workdir = resolveDockerWorkdir(instruction.arguments, workdir);
        continue;
      }
      if (instruction.name === "COPY") {
        const copy = parseDockerCopy(instruction.arguments);
        if (copy) copies.push({ ...copy, workdir });
      }
      if (instruction.name !== "RUN" || !hasFrozenPnpmInstall(instruction.arguments)) continue;

      for (const path of patchPaths) {
        if (!copies.some((copy) => dockerCopyCoversPath(copy, path, workdir))) {
          missing.push(`${file}: stage ${stage}: ${path}`);
        }
      }
    }
  }

  return invariantResult(
    "Docker frozen installs copy configured patches",
    missing.length === 0,
    missing.join(", "),
  );
}

export function checkWorkspaceGlobs(context) {
  const workspaceYaml = readTextInRoot(context, "pnpm-workspace.yaml");
  const globs = workspaceYaml
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).replace(/"|'/g, ""));

  return invariantResult(
    "workspace globs match target roots",
    JSON.stringify(globs.slice().sort()) === JSON.stringify(EXPECTED_WORKSPACE_GLOBS),
    `found ${JSON.stringify(globs)}`,
  );
}

export function checkNoGitmodules(context) {
  return invariantResult("no .gitmodules", !existsInRoot(context, ".gitmodules"));
}

export function checkNoGitlinkEntries(context) {
  const gitLinks = parseLines(context.commandOutputs.gitLsFilesStaged)
    .filter((line) => line.startsWith("160000 "))
    .map((line) => line.split(/\s+/).at(-1) ?? "")
    .filter(Boolean);

  return invariantResult(
    "no gitlink entries",
    gitLinks.length === 0,
    gitLinks.slice(0, 10).join(", "),
  );
}

export function checkNoNestedRepoConfig(context) {
  const nestedRepoConfig = String(context.commandOutputs.nestedRepoConfig ?? "");
  return invariantResult(
    "no nested repo config",
    nestedRepoConfig.length === 0,
    nestedRepoConfig.split("\n").slice(0, 10).join(", "),
  );
}

export function checkNoNestedGitDirectories(context) {
  const nestedGitDirs = parseLines(context.commandOutputs.nestedGitDirs);
  return invariantResult(
    "no nested .git directories",
    nestedGitDirs.length === 0,
    nestedGitDirs.slice(0, 5).join(", "),
  );
}

export function checkNoNestedPnpmLocks(context) {
  const nestedLocks = parseLines(context.commandOutputs.nestedLocks);
  return invariantResult(
    "no nested pnpm-lock.yaml",
    nestedLocks.length === 0,
    nestedLocks.slice(0, 5).join(", "),
  );
}

export function checkNoNestedPnpmWorkspaces(context) {
  const nestedWorkspaces = parseLines(context.commandOutputs.nestedWorkspaces);
  return invariantResult(
    "no nested pnpm-workspace.yaml",
    nestedWorkspaces.length === 0,
    nestedWorkspaces.slice(0, 5).join(", "),
  );
}

export function checkDocsE2eScreenshotsUseBaselineDirectory(context) {
  const misplaced = parseGitIndexPaths(context.commandOutputs.gitLsFilesStaged)
    .filter((path) => existsInRoot(context, path))
    .filter((path) => PLAYWRIGHT_SCREENSHOT_RE.test(path))
    .filter((path) => !path.startsWith(DOCS_E2E_BASELINE_DIR));

  return invariantResult(
    "docs e2e screenshots use configured baseline directory",
    misplaced.length === 0,
    misplaced.slice(0, 5).join(", "),
  );
}

function collectDependencyState(context) {
  const badLinkFile = [];
  const workspaceNames = new Set();
  const badInternalProtocol = [];

  for (const parsed of context.parsedPackages.values()) {
    if (parsed.name) {
      workspaceNames.add(parsed.name);
    }
  }

  for (const [file, parsed] of context.parsedPackages) {
    const dependencySections = [
      parsed.dependencies,
      parsed.devDependencies,
      parsed.peerDependencies,
      parsed.optionalDependencies,
    ];

    for (const dependencies of dependencySections) {
      for (const [name, value] of Object.entries(dependencies || {})) {
        if (typeof value !== "string") continue;
        if (value.startsWith("link:") || value.startsWith("file:")) {
          badLinkFile.push(`${file}: ${name}:${value}`);
        }
      }
    }
  }

  for (const [file, parsed] of context.parsedPackages) {
    const localDependencySections = [
      parsed.dependencies,
      parsed.devDependencies,
      parsed.optionalDependencies,
    ];

    for (const dependencies of localDependencySections) {
      for (const [name, value] of Object.entries(dependencies || {})) {
        if (typeof value !== "string") continue;
        if (!workspaceNames.has(name)) continue;
        if (!value.startsWith("workspace:")) {
          badInternalProtocol.push(`${file} -> ${name}:${value}`);
        }
      }
    }
  }

  return { badLinkFile, badInternalProtocol };
}

export function checkNoLinkOrFileLocalDeps(context) {
  const { badLinkFile } = collectDependencyState(context);
  return invariantResult(
    "no link: or file: local deps",
    badLinkFile.length === 0,
    badLinkFile.slice(0, 10).join(", "),
  );
}

export function checkInternalLocalDepsUseWorkspaceProtocol(context) {
  const { badInternalProtocol } = collectDependencyState(context);
  return invariantResult(
    "internal local deps use workspace protocol",
    badInternalProtocol.length === 0,
    badInternalProtocol.slice(0, 10).join(", "),
  );
}

export function checkLicenseFilesMatch(context) {
  const mismatches = [];

  for (const [file, parsed] of context.parsedPackages) {
    const licenseField = parsed.license;
    if (!licenseField) continue;

    const licensePath = file.replace(/package\.json$/, "LICENSE");
    if (!existsInRoot(context, licensePath)) {
      mismatches.push(`${file}: declared license "${licenseField}" but ${licensePath} is missing`);
      continue;
    }

    const marker = LICENSE_MARKERS[licenseField];
    if (!marker) {
      mismatches.push(
        `${file}: unknown license "${licenseField}" (expected one of ${Object.keys(LICENSE_MARKERS).join(", ")})`,
      );
      continue;
    }

    if (!readTextInRoot(context, licensePath).includes(marker)) {
      mismatches.push(`${file}: license "${licenseField}" does not match ${licensePath}`);
    }
  }

  return invariantResult(
    "package license fields match LICENSE files",
    mismatches.length === 0,
    mismatches.slice(0, 10).join("; "),
  );
}

export function checkWorkspacePackageList(context) {
  const workspacePackageFiles = context.packageFiles
    .filter((path) => /^(apps|cli|libs)\/[^/]+\/package\.json$/.test(path))
    .sort();

  return invariantResult(
    "workspace package list under target roots",
    JSON.stringify(workspacePackageFiles) ===
      JSON.stringify(EXPECTED_WORKSPACE_PACKAGE_FILES.slice().sort()),
    `found ${workspacePackageFiles.length}: ${workspacePackageFiles.join(", ")}`,
  );
}

export function checkNestedPackageFilesAreDocumented(context) {
  const workspacePackageFiles = context.packageFiles
    .filter((path) => /^(apps|cli|libs)\/[^/]+\/package\.json$/.test(path))
    .sort();
  const nestedPackageFiles = context.packageFiles
    .filter((path) => /^(apps|cli|libs)\/.+\/package\.json$/.test(path))
    .filter((path) => !workspacePackageFiles.includes(path))
    .sort();
  const unexpectedNestedPackageFiles = nestedPackageFiles.filter(
    (path) => !ALLOWED_NESTED_PACKAGE_FILES.includes(path),
  );

  return invariantResult(
    "nested package.json files are documented exceptions",
    unexpectedNestedPackageFiles.length === 0,
    nestedPackageFiles.length ? nestedPackageFiles.join(", ") : "none",
  );
}

export function checkCoreUsesExplicitSubpathExports(context) {
  const pkg = readJsonInRoot(context, "libs/core/package.json");
  const exportNames = Object.keys(pkg.exports ?? {});
  const invalidExports = exportNames.filter(
    (name) => name === "." || name === "./" || !name.startsWith("./") || name.includes("*"),
  );
  const problems = [];

  if (exportNames.length === 0) problems.push("no exports declared");
  if (invalidExports.length > 0) problems.push(`invalid exports: ${invalidExports.join(", ")}`);

  return invariantResult(
    "@diffgazer/core uses explicit subpath exports without a root entry",
    problems.length === 0,
    problems.join("; "),
  );
}

export function checkUiPackageMetadata(context) {
  return checkPackageMetadata(context, {
    path: "libs/ui/package.json",
    expectedName: "@diffgazer/ui",
    expectedHomePageSuffix: "libs/ui",
    expectedRepoDir: "libs/ui",
    expectedExports: [
      "./components/*",
      "./hooks/*",
      "./lib/*",
      "./theme-base.css",
      "./theme.css",
      "./sources.css",
      "./styles.css",
    ],
    expectedFiles: ["dist", "LICENSE", "README.md", "SECURITY.md", "SUPPORT.md"],
    expectedSideEffects: ["**/*.css"],
  });
}

export function checkKeysPackageMetadata(context) {
  return checkPackageMetadata(context, {
    path: "libs/keys/package.json",
    expectedName: "@diffgazer/keys",
    expectedHomePageSuffix: "libs/keys",
    expectedRepoDir: "libs/keys",
    expectedExports: ["."],
    expectedFiles: ["dist", "README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"],
    expectedSideEffects: false,
  });
}

export function checkDiffgazerCliPackageMetadata(context) {
  return checkCliPackageMetadata(context, {
    path: "cli/diffgazer/package.json",
    expectedName: "diffgazer",
    expectedBinName: "diffgazer",
    expectedRepoDir: "cli/diffgazer",
    expectedFiles: [
      "dist",
      "bin/diffgazer.js",
      "README.md",
      "LICENSE",
      "SECURITY.md",
      "SUPPORT.md",
    ],
  });
}

export function checkAddCliPackageMetadata(context) {
  return checkCliPackageMetadata(context, {
    path: "cli/add/package.json",
    expectedName: "@diffgazer/add",
    expectedBinName: "dgadd",
    expectedRepoDir: "cli/add",
    expectedFiles: ["dist", "README.md", "LICENSE", "SECURITY.md", "SUPPORT.md"],
  });
}

function getPublishablePackages(context) {
  return [...context.parsedPackages.entries()].filter(
    ([, parsed]) => !parsed.private && parsed.publishConfig,
  );
}

export function checkNoPublishableInternalDocsManifest(context) {
  const manifestInFiles = getPublishablePackages(context)
    .filter(([, parsed]) => (parsed.files ?? []).includes("internal-docs-manifest.json"))
    .map(([file]) => file);

  return invariantResult(
    "no publishable package ships internal-docs-manifest.json",
    manifestInFiles.length === 0,
    manifestInFiles.join(", "),
  );
}

export function checkPublishMetadataPolicy(context) {
  const violations = [];

  for (const path of PUBLISHABLE_PACKAGE_FILES) {
    const pkg = readJsonInRoot(context, path);
    const problems = [];

    if (pkg.private) {
      problems.push("private: true");
    }
    if (pkg.publishConfig?.access !== "public") {
      problems.push(`publishConfig.access: ${pkg.publishConfig?.access}`);
    }
    if (pkg.publishConfig?.provenance !== true) {
      problems.push(`publishConfig.provenance: ${pkg.publishConfig?.provenance}`);
    }
    if (!pkg.engines?.node) {
      problems.push("engines.node missing");
    }
    if (!pkg.license) {
      problems.push("license missing");
    }
    if (!pkg.author) {
      problems.push("author missing");
    }

    if (problems.length) {
      violations.push(`${path}: ${problems.join(", ")}`);
    }
  }

  return invariantResult(
    "publishable packages set publish metadata policy",
    violations.length === 0,
    violations.join("; "),
  );
}

export function checkPublishablePackagesMatchFixedList(context) {
  const derived = getPublishablePackages(context)
    .map(([file]) => file)
    .sort();
  const expected = PUBLISHABLE_PACKAGE_FILES.slice().sort();
  const problems = [];

  const missingFromFixedList = derived.filter((file) => !expected.includes(file));
  if (missingFromFixedList.length) {
    problems.push(`missing from fixed list: ${missingFromFixedList.join(", ")}`);
  }

  const staleFixedListEntries = expected.filter((file) => !derived.includes(file));
  if (staleFixedListEntries.length) {
    problems.push(`fixed list not publishable: ${staleFixedListEntries.join(", ")}`);
  }

  return invariantResult(
    "publishable package set matches fixed policy list",
    problems.length === 0,
    problems.join("; "),
  );
}

export function checkPublishablePackagesShareEngineFloor(context) {
  const engineFloors = getPublishablePackages(context).map(([file, parsed]) => ({
    file,
    node: parsed.engines?.node,
  }));
  const uniqueEngineFloors = [...new Set(engineFloors.map((entry) => entry.node))];

  return invariantResult(
    "publishable packages share one engines.node",
    uniqueEngineFloors.length === 1 && uniqueEngineFloors[0] != null,
    engineFloors.map((entry) => `${entry.file}: ${entry.node ?? "missing"}`).join(", "),
  );
}

export function checkTurboDocsBuildIncludesOutput(context) {
  const turboConfig = readJsonInRoot(context, "turbo.json");
  const docsOutputs = turboConfig.tasks?.["@diffgazer/docs#build"]?.outputs ?? [];
  return invariantResult(
    "turbo docs build includes .output",
    docsOutputs.includes(".output/**"),
    `outputs: ${JSON.stringify(docsOutputs)}`,
  );
}

function isWebTurboBuildCommand(script) {
  if (/[;&|#\n\r]/.test(script)) return false;

  const tokens = script.trim().split(/\s+/);
  const turboIndex = tokens[0] === "pnpm" && tokens[1] === "exec" ? 2 : 0;
  if (
    tokens[turboIndex] !== "turbo" ||
    tokens[turboIndex + 1] !== "run" ||
    tokens[turboIndex + 2] !== "build"
  ) {
    return false;
  }

  const args = tokens.slice(turboIndex + 3);
  if (args.length === 1) return args[0] === "--filter=@diffgazer/web";
  return args.length === 2 && args[0] === "--filter" && args[1] === "@diffgazer/web";
}

export function checkWebBuildUsesTurbo(context) {
  const rootPkg = readJsonInRoot(context, "package.json");
  const webBuildScript = rootPkg.scripts?.["web:build"] ?? "";
  return invariantResult(
    "web:build uses turbo for dependency chain",
    isWebTurboBuildCommand(webBuildScript),
    webBuildScript,
  );
}

function sliceDocSection(text, heading) {
  const marker = `## ${heading}`;
  const start = text.indexOf(marker);
  if (start === -1) return null;
  const after = text.slice(start + marker.length);
  const next = after.search(/\n## /);
  return next === -1 ? after : after.slice(0, next);
}

function extractReportingChannels(text) {
  const channels = new Set();
  const advisoryUrl = /https:\/\/github\.com\/[^\s)]+\/security\/advisories\/new/gi;
  const email = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  for (const match of text.matchAll(advisoryUrl)) channels.add(match[0].toLowerCase());
  for (const match of text.matchAll(email)) channels.add(match[0].toLowerCase());
  return channels;
}

function compareReportingChannels(label, channels, rootChannels, violations, requireEvery) {
  for (const channel of channels) {
    if (!rootChannels.has(channel)) {
      violations.push(`${label}: unexpected ${channel}`);
    }
  }
  if (!requireEvery) return;
  for (const channel of rootChannels) {
    if (!channels.has(channel)) {
      violations.push(`${label}: missing ${channel}`);
    }
  }
}

function collectReportingChannelDrift(context, docPath, rootChannels, violations, requireEvery) {
  if (!existsInRoot(context, docPath)) return;

  const channels = extractReportingChannels(readTextInRoot(context, docPath));
  compareReportingChannels(docPath, channels, rootChannels, violations, requireEvery);
}

function extractReadmeSecurityMetadata(text) {
  const match = text.match(/^\s*[-*]\s*\*\*Security:\*\*\s*(.+)$/im);
  return match ? match[1] : null;
}

function collectReadmeSecurityChannelDrift(context, readmePath, rootChannels, violations) {
  if (!existsInRoot(context, readmePath)) return;

  const securityLine = extractReadmeSecurityMetadata(readTextInRoot(context, readmePath));
  if (securityLine == null) return;

  const channels = extractReportingChannels(securityLine);
  compareReportingChannels(`${readmePath} Security`, channels, rootChannels, violations, true);
}

export function checkSecurityReportingChannelsAgree(context) {
  const rootChannels = extractReportingChannels(readTextInRoot(context, "SECURITY.md"));
  const violations = [];

  collectReportingChannelDrift(context, "SUPPORT.md", rootChannels, violations, false);
  for (const pkgFile of PUBLISHABLE_PACKAGE_FILES) {
    const securityPath = pkgFile.replace(/package\.json$/, "SECURITY.md");
    collectReportingChannelDrift(context, securityPath, rootChannels, violations, true);
    const supportPath = pkgFile.replace(/package\.json$/, "SUPPORT.md");
    collectReportingChannelDrift(context, supportPath, rootChannels, violations, false);
    const readmePath = pkgFile.replace(/package\.json$/, "README.md");
    collectReadmeSecurityChannelDrift(context, readmePath, rootChannels, violations);
  }

  return invariantResult(
    "security and support reporting channels match root policy",
    violations.length === 0,
    violations.slice(0, 10).join("; "),
  );
}

function getRootOverrides(context) {
  const workspace = parseYaml(readTextInRoot(context, "pnpm-workspace.yaml"));
  return workspace?.overrides ?? {};
}

function normalizeOverrideVersion(value) {
  return value.replace(/^npm:[^@]+@/, "");
}

function parseDocumentedOverridePins(sectionText) {
  const version = "((?:\\^|~|>=|<=|>|<|=|npm:|v?\\d)[^`]*)";
  const toForm = new RegExp(`\`([^\`]+)\`(?:\\s+pinned)?\\s+to\\s+\`${version}\``, "g");
  const parenForm = new RegExp(`\`([^\`]+)\`\\s+(?:alias\\s+)?\\(\`${version}\``, "g");

  const pins = [];
  for (const match of sectionText.matchAll(toForm)) {
    pins.push({ name: match[1], version: match[2] });
  }
  for (const match of sectionText.matchAll(parenForm)) {
    pins.push({ name: match[1], version: match[2] });
  }
  return pins;
}

export function checkDependencyOverridesDocumented(context) {
  const pkg = readJsonInRoot(context, "package.json");
  if (pkg.pnpm?.overrides || pkg.overrides) {
    return invariantResult(
      "dependency overrides match governance doc",
      false,
      "pnpm 11 requires overrides only in pnpm-workspace.yaml",
    );
  }

  const overrides = getRootOverrides(context);
  const overrideNames = Object.keys(overrides);
  if (overrideNames.length === 0) {
    return invariantResult("dependency overrides match governance doc", true);
  }

  const section = existsInRoot(context, "PACKAGE_GOVERNANCE.md")
    ? sliceDocSection(readTextInRoot(context, "PACKAGE_GOVERNANCE.md"), "Dependency Governance")
    : null;
  if (!section) {
    return invariantResult(
      "dependency overrides match governance doc",
      false,
      "PACKAGE_GOVERNANCE.md Dependency Governance section missing",
    );
  }

  const normalized = new Map(
    overrideNames.map((name) => [name, normalizeOverrideVersion(overrides[name])]),
  );
  const problems = [];

  for (const [name, value] of normalized) {
    if (!section.includes(`\`${name}\``)) {
      problems.push(`override ${name} not documented`);
      continue;
    }
    if (!section.includes(`\`${value}\``)) {
      problems.push(`override ${name} version ${value} not documented`);
    }
  }

  for (const pin of parseDocumentedOverridePins(section)) {
    if (!normalized.has(pin.name)) {
      problems.push(`documented pin ${pin.name} has no root override`);
      continue;
    }
    if (normalized.get(pin.name) !== pin.version) {
      problems.push(
        `documented pin ${pin.name} ${pin.version} != override ${normalized.get(pin.name)}`,
      );
    }
  }

  return invariantResult(
    "dependency overrides match governance doc",
    problems.length === 0,
    problems.slice(0, 10).join("; "),
  );
}

export function checkLicensedPackagesInGovernanceSplit(context) {
  if (!existsInRoot(context, "PACKAGE_GOVERNANCE.md")) {
    return invariantResult("licensed packages appear in governance split", true);
  }

  const section = sliceDocSection(readTextInRoot(context, "PACKAGE_GOVERNANCE.md"), "Licensing");
  if (!section) {
    return invariantResult(
      "licensed packages appear in governance split",
      false,
      "Licensing section missing",
    );
  }

  const lines = section.split("\n");
  const bulletFor = (marker) => lines.find((line) => line.includes(marker)) ?? "";
  const missing = [];

  for (const [file, parsed] of context.parsedPackages) {
    if (!/^(apps|cli|libs)\/[^/]+\/package\.json$/.test(file)) continue;

    const marker = LICENSE_MARKERS[parsed.license] ? `**${parsed.license}**` : null;
    if (!marker) continue;

    const dir = file.replace(/\/package\.json$/, "");
    if (!bulletFor(marker).includes(dir)) {
      missing.push(`${dir} (${parsed.license})`);
    }
  }

  return invariantResult(
    "licensed packages appear in governance split",
    missing.length === 0,
    missing.slice(0, 10).join(", "),
  );
}

export const INVARIANT_CHECKS = [
  checkRootWorkspaceFile,
  checkRootPolicyFiles,
  checkRootMetadata,
  checkPnpmPinsMatchRootPackageManager,
  checkDockerArtifactFormatterInputs,
  checkDockerFrozenInstallsCopyPatches,
  checkWorkspaceGlobs,
  checkNoGitmodules,
  checkNoGitlinkEntries,
  checkNoNestedRepoConfig,
  checkNoNestedGitDirectories,
  checkNoNestedPnpmLocks,
  checkNoNestedPnpmWorkspaces,
  checkDocsE2eScreenshotsUseBaselineDirectory,
  checkNoLinkOrFileLocalDeps,
  checkInternalLocalDepsUseWorkspaceProtocol,
  checkLicenseFilesMatch,
  checkWorkspacePackageList,
  checkNestedPackageFilesAreDocumented,
  checkCoreUsesExplicitSubpathExports,
  checkUiPackageMetadata,
  checkKeysPackageMetadata,
  checkDiffgazerCliPackageMetadata,
  checkAddCliPackageMetadata,
  checkNoPublishableInternalDocsManifest,
  checkPublishMetadataPolicy,
  checkPublishablePackagesMatchFixedList,
  checkPublishablePackagesShareEngineFloor,
  checkTurboDocsBuildIncludesOutput,
  checkWebBuildUsesTurbo,
  checkSecurityReportingChannelsAgree,
  checkDependencyOverridesDocumented,
  checkLicensedPackagesInGovernanceSplit,
];

function commandOutputsFor(rootDir, overrides = {}) {
  return {
    gitLsFilesStaged: overrides.gitLsFilesStaged ?? runGitLsFilesStaged(rootDir),
    nestedRepoConfig: overrides.nestedRepoConfig ?? readNestedRepoConfig(rootDir),
    nestedGitDirs:
      overrides.nestedGitDirs ??
      runFind(
        rootDir,
        "find . \\( -path './.worktrees' -o -path './.nuke' \\) -prune -o -type d -name .git -not -path './.git' -print",
      ),
    nestedLocks:
      overrides.nestedLocks ??
      runFind(
        rootDir,
        "find . \\( -path './.worktrees' -o -path './.nuke' \\) -prune -o -name pnpm-lock.yaml -type f -not -path './pnpm-lock.yaml' -not -path './node_modules/*' -print",
      ),
    nestedWorkspaces:
      overrides.nestedWorkspaces ??
      runFind(
        rootDir,
        "find . \\( -path './.worktrees' -o -path './.nuke' \\) -prune -o -name pnpm-workspace.yaml -type f -not -path './pnpm-workspace.yaml' -not -path './node_modules/*' -print",
      ),
  };
}

export function createInvariantContext(options = {}) {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const packageFiles = options.packageFiles ?? listPackageJsonFiles(rootDir);
  const repoFiles = options.repoFiles ?? listTrackedRepoFiles(rootDir);
  const parsedPackages = new Map();

  for (const file of packageFiles) {
    parsedPackages.set(file, readJson(resolveRootPath({ rootDir }, file)));
  }

  return {
    rootDir,
    packageFiles,
    repoFiles,
    parsedPackages,
    commandOutputs: commandOutputsFor(rootDir, options.commandOutputs),
  };
}

export function runInvariantChecks(options = {}) {
  const context = createInvariantContext(options);
  const results = [];

  for (const check of options.checks ?? INVARIANT_CHECKS) {
    const result = check(context);
    results.push(result);
    options.onResult?.(result);
  }

  return results;
}

export function getInvariantFailures(results) {
  return results
    .filter((result) => !result.ok)
    .map((result) => `  ${result.name}${result.details ? ` (${result.details})` : ""}`);
}

export function runCli() {
  const results = runInvariantChecks({
    onResult: (result) => {
      console.log(formatInvariantResult(result));
    },
  });
  runValidationChecks(getInvariantFailures(results), { failureHeader: "Invariant checks failed" });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
