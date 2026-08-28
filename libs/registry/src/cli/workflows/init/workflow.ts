import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import pc from "picocolors";
import type { ConfigLoadResult } from "../../config.js";
import { showDryRunDeps } from "../../dry-run-preview.js";
import {
  exitAfterSignalCancellation,
  installMutationCancellationHandlers,
  throwIfMutationCancelled,
} from "../../mutation-cancellation.js";
import {
  fileAction,
  heading,
  info,
  newline,
  promptConfirm,
  success,
  warn,
} from "../../terminal.js";
import type { PlannedTarget } from "./rollback.js";
import { attachRollbackCause, rollbackInit, snapshotPlannedTargets } from "./rollback.js";

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
      rollbackInit(cwd, snapshot, fileResults, configFileName, configExisted);
      exitAfterSignalCancellation(cancellation.receivedSignal.current);
    }
    throw attachRollbackCause(
      error,
      rollbackInit(cwd, snapshot, fileResults, configFileName, configExisted),
    );
  } finally {
    cancellation.dispose();
  }

  showNextSteps(nextSteps);
}
