import { homedir } from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";

export const PROJECT_ROOT_HEADER = "x-stargazer-project-root";

const DEFAULT_GLOBAL_DIR = path.join(homedir(), ".stargazer");

const normalizePath = (input: string): string => path.resolve(input.trim());

const isAllowedPath = (resolved: string): boolean => {
  const home = homedir();
  if (resolved.startsWith(home + path.sep) || resolved === home) {
    return true;
  }
  // Allow paths with a .git directory (valid repos outside home)
  try {
    return fs.existsSync(path.join(resolved, ".git"));
  } catch {
    return false;
  }
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
      throw new Error("Invalid project root: path must be under user home or contain a .git directory");
    }
    return resolved;
  }

  const env = options?.env?.trim();
  if (env) return normalizePath(env);

  const cwd = options?.cwd?.trim() ?? process.cwd();
  const normalized = normalizePath(cwd);
  return findGitRoot(normalized) ?? normalized;
};

export const getGlobalStargazerDir = (): string => {
  const override = process.env.STARGAZER_HOME?.trim();
  if (override) return normalizePath(override);
  return DEFAULT_GLOBAL_DIR;
};

export const getGlobalConfigPath = (): string =>
  path.join(getGlobalStargazerDir(), "config.json");

export const getGlobalSecretsPath = (): string =>
  path.join(getGlobalStargazerDir(), "secrets.json");

export const getGlobalTrustPath = (): string =>
  path.join(getGlobalStargazerDir(), "trust.json");

export const getGlobalOpenRouterModelsPath = (): string =>
  path.join(getGlobalStargazerDir(), "openrouter-models.json");

export const getProjectStargazerDir = (projectRoot: string): string =>
  path.join(projectRoot, ".stargazer");

export const getProjectInfoPath = (projectRoot: string): string =>
  path.join(getProjectStargazerDir(projectRoot), "project.json");
