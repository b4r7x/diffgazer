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
        if (existsSync(path)) {
          rmSync(path, { force: true });
        }
      } else if (!existsSync(path) || !readFileSync(path).equals(content)) {
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

export function beginRemovalTransaction<TItem, TConfig, TMetadata>(
  options: RunRemoveWorkflowOptions<TItem, TConfig, TMetadata>,
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
interface DerivedRemovalResult<TMetadata> {
  retainedNames: string[];
  metadata?: TMetadata;
}

export function runDerivedRemoval<TItem, TConfig, TMetadata>(
  options: RunRemoveWorkflowOptions<TItem, TConfig, TMetadata>,
  config: TConfig,
  removedNames: string[],
  snapshot?: RemovalSnapshot,
): DerivedRemovalResult<TMetadata> {
  const plan = options.onAfterRemove?.({
    cwd: options.cwd,
    config,
    removedNames,
    force: options.force,
  });
  if (!plan) return { retainedNames: [] };

  for (const notice of plan.preservedNotices) info(notice);

  if (options.dryRun) {
    for (const write of plan.writes) {
      info(`Would update ${relative(options.cwd, write.targetPath)}`);
    }
    return { retainedNames: plan.retainedNames ?? [], metadata: plan.metadata };
  }

  const allowedBaseDirs = options.resolveAllowedBaseDirs({ cwd: options.cwd, config });
  for (const write of plan.writes) {
    ensureWithinAnyDir(write.targetPath, allowedBaseDirs);
    if (snapshot) addFileSnapshots(snapshot, [write.targetPath], allowedBaseDirs);
    writeFileSync(write.targetPath, write.content);
  }
  return { retainedNames: plan.retainedNames ?? [], metadata: plan.metadata };
}

export function announcedRemovedNames(removedNames: string[], retainedNames: string[]): string[] {
  const retained = new Set(retainedNames);
  return removedNames.filter((name) => !retained.has(name));
}

export function joinAnnounced(names: string[]): string {
  return names.length > 0 ? ` (${names.join(", ")})` : "";
}

function reportOrphanedDeps<TConfig>(opts: {
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

function commitRemovalManifest<TItem, TConfig, TMetadata>(
  options: RunRemoveWorkflowOptions<TItem, TConfig, TMetadata>,
  config: TConfig,
  removedNames: string[],
  retainedNames: string[],
  metadata: TMetadata | undefined,
): void {
  const update = { cwd: options.cwd, config, removedNames, retainedNames };
  options.updateManifest(metadata === undefined ? update : { ...update, metadata });
}

export function finalizeRemoval<TItem, TConfig, TMetadata>(
  options: RunRemoveWorkflowOptions<TItem, TConfig, TMetadata>,
  config: TConfig,
  dirs: Set<string>,
  removedNames: string[],
  snapshot: RemovalSnapshot,
  formatSuccess: (announced: string[]) => string,
): string[] {
  let derived: DerivedRemovalResult<TMetadata>;
  try {
    derived = runDerivedRemoval(options, config, removedNames, snapshot);
    commitRemovalManifest(options, config, removedNames, derived.retainedNames, derived.metadata);
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
  const announced = announcedRemovedNames(removedNames, derived.retainedNames);
  success(formatSuccess(announced));
  newline();
  return announced;
}

export function deleteRemovalFiles<TItem, TConfig, TMetadata>(
  options: RunRemoveWorkflowOptions<TItem, TConfig, TMetadata>,
  config: TConfig,
  files: Set<string>,
): DeleteResult {
  const { cwd } = options;
  return deleteFiles(cwd, files, options.resolveAllowedBaseDirs({ cwd, config }));
}
