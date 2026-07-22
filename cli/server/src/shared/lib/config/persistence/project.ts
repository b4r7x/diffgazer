import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { isNodeError, writeJsonFileSync, writeJsonFileSyncExclusive } from "../../fs.js";
import { log } from "../../log.js";
import { getProjectInfoPath } from "../../paths.js";
import type { ProjectFile } from "../types.js";
import { loadOrQuarantine, RESERVED_PROJECT_IDS } from "./load-json.js";

const SafeProjectIdSchema = z
  .string()
  .min(1)
  .refine((id) => !RESERVED_PROJECT_IDS.has(id), { error: "projectId is reserved" });

const ProjectFileSchema = z.object({
  projectId: SafeProjectIdSchema,
  repoRoot: z.string().min(1),
  createdAt: z.string().min(1),
});

const resolveProjectRootPath = (projectRoot: string): string => {
  try {
    return realpathSync(resolve(projectRoot));
  } catch {
    return resolve(projectRoot);
  }
};

const projectFileMatchesRoot = (file: ProjectFile, projectRoot: string): boolean => {
  const resolvedProject = resolveProjectRootPath(projectRoot);
  try {
    return realpathSync(resolve(file.repoRoot)) === resolvedProject;
  } catch {
    return resolve(file.repoRoot) === resolvedProject;
  }
};

/** Migrates moved-project state and reports when project.json may commit the new root. */
export interface ReadProjectFileOptions {
  onMove?: (oldRepoRoot: string, newRepoRoot: string) => Promise<boolean>;
}

const projectMoveFlights = new Map<string, Promise<void>>();

function scheduleProjectMove(
  projectInfoPath: string,
  current: ProjectFile,
  moved: ProjectFile,
  onMove: NonNullable<ReadProjectFileOptions["onMove"]>,
): void {
  if (projectMoveFlights.has(projectInfoPath)) return;

  const flight = onMove(current.repoRoot, moved.repoRoot)
    .then((completed) => {
      if (!completed) return;
      const latest = loadOrQuarantine(projectInfoPath, "project file", ProjectFileSchema);
      if (
        !latest ||
        latest.projectId !== current.projectId ||
        latest.repoRoot !== current.repoRoot
      ) {
        return;
      }
      writeJsonFileSync(projectInfoPath, moved, 0o600);
    })
    .catch((error) => {
      log("warn", "review_rekey_failed", { error });
    })
    .finally(() => {
      projectMoveFlights.delete(projectInfoPath);
    });
  projectMoveFlights.set(projectInfoPath, flight);
}

export const readProjectFile = (
  projectRoot: string,
  options: ReadProjectFileOptions = {},
): ProjectFile | null => {
  const projectInfoPath = getProjectInfoPath(projectRoot);
  const loaded = loadOrQuarantine(projectInfoPath, "project file", ProjectFileSchema);
  if (!loaded) return null;
  if (!projectFileMatchesRoot(loaded, projectRoot)) {
    const moved: ProjectFile = { ...loaded, repoRoot: projectRoot };
    if (options.onMove) {
      scheduleProjectMove(projectInfoPath, loaded, moved, options.onMove);
    } else {
      writeJsonFileSync(projectInfoPath, moved, 0o600);
    }
    return moved;
  }
  return loaded;
};

export const createProjectFile = (
  projectRoot: string,
  options: ReadProjectFileOptions = {},
): ProjectFile => {
  const existing = readProjectFile(projectRoot, options);
  if (existing) return existing;

  const created: ProjectFile = {
    projectId: randomUUID(),
    repoRoot: projectRoot,
    createdAt: new Date().toISOString(),
  };

  try {
    writeJsonFileSyncExclusive(getProjectInfoPath(projectRoot), created, 0o600);
    return created;
  } catch (error) {
    if (!isNodeError(error, "EEXIST")) throw error;

    const winner = readProjectFile(projectRoot, options);
    if (winner) return winner;
    throw new Error("Project identity winner could not be read after exclusive creation", {
      cause: error,
    });
  }
};
