import * as fs from "node:fs";
import { homedir } from "node:os";
import * as path from "node:path";
import { isNodeError } from "./node-error.js";

export const isPackaged = (): boolean => process.env.DIFFGAZER_PACKAGED === "1";

const DEFAULT_GLOBAL_DIR = path.join(homedir(), ".diffgazer");

const normalizePath = (input: string): string => path.resolve(input.trim());

const isAllowedPath = (resolved: string): boolean => {
  const home = homedir();
  if (resolved.startsWith(home + path.sep) || resolved === home) {
    return true;
  }
  return fs.existsSync(path.join(resolved, ".git"));
};

const findGitRoot = (startPath: string): string | null => {
  let current = startPath;
  while (true) {
    const gitPath = path.join(current, ".git");
    if (fs.existsSync(gitPath)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
};

export const resolveProjectRoot = (options?: {
  header?: string | null;
  env?: string | null;
  cwd?: string | null;
}): string => {
  const header = options?.header?.trim();
  if (header) {
    const resolved = normalizePath(header);
    if (!isAllowedPath(resolved)) {
      throw new Error(
        "Invalid project root: path must be under user home or contain a .git directory",
      );
    }
    return resolved;
  }

  const env = options?.env?.trim();
  if (env) return normalizePath(env);

  const cwd = options?.cwd?.trim() ?? process.cwd();
  const normalized = normalizePath(cwd);
  return findGitRoot(normalized) ?? normalized;
};

export const canonicalizeProjectRoot = (projectRoot: string): string =>
  fs.realpathSync.native(projectRoot);

export const getGlobalDiffgazerDir = (): string => {
  const override = process.env.DIFFGAZER_HOME?.trim();
  if (override) return normalizePath(override);
  return DEFAULT_GLOBAL_DIR;
};

export const getGlobalConfigPath = (): string => path.join(getGlobalDiffgazerDir(), "config.json");

export const getGlobalSecretsPath = (): string =>
  path.join(getGlobalDiffgazerDir(), "secrets.json");

export const getGlobalTrustPath = (): string => path.join(getGlobalDiffgazerDir(), "trust.json");

export const getGlobalModelsDevCatalogPath = (): string =>
  path.join(getGlobalDiffgazerDir(), "models-dev.json");

export const getProjectDiffgazerDir = (projectRoot: string): string =>
  path.join(projectRoot, ".diffgazer");

const isContainedInRoot = (targetRealPath: string, rootRealPath: string): boolean =>
  targetRealPath === rootRealPath || targetRealPath.startsWith(rootRealPath + path.sep);

const canonicalProjectRoot = (projectRoot: string): string => {
  try {
    return fs.realpathSync.native(projectRoot);
  } catch {
    return path.resolve(projectRoot);
  }
};

/**
 * Rejects symlinked or escaping `.diffgazer` directories before project-state I/O.
 * A missing state directory is allowed and will be created inside the project root.
 */
export const assertProjectDiffgazerDirContained = (projectRoot: string): void => {
  const diffgazerDir = path.join(path.resolve(projectRoot), ".diffgazer");
  let stats: fs.Stats;
  try {
    stats = fs.lstatSync(diffgazerDir);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return;
    throw error;
  }

  if (stats.isSymbolicLink()) {
    throw new Error("Project state directory (.diffgazer) must not be a symlink");
  }
  if (!stats.isDirectory()) {
    throw new Error("Project state directory (.diffgazer) must be a directory");
  }

  const normalizedRoot = canonicalProjectRoot(projectRoot);
  const realDiffgazerDir = fs.realpathSync.native(diffgazerDir);
  if (!isContainedInRoot(realDiffgazerDir, normalizedRoot)) {
    throw new Error("Project state directory (.diffgazer) resolves outside the project root");
  }
};

export const isProjectDiffgazerDirContained = (projectRoot: string): boolean => {
  try {
    assertProjectDiffgazerDirContained(projectRoot);
    return true;
  } catch {
    return false;
  }
};

export const getProjectInfoPath = (projectRoot: string): string =>
  path.join(getProjectDiffgazerDir(projectRoot), "project.json");

export const isRepoRelativePath = (value: string): boolean => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[a-zA-Z]:/.test(value)) {
    return false;
  }
  if (value.includes("\0")) {
    return false;
  }
  return !value.split(/[\\/]/).includes("..");
};
