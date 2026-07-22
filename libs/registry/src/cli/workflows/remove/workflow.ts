import { relative } from "node:path";
import pc from "picocolors";
import {
  error,
  fileAction,
  heading,
  info,
  newline,
  promptConfirm,
  success,
} from "../../terminal.js";
import { collectRemovalTargets } from "./targets.js";
import {
  announcedRemovedNames,
  beginRemovalTransaction,
  deleteRemovalFiles,
  finalizeRemoval,
  joinAnnounced,
  reportOrphanedDeps,
  restoreFileSnapshots,
  runDerivedRemoval,
} from "./transaction.js";
import type { BlockedRemoval, RunRemoveWorkflowOptions } from "./types.js";

function showRemovePreview(cwd: string, files: Set<string>): void {
  heading("Files to remove:");
  for (const file of files) {
    fileAction(pc.red("-"), relative(cwd, file));
  }
  newline();
}

function reportBlocked(blocked: BlockedRemoval[]): void {
  for (const entry of blocked) {
    info(`Keeping ${entry.name}; still required by: ${entry.dependents.join(", ")}`);
  }
}

async function executeRemoval<TItem, TConfig>(
  options: RunRemoveWorkflowOptions<TItem, TConfig>,
  config: TConfig,
  files: Set<string>,
  dirs: Set<string>,
  ownedFiles: Set<string>,
  removedNames: string[],
): Promise<void> {
  const { cwd, yes, dryRun } = options;
  showRemovePreview(cwd, files);

  if (dryRun) {
    runDerivedRemoval(options, config, removedNames);
    info("(dry run - no changes made)");
    return;
  }

  if (!yes) {
    const proceed = await promptConfirm(`Remove ${files.size} file(s)?`, false);
    if (!proceed) {
      info("Cancelled.");
      return;
    }
  }

  const snapshot = beginRemovalTransaction(options, config, ownedFiles);
  const { removed, failures, causes } = deleteRemovalFiles(options, config, cwd, files);

  if (failures.length > 0) {
    const failure = new AggregateError(
      causes,
      `Failed to remove ${failures.length} file(s): ${failures.join(", ")}`,
    );
    restoreFileSnapshots(snapshot, failure);
    error(
      `Aborting: ${failures.length} file(s) could not be removed. Manifest and CSS left unchanged.`,
    );
    throw failure;
  }

  finalizeRemoval(options, config, removed, dirs, removedNames, snapshot);
}

export async function runRemoveWorkflow<TItem, TConfig>(
  options: RunRemoveWorkflowOptions<TItem, TConfig>,
): Promise<void> {
  const config = options.requireConfig(options.cwd);
  options.validateNames(options.names);

  const expansion = options.expandRequestedNames?.({
    cwd: options.cwd,
    config,
    names: options.names,
  }) ?? { toRemove: options.names, blocked: [] };
  reportBlocked(expansion.blocked);

  if (expansion.toRemove.length === 0) {
    if (expansion.blocked.length === 0) {
      info(`No installed files found for the specified ${options.itemPlural}.`);
    }
    return;
  }

  const { files, dirs, ownedFiles, removedNames } = collectRemovalTargets(
    options,
    config,
    expansion.toRemove,
  );
  if (files.size === 0 && removedNames.length === 0) {
    if (expansion.blocked.length === 0) {
      info(`No installed files found for the specified ${options.itemPlural}.`);
    }
    return;
  }

  if (files.size === 0 && removedNames.length > 0) {
    // All owned files are already gone (stale entries). Clean up the manifest.
    if (!options.dryRun) {
      const snapshot = beginRemovalTransaction(options, config, ownedFiles);
      let retainedNames: string[];
      try {
        retainedNames = runDerivedRemoval(options, config, removedNames, snapshot);
        options.updateManifest({ cwd: options.cwd, removedNames });
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
      success(
        `Cleaned ${announced.length} stale manifest entry/entries${joinAnnounced(announced)}.`,
      );
      newline();
    } else {
      const retainedNames = runDerivedRemoval(options, config, removedNames);
      const announced = announcedRemovedNames(removedNames, retainedNames);
      info(
        `Would clean ${announced.length} stale manifest entry/entries${joinAnnounced(announced)}.`,
      );
      info("(dry run - no changes made)");
    }
    return;
  }

  await executeRemoval(options, config, files, dirs, ownedFiles, removedNames);
}
