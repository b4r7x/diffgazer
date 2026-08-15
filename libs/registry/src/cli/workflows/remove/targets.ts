import { existsSync } from "node:fs";
import { dirname, relative } from "node:path";
import { info } from "../../terminal.js";
import type {
  FileRemovalVerdict,
  RemoveDependencyGraph,
  RemoveInvocation,
  RemoveWorkflowFile,
  RunRemoveWorkflowOptions,
} from "./types.js";

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
  invocation: RemoveInvocation<TConfig>;
  resolveFilesForItem: (ctx: { cwd: string; config: TConfig; item: TItem }) => RemoveWorkflowFile[];
}

function collectRetainedFiles<TItem, TConfig>(
  ctx: ResolveCtx<TItem, TConfig>,
  items: TItem[],
): Set<string> {
  const retained = new Set<string>();
  for (const item of items) {
    for (const file of ctx.resolveFilesForItem({ ...ctx.invocation, item })) {
      retained.add(file.absolutePath);
    }
  }
  return retained;
}

interface CollectCtx<TItem, TConfig, TMetadata> extends ResolveCtx<TItem, TConfig> {
  getItemOrThrow: RunRemoveWorkflowOptions<TItem, TConfig, TMetadata>["getItemOrThrow"];
  checkFileRemoval?: RunRemoveWorkflowOptions<TItem, TConfig, TMetadata>["checkFileRemoval"];
  force: boolean;
  requestedNames: string[];
}

function collectDefinitelyRetainedFiles<TItem, TConfig, TMetadata>(
  options: RunRemoveWorkflowOptions<TItem, TConfig, TMetadata>,
  ctx: ResolveCtx<TItem, TConfig>,
  expandedNames: string[],
): Set<string> {
  const expandedSet = new Set(expandedNames);
  const retainedItems = options
    .getAllItems(ctx.invocation)
    .filter(
      (item) =>
        !expandedSet.has(options.getItemName(item)) &&
        options.isInstalled({ ...ctx.invocation, item }),
    );
  return collectRetainedFiles(ctx, retainedItems);
}

function assessItemRemovability<TItem, TConfig, TMetadata>(
  ctx: CollectCtx<TItem, TConfig, TMetadata>,
  name: string,
  definitelyRetainedFiles: Set<string>,
): {
  blocked: boolean;
  hadMissingFiles: boolean;
  hasRemovableFiles: boolean;
  ownedFiles: string[];
} {
  const item = ctx.getItemOrThrow(name, ctx.invocation);
  let blocked = false;
  let hadMissingFiles = false;
  let hasRemovableFiles = false;
  const ownedFiles: string[] = [];
  for (const file of ctx.resolveFilesForItem({ ...ctx.invocation, item })) {
    ownedFiles.push(file.absolutePath);
    if (!existsSync(file.absolutePath)) {
      hadMissingFiles = true;
      info(`Skipping ${relative(ctx.invocation.cwd, file.absolutePath)}: file not found on disk`);
      continue;
    }
    if (definitelyRetainedFiles.has(file.absolutePath)) {
      continue;
    }
    const verdict =
      ctx.checkFileRemoval?.({
        ...ctx.invocation,
        item,
        file,
        force: ctx.force,
        requestedNames: ctx.requestedNames,
      }) ?? "removable";
    if (verdict !== "removable") {
      info(skipMessage(name, relative(ctx.invocation.cwd, file.absolutePath), verdict));
      blocked = true;
      break;
    }
    hasRemovableFiles = true;
  }
  return { blocked, hadMissingFiles, hasRemovableFiles, ownedFiles };
}

function collectFilesToRemove<TItem, TConfig, TMetadata>(
  ctx: CollectCtx<TItem, TConfig, TMetadata>,
  names: string[],
  retainedFiles: Set<string>,
): { files: Set<string>; dirs: Set<string> } {
  const files = new Set<string>();
  const dirs = new Set<string>();
  for (const name of names) {
    const item = ctx.getItemOrThrow(name, ctx.invocation);
    for (const file of ctx.resolveFilesForItem({ ...ctx.invocation, item })) {
      if (retainedFiles.has(file.absolutePath)) continue;
      if (!existsSync(file.absolutePath)) continue;
      files.add(file.absolutePath);
      dirs.add(dirname(file.absolutePath));
    }
  }
  return { files, dirs };
}

function retractDependenciesOfPreserved(
  expandedNames: string[],
  confirmedRemoved: Set<string>,
  getDependencies: (name: string) => readonly string[],
): void {
  const expandedSet = new Set(expandedNames);
  const preserved = new Set(expandedNames.filter((name) => !confirmedRemoved.has(name)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const name of preserved) {
      for (const dep of getDependencies(name)) {
        if (expandedSet.has(dep) && confirmedRemoved.has(dep)) {
          confirmedRemoved.delete(dep);
          preserved.add(dep);
          changed = true;
        }
      }
    }
  }
}

export function collectRemovalTargets<TItem, TConfig, TMetadata>(
  options: RunRemoveWorkflowOptions<TItem, TConfig, TMetadata>,
  config: TConfig,
  expandedNames: string[],
  dependencyGraph?: RemoveDependencyGraph,
): { files: Set<string>; dirs: Set<string>; ownedFiles: Set<string>; removedNames: string[] } {
  if (options.expandRequestedNames && dependencyGraph === undefined) {
    throw new Error("Removal expansion must provide a dependency graph.");
  }

  const invocation: RemoveInvocation<TConfig> = { cwd: options.cwd, config };
  const ctx: CollectCtx<TItem, TConfig, TMetadata> = {
    invocation,
    resolveFilesForItem: options.resolveFilesForItem,
    getItemOrThrow: options.getItemOrThrow,
    checkFileRemoval: options.checkFileRemoval,
    force: options.force,
    requestedNames: expandedNames,
  };

  const definitelyRetainedFiles = collectDefinitelyRetainedFiles(options, ctx, expandedNames);

  const confirmedRemoved = new Set<string>();
  const ownedFiles = new Set<string>();
  for (const name of expandedNames) {
    const assessment = assessItemRemovability(ctx, name, definitelyRetainedFiles);
    for (const path of assessment.ownedFiles) {
      ownedFiles.add(path);
    }
    if (assessment.blocked) continue;
    if (assessment.hasRemovableFiles || assessment.hadMissingFiles) {
      confirmedRemoved.add(name);
    }
  }

  if (dependencyGraph !== undefined) {
    retractDependenciesOfPreserved(
      expandedNames,
      confirmedRemoved,
      (name) => dependencyGraph.get(name) ?? [],
    );
  }

  const confirmedRemovedNames = expandedNames.filter((name) => confirmedRemoved.has(name));
  const removedSet = new Set(confirmedRemovedNames);
  const retainedItems = options
    .getAllItems(invocation)
    .filter(
      (i) =>
        !removedSet.has(options.getItemName(i)) && options.isInstalled({ ...invocation, item: i }),
    );
  const retainedFiles = collectRetainedFiles(ctx, retainedItems);
  const { files, dirs } = collectFilesToRemove(ctx, confirmedRemovedNames, retainedFiles);

  return { files, dirs, ownedFiles, removedNames: confirmedRemovedNames };
}
