import { vi } from "vitest";

export const PROJECT_ROOT_HEADER = "x-stargazer-project-root";

export const resolveProjectRoot = vi.fn(
  (opts?: { header?: string | null; env?: string | null; cwd?: string }) =>
    opts?.header ?? opts?.cwd ?? "/mock/cwd",
);

export const getGlobalStargazerDir = vi.fn(() => "/mock/.stargazer");

export const getGlobalConfigPath = vi.fn(() => "/mock/config.json");

export const getGlobalSecretsPath = vi.fn(() => "/mock/secrets.json");

export const getGlobalTrustPath = vi.fn(() => "/mock/trust.json");

export const getGlobalOpenRouterModelsPath = vi.fn(
  () => "/mock/.stargazer/openrouter-models.json",
);

export const getProjectStargazerDir = vi.fn(
  (projectRoot: string) => `${projectRoot}/.stargazer`,
);

export const getProjectInfoPath = vi.fn(
  (projectRoot: string) => `${projectRoot}/.stargazer/project.json`,
);
