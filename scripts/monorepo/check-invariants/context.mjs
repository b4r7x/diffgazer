import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listRepoFiles as listTrackedRepoFiles } from "../lib/files.mjs";
import { readJson } from "../lib/json.mjs";

export function invariantResult(name, ok, details = "") {
  return { name, ok, details };
}

export function formatInvariantResult({ name, ok, details }) {
  return `${name}: ${ok ? "PASS" : "FAIL"}${details ? ` (${details})` : ""}`;
}

function resolveRootPath(context, path) {
  return resolve(context.rootDir, path);
}

export function existsInRoot(context, path) {
  return existsSync(resolveRootPath(context, path));
}

export function readTextInRoot(context, path) {
  return readFileSync(resolveRootPath(context, path), "utf8");
}

export function readJsonInRoot(context, path) {
  return readJson(resolveRootPath(context, path));
}

export function parseLines(output) {
  if (Array.isArray(output)) return output.filter(Boolean);
  return String(output).trim().split("\n").filter(Boolean);
}

export function parseGitIndexPaths(output) {
  return parseLines(output).flatMap((line) => {
    const separator = line.indexOf("\t");
    return separator === -1 ? [] : [line.slice(separator + 1)];
  });
}

function runGitLsFilesStaged(rootDir) {
  return execSync("git ls-files -s", { cwd: rootDir, encoding: "utf8" });
}

function runGitLsFilesEnvExamples(rootDir) {
  return execFileSync("git", ["ls-files", "*env.example"], {
    cwd: rootDir,
    encoding: "utf8",
    timeout: 5_000,
  });
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

function commandOutputsFor(rootDir, overrides = {}) {
  return {
    gitLsFilesStaged: overrides.gitLsFilesStaged ?? runGitLsFilesStaged(rootDir),
    gitLsFilesEnvExamples:
      overrides.gitLsFilesEnvExamples ?? runGitLsFilesEnvExamples(rootDir),
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
