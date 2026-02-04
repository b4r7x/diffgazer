import { homedir } from "node:os";
import * as path from "node:path";

export const PROJECT_ROOT_HEADER = "x-stargazer-project-root";

const DEFAULT_GLOBAL_DIR = path.join(homedir(), ".stargazer");

const normalizePath = (input: string): string => path.resolve(input.trim());

export const resolveProjectRoot = (options?: {
  header?: string | null;
  env?: string | null;
  cwd?: string | null;
}): string => {
  const header = options?.header?.trim();
  if (header) return normalizePath(header);

  const env = options?.env?.trim();
  if (env) return normalizePath(env);

  const cwd = options?.cwd?.trim();
  if (cwd) return normalizePath(cwd);

  return normalizePath(process.cwd());
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

export const getGlobalReviewsDir = (): string =>
  path.join(getGlobalStargazerDir(), "reviews");

export const getGlobalReviewFile = (reviewId: string): string =>
  path.join(getGlobalReviewsDir(), `${reviewId}.json`);

export const getProjectStargazerDir = (projectRoot: string): string =>
  path.join(projectRoot, ".stargazer");

export const getProjectInfoPath = (projectRoot: string): string =>
  path.join(getProjectStargazerDir(projectRoot), "project.json");

export const getProjectReviewsDir = (projectRoot: string): string =>
  path.join(getProjectStargazerDir(projectRoot), "reviews");

export const getProjectReviewFile = (projectRoot: string, reviewId: string): string =>
  path.join(getProjectReviewsDir(projectRoot), `${reviewId}.json`);
