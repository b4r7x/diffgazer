import type { ProjectInfo } from "@diffgazer/core/schemas/config";
import { resolveProjectRoot } from "../../paths.js";
import { createProjectFile, readProjectFile } from "../persistence/project.js";
import { getConfigSeams } from "../seams.js";
import type { TrustStore } from "../trust-store.js";

type ProjectStoreDependencies = Readonly<{
  trustStore: TrustStore;
}>;

const resolveProjectRootForStore = (projectRoot?: string): string =>
  resolveProjectRoot({
    header: projectRoot ?? null,
    env: process.env.DIFFGAZER_PROJECT_ROOT ?? null,
    cwd: process.cwd(),
  });

export function createProjectStore(deps: ProjectStoreDependencies) {
  const getProjectInfoForResolvedRoot = (resolvedRoot: string): ProjectInfo => {
    const projectFile = readProjectFile(resolvedRoot);
    return {
      path: resolvedRoot,
      projectId: projectFile?.projectId ?? null,
      trust: projectFile ? deps.trustStore.getTrust(projectFile.projectId) : null,
    };
  };

  const getProjectInfo = (projectRoot?: string): ProjectInfo =>
    getProjectInfoForResolvedRoot(resolveProjectRootForStore(projectRoot));

  const ensureProjectFile = (projectRoot: string): ProjectInfo => {
    const resolvedRoot = resolveProjectRootForStore(projectRoot);
    const projectFile = createProjectFile(resolvedRoot, {
      onMove: (oldRepoRoot, newRepoRoot) =>
        getConfigSeams().reviewRekeyHandler(oldRepoRoot, newRepoRoot),
      reconcileMove: true,
    });
    return {
      path: resolvedRoot,
      projectId: projectFile.projectId,
      trust: deps.trustStore.getTrust(projectFile.projectId),
    };
  };

  return { getProjectInfo, getProjectInfoForResolvedRoot, ensureProjectFile };
}
