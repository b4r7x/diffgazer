import {
  existsSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import pc from "picocolors";
import type { ConfigLoadResult } from "../config.js";
import { showDryRunDeps } from "../dry-run-preview.js";
import {
  exitAfterSignalCancellation,
  installMutationCancellationHandlers,
  throwIfMutationCancelled,
} from "../mutation-cancellation.js";
import { fileAction, heading, info, newline, promptConfirm, success, warn } from "../terminal.js";

export interface InitWorkflowOptions<TConfig> {
  cwd: string;
  configFileName: string;
  yes: boolean;
  force: boolean;
  dryRun?: boolean;
  skipInstall?: boolean;
  dependencies?: string[];
  onSkipInstall?: (dependencies: string[]) => void;
  loadConfig: (cwd: string) => ConfigLoadResult<TConfig>;
  detectProject: (cwd: string) => { display: Array<[label: string, value: string]> };
  /**
   * Declare every path that `createFiles`, `afterFiles`, or `writeConfig` may
   * create, write, or touch. Paths may be absolute or relative to cwd; directory
   * paths end with `/`. The workflow snapshots only these paths to support
   * rollback without scanning the whole project tree, and on rollback removes
   * any declared planned-path file that did not exist before init ran (so that
   * package manager side effects such as a freshly-created lockfile are also
   * undone, not only restored).
   */
  plannedPaths: (cwd: string) => string[];
  createFiles: (cwd: string) => Array<{ action: "created" | "skipped"; path: string }>;
  afterFiles?: (cwd: string, abortSignal?: AbortSignal) => Promise<void>;
  writeConfig: (cwd: string) => void | Promise<void>;
  nextSteps: string[];
}

function ensurePackageJson(cwd: string): void {
  if (!existsSync(resolve(cwd, "package.json"))) {
    throw new Error("No package.json found. Run `npm init` first.");
  }
}

function checkExistingConfig<TConfig>(
  existing: ConfigLoadResult<TConfig>,
  configFileName: string,
  cwd: string,
  force: boolean,
): "skip" | "continue" {
  if (existing.ok && !force) {
    warn(`${configFileName.replace(/\.json$/, "")} is already initialized in this project.`);
    info(`Config: ${resolve(cwd, configFileName)}`);
    info("Use --force to re-initialize.");
    return "skip";
  }

  if (
    !existing.ok &&
    (existing.error === "parse_error" || existing.error === "validation_error") &&
    !force
  ) {
    throw new Error(
      `${configFileName} is malformed: ${existing.message}\n` +
        `Fix the error or delete ${configFileName} before re-initializing.`,
    );
  }

  return "continue";
}

function showDetected(display: Array<[label: string, value: string]>): void {
  heading("Detected:");
  for (const [label, value] of display) {
    info(`${label}: ${value}`);
  }
  newline();
}

function logFileResults(results: Array<{ action: "created" | "skipped"; path: string }>): void {
  heading("Creating files...");
  for (const result of results) {
    fileAction(result.action === "created" ? pc.green("+") : pc.dim("skip"), result.path);
  }
}

interface PlannedTarget {
  absolutePath: string;
  isDirectory: boolean;
}

function normalizePlannedPaths(cwd: string, paths: string[]): PlannedTarget[] {
  const seen = new Set<string>();
  const targets: PlannedTarget[] = [];
  const cwdResolved = resolve(cwd);
  for (const raw of paths) {
    const isDirectory = raw.endsWith("/") || raw.endsWith("\\");
    const stripped = isDirectory ? raw.replace(/[/\\]+$/, "") : raw;
    const absolutePath = resolve(cwdResolved, stripped);
    if (seen.has(absolutePath)) continue;
    seen.add(absolutePath);
    targets.push({ absolutePath, isDirectory });
  }
  return targets;
}

function showDryRunPlan(
  cwd: string,
  configFileName: string,
  targets: PlannedTarget[],
  dependencies: string[],
): void {
  const configPath = resolve(cwd, configFileName);
  const previewed: PlannedTarget[] = [...targets];
  if (!targets.some((target) => target.absolutePath === configPath)) {
    previewed.push({ absolutePath: configPath, isDirectory: false });
  }

  heading("Paths initialization would create or modify:");
  for (const target of previewed) {
    const exists = existsSync(target.absolutePath);
    const displayPath = relative(cwd, target.absolutePath) || ".";
    fileAction(pc.green(exists ? "~" : "+"), target.isDirectory ? `${displayPath}/` : displayPath);
  }
  showDryRunDeps(dependencies);
}

interface PreExistingState {
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

function snapshotPlannedTargets(
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

function attachRollbackCause(primary: unknown, failures: Error[]): unknown {
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

function showNextSteps(steps: string[]): void {
  newline();
  success("Done!");
  for (const step of steps) {
    info(step);
  }
  newline();
}

export async function runInitWorkflow<TConfig>(
  options: InitWorkflowOptions<TConfig>,
): Promise<void> {
  const {
    cwd,
    configFileName,
    yes,
    force,
    dryRun,
    skipInstall,
    dependencies = [],
    onSkipInstall,
    loadConfig,
    detectProject,
    plannedPaths,
    createFiles,
    afterFiles,
    writeConfig,
    nextSteps,
  } = options;

  ensurePackageJson(cwd);

  const existing = loadConfig(cwd);
  if (checkExistingConfig(existing, configFileName, cwd, force) === "skip") return;

  showDetected(detectProject(cwd).display);

  if (dryRun) {
    showDryRunPlan(
      cwd,
      configFileName,
      normalizePlannedPaths(cwd, plannedPaths(cwd)),
      skipInstall ? [] : dependencies,
    );
    newline();
    info("(dry run - no changes made)");
    return;
  }

  if (!yes) {
    const proceed = await promptConfirm("Continue with initialization?");
    if (!proceed) {
      info("Cancelled.");
      return;
    }
  }

  const targets = normalizePlannedPaths(cwd, plannedPaths(cwd));
  const snapshot = snapshotPlannedTargets(cwd, configFileName, targets);
  const configExisted = snapshot.files.has(resolve(cwd, configFileName));
  let fileResults: Array<{ action: "created" | "skipped"; path: string }> = [];
  const cancellation = installMutationCancellationHandlers();
  try {
    fileResults = createFiles(cwd);
    logFileResults(fileResults);
    if (!skipInstall && afterFiles) {
      await afterFiles(cwd, cancellation.controller.signal);
      throwIfMutationCancelled(cancellation);
    }

    await writeConfig(cwd);
    throwIfMutationCancelled(cancellation);
    fileAction(pc.green("+"), configFileName);
    if (skipInstall && dependencies.length > 0) onSkipInstall?.(dependencies);
  } catch (error) {
    cancellation.dispose();
    if (cancellation.receivedSignal.current) {
      const rollbackFailures: Error[] = [];
      removeCreatedResults(cwd, fileResults, snapshot.dirs, rollbackFailures);
      removeUnplannedlyCreatedFiles(snapshot.plannedFilePaths, snapshot.files, rollbackFailures);
      removeCreatedPlannedDirs(cwd, snapshot, rollbackFailures);
      restoreSnapshottedFiles(snapshot.files, rollbackFailures);
      if (!configExisted) {
        const configPath = resolve(cwd, configFileName);
        recordRollbackFailure(rollbackFailures, `remove ${configPath}`, () => {
          rmSync(configPath, { force: true });
        });
      }
      exitAfterSignalCancellation(cancellation.receivedSignal.current);
    }
    const rollbackFailures: Error[] = [];
    removeCreatedResults(cwd, fileResults, snapshot.dirs, rollbackFailures);
    removeUnplannedlyCreatedFiles(snapshot.plannedFilePaths, snapshot.files, rollbackFailures);
    removeCreatedPlannedDirs(cwd, snapshot, rollbackFailures);
    restoreSnapshottedFiles(snapshot.files, rollbackFailures);
    if (!configExisted) {
      const configPath = resolve(cwd, configFileName);
      recordRollbackFailure(rollbackFailures, `remove ${configPath}`, () => {
        rmSync(configPath, { force: true });
      });
    }
    throw attachRollbackCause(error, rollbackFailures);
  } finally {
    cancellation.dispose();
  }

  showNextSteps(nextSteps);
}
