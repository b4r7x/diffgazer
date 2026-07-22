import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { cleanEmptyDirs } from "../../fs/directories.js";
import { ensureWithinAnyDir } from "../../fs/path-safety.js";
import { error, info, newline, success, toErrorMessage } from "../../terminal.js";
import type { RunRemoveWorkflowOptions } from "./types.js";

interface DeleteResult {
  removed: number;
  failures: string[];
  causes: unknown[];
}

export type RemovalSnapshot = Map<string, Uint8Array | null>;

function deleteFiles(cwd: string, files: Set<string>, allowedBaseDirs: string[]): DeleteResult {
  for (const file of files) {
    ensureWithinAnyDir(file, allowedBaseDirs);
  }

  let removed = 0;
  const failures: string[] = [];
  const causes: unknown[] = [];
  for (const file of files) {
    try {
      rmSync(file);
      removed++;
    } catch (e) {
      const rel = relative(cwd, file);
      error(`Failed to remove ${rel}: ${toErrorMessage(e)}`);
      failures.push(rel);
      causes.push(e);
    }
  }
  return { removed, failures, causes };
}

function addFileSnapshots(
  snapshot: RemovalSnapshot,
  paths: Iterable<string>,
  allowedBaseDirs: string[],
): void {
  for (const path of paths) {
    if (snapshot.has(path)) continue;
    ensureWithinAnyDir(path, allowedBaseDirs);
    snapshot.set(path, existsSync(path) ? readFileSync(path) : null);
  }
}

export function restoreFileSnapshots(snapshot: RemovalSnapshot, primaryFailure: unknown): void {
  const rollbackFailures: unknown[] = [];
  for (const [path, content] of [...snapshot].reverse()) {
    try {
      if (content === null) {
        rmSync(path, { force: true });
      } else {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content);
      }
    } catch (rollbackFailure) {
      rollbackFailures.push(rollbackFailure);
    }
  }
  if (rollbackFailures.length > 0) {
    throw new AggregateError(
      [primaryFailure, ...rollbackFailures],
      "Removal failed and rollback was incomplete",
    );
  }
}

export function beginRemovalTransaction<TItem, TConfig>(
  options: RunRemoveWorkflowOptions<TItem, TConfig>,
  config: TConfig,
  ownedFiles: Set<string>,
): RemovalSnapshot {
  const snapshot: RemovalSnapshot = new Map();
  addFileSnapshots(
    snapshot,
    ownedFiles,
    options.resolveAllowedBaseDirs({ cwd: options.cwd, config }),
  );
  addFileSnapshots(
    snapshot,
    options.resolveTransactionFiles?.({ cwd: options.cwd, config }) ?? [],
    [options.cwd],
  );
  return snapshot;
}

// Previews (dry-run) or applies the derived-artifact mutations. Writes are
// validated against the allowed base dirs so a callback can never rewrite a
// file outside the owned directories.
export function runDerivedRemoval<TItem, TConfig>(
  options: RunRemoveWorkflowOptions<TItem, TConfig>,
  config: TConfig,
  removedNames: string[],
  snapshot?: RemovalSnapshot,
): string[] {
  const plan = options.onAfterRemove?.({
    cwd: options.cwd,
    config,
    removedNames,
    force: options.force,
  });
  if (!plan) return [];

  for (const notice of plan.preservedNotices) info(notice);

  if (options.dryRun) {
    for (const write of plan.writes) {
      info(`Would update ${relative(options.cwd, write.targetPath)}`);
    }
    return plan.retainedNames ?? [];
  }

  const allowedBaseDirs = options.resolveAllowedBaseDirs({ cwd: options.cwd, config });
  for (const write of plan.writes) {
    ensureWithinAnyDir(write.targetPath, allowedBaseDirs);
    if (snapshot) addFileSnapshots(snapshot, [write.targetPath], allowedBaseDirs);
    writeFileSync(write.targetPath, write.content);
  }
  return plan.retainedNames ?? [];
}

export function announcedRemovedNames(removedNames: string[], retainedNames: string[]): string[] {
  const retained = new Set(retainedNames);
  return removedNames.filter((name) => !retained.has(name));
}

export function joinAnnounced(names: string[]): string {
  return names.length > 0 ? ` (${names.join(", ")})` : "";
}

export function reportOrphanedDeps<TConfig>(opts: {
  cwd: string;
  names: string[];
  config: TConfig;
  findOrphanedDeps?: (ctx: { removedNames: string[]; cwd: string; config: TConfig }) => string[];
}): void {
  const orphaned =
    opts.findOrphanedDeps?.({ removedNames: opts.names, cwd: opts.cwd, config: opts.config }) ?? [];
  if (orphaned.length > 0) {
    info(`Note: You may want to remove unused packages: ${orphaned.join(", ")}`);
  }
}

export function finalizeRemoval<TItem, TConfig>(
  options: RunRemoveWorkflowOptions<TItem, TConfig>,
  config: TConfig,
  removed: number,
  dirs: Set<string>,
  removedNames: string[],
  snapshot: RemovalSnapshot,
): void {
  let retainedNames: string[];
  try {
    retainedNames = runDerivedRemoval(options, config, removedNames, snapshot);
    options.updateManifest({ cwd: options.cwd, removedNames });
    cleanEmptyDirs([...dirs]);
  } catch (failure) {
    restoreFileSnapshots(snapshot, failure);
    throw failure;
  }
  reportOrphanedDeps({
    cwd: options.cwd,
    names: removedNames,
    config,
    findOrphanedDeps: options.findOrphanedDeps,
  });

  newline();
  const announced = announcedRemovedNames(removedNames, retainedNames);
  success(`Removed ${removed} file(s)${joinAnnounced(announced)}.`);
  newline();
}

export function deleteRemovalFiles<TItem, TConfig>(
  options: RunRemoveWorkflowOptions<TItem, TConfig>,
  config: TConfig,
  cwd: string,
  files: Set<string>,
): { removed: number; failures: string[]; causes: unknown[] } {
  const allowedBaseDirs = options.resolveAllowedBaseDirs({ cwd, config });
  return deleteFiles(cwd, files, allowedBaseDirs);
}
