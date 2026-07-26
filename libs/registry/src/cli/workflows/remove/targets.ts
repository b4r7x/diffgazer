import { existsSync } from "node:fs";
import { dirname, relative } from "node:path";
import { info } from "../../terminal.js";
import type { FileRemovalVerdict, RemoveWorkflowFile, RunRemoveWorkflowOptions } from "./types.js";

function skipMessage(
  name: string,
  relativePath: string,
  verdict: Exclude<FileRemovalVerdict, "removable">,
): string {
  if (verdict === "unowned") {
    return `Skipping ${name}: ${relativePath} is not tracked in the ownership manifest (the manifest is missing or was reset)`;
  }
  return `Skipping ${name}: ${relativePath} has been modified (use --force to override)`;
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
    checkFileRemoval?: RunRemoveWorkflowOptions<TItem, TConfig>["checkFileRemoval"];
    force: boolean;
    requestedNames: string[];
  },
  names: string[],
  retainedFiles: Set<string>,
): { files: Set<string>; dirs: Set<string>; ownedFiles: Set<string>; removedNames: string[] } {
  const files = new Set<string>();
  const dirs = new Set<string>();
  const ownedFiles = new Set<string>();
  const removedNames: string[] = [];
  for (const name of names) {
    const item = ctx.getItemOrThrow(name);
    const removableFiles: RemoveWorkflowFile[] = [];
    let blocked = false;
    let hadMissingFiles = false;
    for (const file of ctx.resolveFilesForItem({ cwd: ctx.cwd, config: ctx.config, item })) {
      ownedFiles.add(file.absolutePath);
      if (!existsSync(file.absolutePath)) {
        hadMissingFiles = true;
        info(`Skipping ${relative(ctx.cwd, file.absolutePath)}: file not found on disk`);
        continue;
      }
      if (retainedFiles.has(file.absolutePath)) continue;
      const verdict =
        ctx.checkFileRemoval?.({
          cwd: ctx.cwd,
          config: ctx.config,
          item,
          file,
          force: ctx.force,
          requestedNames: ctx.requestedNames,
        }) ?? "removable";
      if (verdict !== "removable") {
        info(skipMessage(name, relative(ctx.cwd, file.absolutePath), verdict));
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
  return { files, dirs, ownedFiles, removedNames };
}

export function collectRemovalTargets<TItem, TConfig>(
  options: RunRemoveWorkflowOptions<TItem, TConfig>,
  config: TConfig,
  expandedNames: string[],
): { files: Set<string>; dirs: Set<string>; ownedFiles: Set<string>; removedNames: string[] } {
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
      checkFileRemoval: options.checkFileRemoval,
      force: options.force,
      requestedNames: expandedNames,
    },
    expandedNames,
    retainedFiles,
  );
}
