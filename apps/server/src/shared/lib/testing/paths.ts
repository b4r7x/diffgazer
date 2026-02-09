import { vi } from "vitest";

export const PROJECT_ROOT_HEADER = "x-diffgazer-project-root";

export const resolveProjectRoot = vi.fn(
  (opts?: { header?: string | null; env?: string | null; cwd?: string }) =>
    opts?.header ?? opts?.cwd ?? "/mock/cwd",
);

export const getGlobalDiffgazerDir = vi.fn(() => "/mock/.diffgazer");

export const getGlobalConfigPath = vi.fn(() => "/mock/config.json");

export const getGlobalSecretsPath = vi.fn(() => "/mock/secrets.json");

export const getGlobalTrustPath = vi.fn(() => "/mock/trust.json");

export const getGlobalOpenRouterModelsPath = vi.fn(
  () => "/mock/.diffgazer/openrouter-models.json",
);

export const getProjectDiffgazerDir = vi.fn(
  (projectRoot: string) => `${projectRoot}/.diffgazer`,
);

export const getProjectInfoPath = vi.fn(
  (projectRoot: string) => `${projectRoot}/.diffgazer/project.json`,
);
