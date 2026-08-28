import {
  existsSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

export interface PlannedTarget {
  absolutePath: string;
  isDirectory: boolean;
}

export interface PreExistingState {
  files: Map<string, Buffer>;
  dirs: Set<string>;
  /**
   * Absolute paths of planned-path FILE targets (not directories, not the
   * config file). Used on rollback to remove any planned-path file that exists
   * post-error but had no pre-init snapshot — covers package manager side
   * effects like a freshly-created lockfile.
   */
  plannedFilePaths: Set<string>;
  /**
   * Absolute paths of planned-path DIRECTORY targets. Rolled back independently
   * of the createFiles result array, because a throw partway through createFiles
   * never returns the "created" entries for directories it already made.
   */
  plannedDirPaths: Set<string>;
}

export function snapshotPlannedTargets(
  cwd: string,
  configFileName: string,
  targets: PlannedTarget[],
): PreExistingState {
  const files = new Map<string, Buffer>();
  const dirs = new Set<string>();
  const plannedFilePaths = new Set<string>();
  const plannedDirPaths = new Set<string>();
  const cwdResolved = resolve(cwd);
  const configPath = resolve(cwdResolved, configFileName);

  const candidatePaths = new Set<string>();
  for (const target of targets) {
    candidatePaths.add(target.absolutePath);
    collectAncestorDirs(target.absolutePath, cwdResolved, candidatePaths);
    if (target.isDirectory) {
      plannedDirPaths.add(target.absolutePath);
    } else if (target.absolutePath !== configPath) {
      plannedFilePaths.add(target.absolutePath);
    }
  }
  candidatePaths.add(configPath);
  collectAncestorDirs(configPath, cwdResolved, candidatePaths);

  for (const path of candidatePaths) {
    if (!existsSync(path)) continue;
    const stats = statSync(path);
    if (stats.isDirectory()) {
      dirs.add(path);
    } else if (stats.isFile()) {
      files.set(path, readFileSync(path));
    }
  }

  return { files, dirs, plannedFilePaths, plannedDirPaths };
}

function collectAncestorDirs(path: string, cwd: string, sink: Set<string>): void {
  let current = dirname(path);
  while (current !== cwd && current !== dirname(current)) {
    sink.add(current);
    current = dirname(current);
  }
  sink.add(cwd);
}

function recordRollbackFailure(failures: Error[], action: string, compensation: () => void): void {
  try {
    compensation();
  } catch (error) {
    failures.push(new Error(`Failed to ${action}`, { cause: error }));
  }
}

function restoreSnapshottedFiles(snapshot: Map<string, Buffer>, failures: Error[]): void {
  for (const [path, content] of snapshot) {
    recordRollbackFailure(failures, `restore ${path}`, () => {
      if (!existsSync(path) || !readFileSync(path).equals(content)) {
        writeFileSync(path, content);
      }
    });
  }
}

function removeUnplannedlyCreatedFiles(
  plannedFilePaths: Set<string>,
  preExistingFiles: Map<string, Buffer>,
  failures: Error[],
): void {
  for (const path of plannedFilePaths) {
    if (preExistingFiles.has(path)) continue;
    if (!existsSync(path)) continue;
    recordRollbackFailure(failures, `remove ${path}`, () => rmSync(path, { force: true }));
  }
}

// A throw inside createFiles never returns the directories it already created,
// so rollback derives them from the plan. Only empty directories are removed:
// anything still holding content was either pre-existing or failed its own
// cleanup, and must not be deleted recursively.
function removeCreatedPlannedDirs(
  cwd: string,
  snapshot: PreExistingState,
  failures: Error[],
): void {
  const cwdResolved = resolve(cwd);
  const candidates = [...snapshot.plannedDirPaths]
    .filter((path) => !snapshot.dirs.has(path))
    .sort((a, b) => b.length - a.length);

  for (const candidate of candidates) {
    let current = candidate;
    while (
      current !== cwdResolved &&
      !snapshot.dirs.has(current) &&
      existsSync(current) &&
      readdirSync(current).length === 0
    ) {
      const failureCount = failures.length;
      recordRollbackFailure(failures, `remove directory ${current}`, () => {
        rmdirSync(current);
      });
      if (failures.length > failureCount) break;
      current = dirname(current);
    }
  }
}

function removeCreatedResults(
  cwd: string,
  results: Array<{ action: "created" | "skipped"; path: string }>,
  existingDirs: Set<string>,
  failures: Error[],
): void {
  const created = results
    .filter((result) => result.action === "created")
    .map((result) => resolve(cwd, result.path));

  for (const path of created.sort((a, b) => b.length - a.length)) {
    if (!existsSync(path)) continue;
    recordRollbackFailure(failures, `remove ${path}`, () => {
      rmSync(path, { recursive: statSync(path).isDirectory(), force: true });
    });
  }

  const parents = new Set(created.map((path) => dirname(path)));
  for (const path of [...parents].sort((a, b) => b.length - a.length)) {
    let current = path;
    while (current !== resolve(cwd) && !existingDirs.has(current) && existsSync(current)) {
      const failureCount = failures.length;
      recordRollbackFailure(failures, `remove directory ${current}`, () => {
        rmdirSync(current);
      });
      if (failures.length > failureCount) break;
      current = dirname(current);
    }
  }
}

const ROLLBACK_INCOMPLETE = "Initialization rollback was incomplete";

export function attachRollbackCause(primary: unknown, failures: Error[]): unknown {
  if (failures.length === 0) return primary;
  if (!(primary instanceof Error)) {
    return new Error(String(primary), {
      cause: new AggregateError(failures, ROLLBACK_INCOMPLETE),
    });
  }
  // Keep the primary error's own cause: it carries the underlying I/O identity
  // that triggered the rollback, which the report would otherwise replace.
  const chained = primary.cause === undefined ? failures : [primary.cause, ...failures];
  Object.defineProperty(primary, "cause", {
    value: new AggregateError(chained, ROLLBACK_INCOMPLETE),
    configurable: true,
  });
  return primary;
}

export function rollbackInit(
  cwd: string,
  snapshot: PreExistingState,
  fileResults: Array<{ action: "created" | "skipped"; path: string }>,
  configFileName: string,
  configExisted: boolean,
): Error[] {
  const failures: Error[] = [];
  removeCreatedResults(cwd, fileResults, snapshot.dirs, failures);
  removeUnplannedlyCreatedFiles(snapshot.plannedFilePaths, snapshot.files, failures);
  removeCreatedPlannedDirs(cwd, snapshot, failures);
  restoreSnapshottedFiles(snapshot.files, failures);
  if (!configExisted) {
    const configPath = resolve(cwd, configFileName);
    recordRollbackFailure(failures, `remove ${configPath}`, () => {
      rmSync(configPath, { force: true });
    });
  }
  return failures;
}
