import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { info, success, warn, heading, fileAction, newline, promptConfirm } from "../logger.js";
import type { ConfigLoadResult } from "../config.js";
import pc from "picocolors";

export interface InitWorkflowOptions<TConfig> {
  cwd: string;
  configFileName: string;
  yes: boolean;
  force: boolean;
  dryRun?: boolean;
  skipInstall?: boolean;
  loadConfig: (cwd: string) => ConfigLoadResult<TConfig>;
  detectProject: (cwd: string) => { display: Array<[label: string, value: string]> };
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

  if (!existing.ok && (existing.error === "parse_error" || existing.error === "validation_error") && !force) {
    throw new Error(
      `${configFileName} is malformed: ${existing.message}\n`
      + `Fix the syntax error, delete ${configFileName}, or use --force to re-initialize.`,
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
    fileAction(
      result.action === "created" ? pc.green("+") : pc.dim("skip"),
      result.path,
    );
  }
}

function snapshotExistingFiles(cwd: string, paths: string[]): Map<string, string | null> {
  const snapshots = new Map<string, string | null>();
  for (const path of paths) {
    const absolutePath = resolve(cwd, path);
    snapshots.set(absolutePath, existsSync(absolutePath) ? readFileSync(absolutePath, "utf-8") : null);
  }
  return snapshots;
}

function snapshotProjectFiles(cwd: string): Map<string, Buffer> {
  const snapshots = new Map<string, Buffer>();

  function visit(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile()) {
        snapshots.set(path, readFileSync(path));
      }
    }
  }

  visit(cwd);
  return snapshots;
}

function snapshotProjectDirs(cwd: string): Set<string> {
  const dirs = new Set<string>([resolve(cwd)]);

  function visit(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        dirs.add(path);
        visit(path);
      }
    }
  }

  visit(cwd);
  return dirs;
}

function restoreSnapshots(snapshots: Map<string, string | null>): void {
  for (const [path, content] of snapshots) {
    if (content === null) rmSync(path, { force: true });
    else writeFileSync(path, content);
  }
}

function restoreExistingFiles(snapshots: Map<string, Buffer>): void {
  for (const [path, content] of snapshots) {
    if (!existsSync(path) || !readFileSync(path).equals(content)) {
      writeFileSync(path, content);
    }
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

export async function runInitWorkflow<TConfig>(options: InitWorkflowOptions<TConfig>): Promise<void> {
  const { cwd, configFileName, yes, force, dryRun, skipInstall, loadConfig, detectProject, createFiles, afterFiles, writeConfig, nextSteps } = options;

  ensurePackageJson(cwd);

  const existing = loadConfig(cwd);
  if (checkExistingConfig(existing, configFileName, cwd, force) === "skip") return;

  showDetected(detectProject(cwd).display);

  if (!yes) {
    const proceed = await promptConfirm("Continue with initialization?");
    if (!proceed) { info("Cancelled."); return; }
  }

  if (dryRun) {
    info("(dry run - no changes made)");
    return;
  }

  const snapshots = snapshotExistingFiles(cwd, [configFileName]);
  const existingFiles = snapshotProjectFiles(cwd);
  const existingDirs = snapshotProjectDirs(cwd);
  let fileResults: Array<{ action: "created" | "skipped"; path: string }> = [];
  try {
    fileResults = createFiles(cwd);
    logFileResults(fileResults);
    if (afterFiles && !skipInstall) await afterFiles(cwd);

    await writeConfig(cwd);
    fileAction(pc.green("+"), configFileName);
  } catch (error) {
    removeCreatedResults(cwd, fileResults, existingDirs);
    restoreExistingFiles(existingFiles);
    restoreSnapshots(snapshots);
    throw error;
  }

  showNextSteps(nextSteps);
}
