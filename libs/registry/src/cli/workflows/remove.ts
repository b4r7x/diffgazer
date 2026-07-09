import { existsSync, rmSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import pc from "picocolors";
import { cleanEmptyDirs, ensureWithinAnyDir } from "../fs.js";
import {
  error,
  fileAction,
  heading,
  info,
  newline,
  promptConfirm,
  success,
  toErrorMessage,
} from "../terminal.js";

export interface RemoveWorkflowFile {
  absolutePath: string;
}

export function findOrphanedNpmDeps<TItem>(opts: {
  removedNames: string[];
  getAllItems: () => TItem[];
  getItemName: (item: TItem) => string;
  getItemDeps: (item: TItem) => string[];
  isInstalled: (item: TItem) => boolean;
}): string[] {
  const allItems = opts.getAllItems();
  const removedSet = new Set(opts.removedNames);
  const removedDeps = new Set(
    opts.removedNames.flatMap((n) => {
      const item = allItems.find((i) => opts.getItemName(i) === n);
      return item ? opts.getItemDeps(item) : [];
    }),
  );
  if (removedDeps.size === 0) return [];

  const remainingDeps = new Set(
    allItems
      .filter((i) => !removedSet.has(opts.getItemName(i)) && opts.isInstalled(i))
      .flatMap((i) => opts.getItemDeps(i)),
  );
  return [...removedDeps].filter((d) => !remainingDeps.has(d));
}

export interface BlockedRemoval {
  name: string;
  dependents: string[];
}

export interface ExpandRequestedNamesResult {
  toRemove: string[];
  blocked: BlockedRemoval[];
}

export interface DerivedRemovalPlan {
  // Files to rewrite (e.g. styles.css with removed chunks stripped). Applied
  // only after validation against the allowed base dirs.
  writes: Array<{ targetPath: string; content: string }>;
  // Notices for artifacts kept because their on-disk content drifted.
  preservedNotices: string[];
  // Names kept tracked because a derived artifact was preserved; excluded from
  // the "Removed …" summary so it does not contradict the preservation notice.
  retainedNames?: string[];
}

export interface RunRemoveWorkflowOptions<TItem, TConfig> {
  cwd: string;
  names: string[];
  yes: boolean;
  dryRun: boolean;
  force: boolean;
  itemPlural: string;
  requireConfig: (cwd: string) => TConfig;
  validateNames: (names: string[]) => void;
  getAllItems: () => TItem[];
  getItemOrThrow: (name: string) => TItem;
  getItemName: (item: TItem) => string;
  isInstalled: (ctx: { cwd: string; config: TConfig; item: TItem }) => boolean;
  resolveFilesForItem: (ctx: { cwd: string; config: TConfig; item: TItem }) => RemoveWorkflowFile[];
  canRemoveFile?: (ctx: {
    cwd: string;
    config: TConfig;
    item: TItem;
    file: RemoveWorkflowFile;
    force: boolean;
    requestedNames: string[];
  }) => boolean;
  resolveAllowedBaseDirs: (ctx: { cwd: string; config: TConfig }) => string[];
  updateManifest: (ctx: { cwd: string; removedNames: string[] }) => void;
  findOrphanedDeps?: (ctx: { removedNames: string[]; cwd: string; config: TConfig }) => string[];
  // Expands requested names with cascade-orphaned transitives; items still
  // depended on are reported as skipped, not failed.
  expandRequestedNames?: (ctx: {
    cwd: string;
    config: TConfig;
    names: string[];
  }) => ExpandRequestedNamesResult;
  // Plans derived-artifact mutations once the removed set is known; the workflow
  // previews them under --dry-run and applies them on a real run. The callback
  // MUST NOT write to disk itself.
  onAfterRemove?: (ctx: {
    cwd: string;
    config: TConfig;
    removedNames: string[];
    force: boolean;
    // biome-ignore lint/suspicious/noConfusingVoidType: `void` (not `undefined`) keeps a plain `() => void` handler assignable here; the callback may return a plan or nothing.
  }) => DerivedRemovalPlan | void;
}

interface ResolveCtx<TItem, TConfig> {
  cwd: string;
  config: TConfig;
  resolveFilesForItem: (ctx: { cwd: string; config: TConfig; item: TItem }) => RemoveWorkflowFile[];
}

function collectRetainedFiles<TItem, TConfig>(
  ctx: ResolveCtx<TItem, TConfig>,
  items: TItem[],
): Set<string> {
  const retained = new Set<string>();
  for (const item of items) {
    for (const file of ctx.resolveFilesForItem({ cwd: ctx.cwd, config: ctx.config, item })) {
      retained.add(file.absolutePath);
    }
  }
  return retained;
}

function collectFilesToRemove<TItem, TConfig>(
  ctx: ResolveCtx<TItem, TConfig> & {
    getItemOrThrow: (name: string) => TItem;
    canRemoveFile?: RunRemoveWorkflowOptions<TItem, TConfig>["canRemoveFile"];
    force: boolean;
    requestedNames: string[];
  },
  names: string[],
  retainedFiles: Set<string>,
): { files: Set<string>; dirs: Set<string>; removedNames: string[] } {
  const files = new Set<string>();
  const dirs = new Set<string>();
  const removedNames: string[] = [];
  for (const name of names) {
    const item = ctx.getItemOrThrow(name);
    const removableFiles: RemoveWorkflowFile[] = [];
    let blocked = false;
    let hadMissingFiles = false;
    for (const file of ctx.resolveFilesForItem({ cwd: ctx.cwd, config: ctx.config, item })) {
      if (!existsSync(file.absolutePath)) {
        hadMissingFiles = true;
        info(`Skipping ${relative(ctx.cwd, file.absolutePath)}: file not found on disk`);
        continue;
      }
      if (retainedFiles.has(file.absolutePath)) continue;
      if (
        ctx.canRemoveFile &&
        !ctx.canRemoveFile({
          cwd: ctx.cwd,
          config: ctx.config,
          item,
          file,
          force: ctx.force,
          requestedNames: ctx.requestedNames,
        })
      ) {
        info(
          `Skipping ${name}: ${relative(ctx.cwd, file.absolutePath)} has been modified (use --force to override)`,
        );
        blocked = true;
        break;
      }
      removableFiles.push(file);
    }
    if (blocked) continue;
    if (removableFiles.length > 0 || (ctx.force && hadMissingFiles)) {
      removedNames.push(name);
    }
    for (const file of removableFiles) {
      files.add(file.absolutePath);
      dirs.add(dirname(file.absolutePath));
    }
  }
  return { files, dirs, removedNames };
}

function showRemovePreview(cwd: string, files: Set<string>): void {
  heading("Files to remove:");
  for (const file of files) {
    fileAction(pc.red("-"), relative(cwd, file));
  }
  newline();
}

interface DeleteResult {
  removed: number;
  failures: string[];
}

function deleteFiles(cwd: string, files: Set<string>, allowedBaseDirs: string[]): DeleteResult {
  for (const file of files) {
    ensureWithinAnyDir(file, allowedBaseDirs);
  }

  let removed = 0;
  const failures: string[] = [];
  for (const file of files) {
    try {
      rmSync(file);
      removed++;
    } catch (e) {
      const rel = relative(cwd, file);
      error(`Failed to remove ${rel}: ${toErrorMessage(e)}`);
      failures.push(rel);
    }
  }
  return { removed, failures };
}

// Previews (dry-run) or applies the derived-artifact mutations. Writes are
// validated against the allowed base dirs so a callback can never rewrite a
// file outside the owned directories.
function runDerivedRemoval<TItem, TConfig>(
  options: RunRemoveWorkflowOptions<TItem, TConfig>,
  config: TConfig,
  removedNames: string[],
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
    writeFileSync(write.targetPath, write.content);
  }
  return plan.retainedNames ?? [];
}

function announcedRemovedNames(removedNames: string[], retainedNames: string[]): string[] {
  const retained = new Set(retainedNames);
  return removedNames.filter((name) => !retained.has(name));
}

function joinAnnounced(names: string[]): string {
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

function finalizeRemoval<TItem, TConfig>(
  options: RunRemoveWorkflowOptions<TItem, TConfig>,
  config: TConfig,
  removed: number,
  dirs: Set<string>,
  removedNames: string[],
): void {
  cleanEmptyDirs([...dirs]);
  const retainedNames = runDerivedRemoval(options, config, removedNames);
  options.updateManifest({ cwd: options.cwd, removedNames });
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

function collectRemovalTargets<TItem, TConfig>(
  options: RunRemoveWorkflowOptions<TItem, TConfig>,
  config: TConfig,
  expandedNames: string[],
): { files: Set<string>; dirs: Set<string>; removedNames: string[] } {
  const { cwd } = options;
  const removedSet = new Set(expandedNames);
  const ctx = { cwd, config, resolveFilesForItem: options.resolveFilesForItem };
  const retainedItems = options
    .getAllItems()
    .filter(
      (i) =>
        !removedSet.has(options.getItemName(i)) && options.isInstalled({ cwd, config, item: i }),
    );
  const retainedFiles = collectRetainedFiles(ctx, retainedItems);
  return collectFilesToRemove(
    {
      ...ctx,
      getItemOrThrow: options.getItemOrThrow,
      canRemoveFile: options.canRemoveFile,
      force: options.force,
      requestedNames: expandedNames,
    },
    expandedNames,
    retainedFiles,
  );
}

async function executeRemoval<TItem, TConfig>(
  options: RunRemoveWorkflowOptions<TItem, TConfig>,
  config: TConfig,
  files: Set<string>,
  dirs: Set<string>,
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

  const allowedBaseDirs = options.resolveAllowedBaseDirs({ cwd, config });
  const { removed, failures } = deleteFiles(cwd, files, allowedBaseDirs);

  if (failures.length > 0) {
    error(
      `Aborting: ${failures.length} file(s) could not be removed. Manifest and CSS left unchanged.`,
    );
    return;
  }

  finalizeRemoval(options, config, removed, dirs, removedNames);
}

function reportBlocked(blocked: BlockedRemoval[]): void {
  for (const entry of blocked) {
    info(`Keeping ${entry.name}; still required by: ${entry.dependents.join(", ")}`);
  }
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

  const { files, dirs, removedNames } = collectRemovalTargets(options, config, expansion.toRemove);
  if (files.size === 0 && removedNames.length === 0) {
    if (expansion.blocked.length === 0) {
      info(`No installed files found for the specified ${options.itemPlural}.`);
    }
    return;
  }

  if (files.size === 0 && removedNames.length > 0) {
    // All owned files are already gone (stale entries). Clean up the manifest.
    if (!options.dryRun) {
      const retainedNames = runDerivedRemoval(options, config, removedNames);
      options.updateManifest({ cwd: options.cwd, removedNames });
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

  await executeRemoval(options, config, files, dirs, removedNames);
}
