import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import pc from "picocolors";
import type { ConfigLoadResult } from "../config.js";
import { fileAction, heading, info, newline, promptConfirm, success, warn } from "../terminal.js";

export interface InitWorkflowOptions<TConfig> {
  cwd: string;
  configFileName: string;
  yes: boolean;
  force: boolean;
  dryRun?: boolean;
  skipInstall?: boolean;
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
  afterFiles?: (cwd: string) => Promise<void>;
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
        `Fix the syntax error, delete ${configFileName}, or use --force to re-initialize.`,
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
}

function snapshotPlannedTargets(
  cwd: string,
  configFileName: string,
  targets: PlannedTarget[],
): PreExistingState {
  const files = new Map<string, Buffer>();
  const dirs = new Set<string>();
  const plannedFilePaths = new Set<string>();
  const cwdResolved = resolve(cwd);
  const configPath = resolve(cwdResolved, configFileName);

  const candidatePaths = new Set<string>();
  for (const target of targets) {
    candidatePaths.add(target.absolutePath);
    collectAncestorDirs(target.absolutePath, cwdResolved, candidatePaths);
    if (!target.isDirectory && target.absolutePath !== configPath) {
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

  return { files, dirs, plannedFilePaths };
}

function collectAncestorDirs(path: string, cwd: string, sink: Set<string>): void {
  let current = dirname(path);
  while (current !== cwd && current !== dirname(current)) {
    sink.add(current);
    current = dirname(current);
  }
  sink.add(cwd);
}

function restoreSnapshottedFiles(snapshot: Map<string, Buffer>): void {
  for (const [path, content] of snapshot) {
    if (!existsSync(path) || !readFileSync(path).equals(content)) {
      writeFileSync(path, content);
    }
  }
}

function removeUnplannedlyCreatedFiles(
  plannedFilePaths: Set<string>,
  preExistingFiles: Map<string, Buffer>,
): void {
  for (const path of plannedFilePaths) {
    if (preExistingFiles.has(path)) continue;
    if (!existsSync(path)) continue;
    rmSync(path, { force: true });
  }
}

function removeCreatedResults(
  cwd: string,
  results: Array<{ action: "created" | "skipped"; path: string }>,
  existingDirs: Set<string>,
): void {
  const created = results
    .filter((result) => result.action === "created")
    .map((result) => resolve(cwd, result.path));

  for (const path of created.sort((a, b) => b.length - a.length)) {
    if (!existsSync(path)) continue;
    rmSync(path, { recursive: statSync(path).isDirectory(), force: true });
  }

  const parents = new Set(created.map((path) => dirname(path)));
  for (const path of [...parents].sort((a, b) => b.length - a.length)) {
    let current = path;
    while (current !== resolve(cwd) && !existingDirs.has(current) && existsSync(current)) {
      try {
        rmSync(current, { recursive: false });
      } catch {
        break;
      }
      current = dirname(current);
    }
  }
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
    loadConfig,
    detectProject,
    plannedPaths,
    createFiles,
    afterFiles,
    writeConfig,
    nextSteps,
  } = options;

  if (typeof plannedPaths !== "function") {
    throw new TypeError(
      "runInitWorkflow requires a `plannedPaths` callback that lists every file or " +
        "directory the init may create, write, or touch (config file is included " +
        "automatically). This is mandatory so rollback can restore package.json, " +
        "lockfiles, and freshly-created files when writeConfig fails after install.",
    );
  }

  ensurePackageJson(cwd);

  const existing = loadConfig(cwd);
  if (checkExistingConfig(existing, configFileName, cwd, force) === "skip") return;

  showDetected(detectProject(cwd).display);

  if (!yes) {
    const proceed = await promptConfirm("Continue with initialization?");
    if (!proceed) {
      info("Cancelled.");
      return;
    }
  }

  if (dryRun) {
    info("(dry run - no changes made)");
    return;
  }

  const targets = normalizePlannedPaths(cwd, plannedPaths(cwd));
  const snapshot = snapshotPlannedTargets(cwd, configFileName, targets);
  const configExisted = snapshot.files.has(resolve(cwd, configFileName));
  let fileResults: Array<{ action: "created" | "skipped"; path: string }> = [];
  try {
    fileResults = createFiles(cwd);
    logFileResults(fileResults);
    if (afterFiles && !skipInstall) await afterFiles(cwd);

    await writeConfig(cwd);
    fileAction(pc.green("+"), configFileName);
  } catch (error) {
    removeCreatedResults(cwd, fileResults, snapshot.dirs);
    removeUnplannedlyCreatedFiles(snapshot.plannedFilePaths, snapshot.files);
    restoreSnapshottedFiles(snapshot.files);
    if (!configExisted) rmSync(resolve(cwd, configFileName), { force: true });
    throw error;
  }

  showNextSteps(nextSteps);
}
