import { relative } from "node:path";
import pc from "picocolors";
import { installMutationCancellationHandlers } from "../../mutation-cancellation.js";
import { error, fileAction, heading, info, newline, promptConfirm } from "../../terminal.js";
import { collectRemovalTargets } from "./targets.js";
import {
  announcedRemovedNames,
  beginRemovalTransaction,
  deleteRemovalFiles,
  finalizeRemoval,
  joinAnnounced,
  restoreFileSnapshots,
  runDerivedRemoval,
} from "./transaction.js";
import type { BlockedRemoval, RemoveInvocation, RunRemoveWorkflowOptions } from "./types.js";

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

function reportUnremovedRequested(
  requested: string[],
  removed: ReadonlySet<string>,
  dryRun: boolean,
  deleted: ReadonlySet<string> = new Set(),
): void {
  if (dryRun) return;
  const unremoved = requested.filter((name) => !removed.has(name));
  if (unremoved.length === 0) return;
  for (const name of unremoved) {
    error(
      deleted.has(name)
        ? `Not removed: ${name} (its files are gone, but it stays tracked for a preserved artifact)`
        : `Not removed: ${name}`,
    );
  }
  throw new Error(
    `Failed to remove ${unremoved.length} requested ${unremoved.length === 1 ? "item" : "items"}: ${unremoved.join(", ")}`,
  );
}

/**
 * Runs a project mutation with SIGINT/SIGTERM handlers installed. Registering
 * them suppresses the signal's default terminate disposition, so a Ctrl-C
 * between the file deletion and the manifest commit cannot leave the manifest
 * listing files that are already gone.
 */
function runUninterrupted<T>(mutate: () => T): T {
  const cancellation = installMutationCancellationHandlers();
  try {
    return mutate();
  } finally {
    cancellation.dispose();
  }
}

async function executeRemoval<TItem, TConfig, TMetadata>(
  options: RunRemoveWorkflowOptions<TItem, TConfig, TMetadata>,
  config: TConfig,
  files: Set<string>,
  dirs: Set<string>,
  ownedFiles: Set<string>,
  removedNames: string[],
): Promise<string[] | null> {
  const { cwd, yes, dryRun } = options;
  showRemovePreview(cwd, files);

  if (dryRun) {
    const derived = runDerivedRemoval(options, config, removedNames);
    info("(dry run - no changes made)");
    return announcedRemovedNames(removedNames, derived.retainedNames);
  }

  if (!yes) {
    const proceed = await promptConfirm(`Remove ${files.size} file(s)?`, false);
    if (!proceed) {
      info("Cancelled.");
      return null;
    }
  }

  options.validateTransaction?.({ cwd, config });
  return runUninterrupted(() => {
    const snapshot = beginRemovalTransaction(options, config, ownedFiles);
    const { removed, failures, causes } = deleteRemovalFiles(options, config, files);

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

    return finalizeRemoval(
      options,
      config,
      dirs,
      removedNames,
      snapshot,
      (announced) => `Removed ${removed} file(s)${joinAnnounced(announced)}.`,
    );
  });
}

export async function runRemoveWorkflow<TItem, TConfig, TMetadata = undefined>(
  options: RunRemoveWorkflowOptions<TItem, TConfig, TMetadata>,
): Promise<void> {
  const invocation: RemoveInvocation<TConfig> = {
    cwd: options.cwd,
    config: options.requireConfig(options.cwd),
  };

  options.validateNames(options.names, invocation);
  const expansion = options.expandRequestedNames
    ? options.expandRequestedNames({
        ...invocation,
        names: options.names,
      })
    : { toRemove: options.names, blocked: [], dependencyGraph: undefined };
  if (options.expandRequestedNames && expansion.dependencyGraph === undefined) {
    throw new Error("Removal expansion must provide a dependency graph.");
  }
  reportBlocked(expansion.blocked);

  let announcedRemoved: string[] = [];

  if (expansion.toRemove.length === 0) {
    if (expansion.blocked.length === 0) {
      info(`No installed files found for the specified ${options.itemPlural}.`);
    }
    reportUnremovedRequested(options.names, new Set(announcedRemoved), options.dryRun);
    return;
  }

  const { files, dirs, ownedFiles, removedNames } = collectRemovalTargets(
    options,
    invocation.config,
    expansion.toRemove,
    expansion.dependencyGraph,
  );
  if (files.size === 0 && removedNames.length === 0) {
    if (expansion.blocked.length === 0) {
      info(`No installed files found for the specified ${options.itemPlural}.`);
    }
    reportUnremovedRequested(options.names, new Set(announcedRemoved), options.dryRun);
    return;
  }

  if (files.size === 0 && removedNames.length > 0) {
    // All owned files are already gone (stale entries). Clean up the manifest.
    if (!options.dryRun) {
      options.validateTransaction?.({ cwd: options.cwd, config: invocation.config });
      announcedRemoved = runUninterrupted(() =>
        finalizeRemoval(
          options,
          invocation.config,
          new Set(),
          removedNames,
          beginRemovalTransaction(options, invocation.config, ownedFiles),
          (announced) =>
            `Cleaned ${announced.length} stale manifest entry/entries${joinAnnounced(announced)}.`,
        ),
      );
    } else {
      const derived = runDerivedRemoval(options, invocation.config, removedNames);
      announcedRemoved = announcedRemovedNames(removedNames, derived.retainedNames);
      info(
        `Would clean ${announcedRemoved.length} stale manifest entry/entries${joinAnnounced(announcedRemoved)}.`,
      );
      info("(dry run - no changes made)");
    }
    reportUnremovedRequested(
      options.names,
      new Set(announcedRemoved),
      options.dryRun,
      new Set(removedNames),
    );
    return;
  }

  const removalAnnounced = await executeRemoval(
    options,
    invocation.config,
    files,
    dirs,
    ownedFiles,
    removedNames,
  );
  if (removalAnnounced === null) return;
  reportUnremovedRequested(
    options.names,
    new Set(removalAnnounced),
    options.dryRun,
    new Set(removedNames),
  );
}
