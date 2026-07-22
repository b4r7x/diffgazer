import { existsSync, readFileSync, rmSync } from "node:fs";
import { computeIntegrity } from "@diffgazer/registry";
import { atomicWriteFile, ensureWithinDir } from "@diffgazer/registry/cli";
import type { DiffgazerAddConfig, ManifestItem, ResolvedConfig } from "../../context.js";
import { ctx } from "../../context.js";
import {
  resolveKeysCopyHookFiles,
  resolveKeysHooksFromRegistry,
} from "../../utils/keys-copy-bundle.js";
import { resolveProjectPath, toPosixPath } from "../../utils/paths.js";
import type { ResolvedIntegrationSelection } from "./integration.js";

type IntegrationMode = ResolvedIntegrationSelection["mode"];

function isCopyMode(record: ManifestItem | undefined): boolean {
  return (
    record?.integrationMode === "copy" ||
    (record?.files ?? []).some((file) => file.integrationMode === "copy")
  );
}

function hasDifferentIntegrationMode(
  record: ManifestItem,
  requestedMode: IntegrationMode,
): boolean {
  return [record.integrationMode, ...(record.files ?? []).map((file) => file.integrationMode)].some(
    (mode) => mode !== undefined && mode !== requestedMode,
  );
}

function findIntegrationModeChanges(
  manifest: NonNullable<DiffgazerAddConfig["installedComponents"]> | undefined,
  resolvedNames: string[],
  requestedMode: IntegrationMode,
): string[] {
  return resolvedNames
    .map((name) => `ui/${name}`)
    .filter((name) => {
      const record = manifest?.[name];
      return record !== undefined && hasDifferentIntegrationMode(record, requestedMode);
    });
}

export function assertIntegrationModeChangesAllowed(
  changedNames: string[],
  requestedMode: IntegrationMode,
  overwrite: boolean,
): void {
  if (changedNames.length === 0 || overwrite) return;
  throw new Error(
    `Installed integration mode differs for ${changedNames.join(", ")}. ` +
      `Re-run with --overwrite to migrate these files to ${requestedMode}.`,
  );
}

interface PlannedRemovedFile {
  path: string;
  content: string;
  expectedHash: string;
}

export interface IntegrationModeMigrationPlan {
  changedNames: string[];
  removeManifestNames: string[];
  filesToRemove: PlannedRemovedFile[];
  hooksPath: string;
  manifestPath: string;
  manifestSnapshot: string;
}

export interface AppliedIntegrationModeMigration {
  removedFiles: Array<{ path: string; content: string }>;
}

function addHooksForItem(hookNames: Set<string>, itemName: string): void {
  const item = ctx.registry.getItem(itemName.replace(/^ui\//, ""));
  if (!item) return;
  for (const hook of resolveKeysHooksFromRegistry([item])) hookNames.add(hook);
}

function hasKeyboardIntegration(itemName: string): boolean {
  const item = ctx.registry.getItem(itemName.replace(/^ui\//, ""));
  if (!item) return false;
  return (
    resolveKeysHooksFromRegistry([item]).length > 0 ||
    item.files.some((file) => file.content.includes("@diffgazer/keys"))
  );
}

function resolveHookManifestPath(cwd: string, hooksPath: string, manifestPath: string): string {
  const path = resolveProjectPath(cwd, manifestPath);
  ensureWithinDir(path, hooksPath);
  return path;
}

function planRemovableHookFiles(
  cwd: string,
  hooksPath: string,
  record: ManifestItem,
  retainedFilePaths: ReadonlySet<string>,
): PlannedRemovedFile[] {
  const files = record.files ?? [];
  const planned: PlannedRemovedFile[] = [];
  for (const file of files) {
    const path = resolveHookManifestPath(cwd, hooksPath, file.path);
    if (retainedFilePaths.has(path)) continue;
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf-8");
    if (computeIntegrity(content) !== file.hash) {
      throw new Error(
        `Cannot migrate integration mode because copied hook has local changes: "${file.path}".`,
      );
    }
    planned.push({ path, content, expectedHash: file.hash });
  }
  return planned;
}

export function planIntegrationModeMigration(
  cwd: string,
  config: ResolvedConfig,
  resolvedNames: string[],
  requestedMode: IntegrationMode,
  explicitNames: Set<string>,
): IntegrationModeMigrationPlan {
  const manifest = ctx.config.getManifestItems(cwd) ?? {};
  const changedNames = findIntegrationModeChanges(
    manifest,
    resolvedNames.filter(hasKeyboardIntegration),
    requestedMode,
  );
  const changedSet = new Set(changedNames);
  const retainedCopyHooks = new Set<string>();

  for (const [name, record] of Object.entries(manifest)) {
    if (!name.startsWith("ui/") || !isCopyMode(record)) continue;
    if (!changedSet.has(name) || requestedMode === "copy") addHooksForItem(retainedCopyHooks, name);
  }
  if (requestedMode === "copy") {
    for (const name of resolvedNames) addHooksForItem(retainedCopyHooks, `ui/${name}`);
  }

  const explicitHooks = new Set<string>(
    [...explicitNames]
      .filter((name) => name.startsWith("keys/"))
      .map((name) => name.slice("keys/".length)),
  );
  for (const [name, record] of Object.entries(manifest)) {
    if (name.startsWith("keys/") && record.installedAs !== "transitive") {
      explicitHooks.add(name.slice("keys/".length));
    }
  }

  const candidateHooks = new Set<string>();
  if (requestedMode !== "copy") {
    for (const name of changedNames) {
      if (isCopyMode(manifest[name])) addHooksForItem(candidateHooks, name);
    }
  }

  const retainedHooks = new Set([...retainedCopyHooks, ...explicitHooks]);
  const hooksPath = resolveProjectPath(cwd, config.hooksFsPath);
  const retainedFilePaths = new Set<string>();
  for (const hook of retainedHooks) {
    for (const file of manifest[`keys/${hook}`]?.files ?? []) {
      retainedFilePaths.add(resolveHookManifestPath(cwd, hooksPath, file.path));
    }
  }
  for (const file of resolveKeysCopyHookFiles([...retainedHooks]).files) {
    retainedFilePaths.add(
      resolveHookManifestPath(
        cwd,
        hooksPath,
        toPosixPath(`${config.hooksFsPath}/${file.relativePath}`),
      ),
    );
  }

  const removeManifestNames: string[] = [];
  const filesToRemove: PlannedRemovedFile[] = [];
  for (const hook of candidateHooks) {
    if (retainedCopyHooks.has(hook) || explicitHooks.has(hook)) continue;
    const manifestName = `keys/${hook}`;
    const record = manifest[manifestName];
    if (!record) continue;
    const files = planRemovableHookFiles(cwd, hooksPath, record, retainedFilePaths);
    removeManifestNames.push(manifestName);
    filesToRemove.push(...files);
  }

  const manifestPath = resolveProjectPath(cwd, "diffgazer.json");
  return {
    changedNames,
    removeManifestNames,
    filesToRemove,
    hooksPath,
    manifestPath,
    manifestSnapshot: readFileSync(manifestPath, "utf-8"),
  };
}

export function applyIntegrationModeMigration(
  plan: IntegrationModeMigrationPlan,
): AppliedIntegrationModeMigration {
  const removedFiles: Array<{ path: string; content: string }> = [];
  try {
    for (const file of plan.filesToRemove) {
      ensureWithinDir(file.path, plan.hooksPath);
      if (!existsSync(file.path)) continue;
      const content = readFileSync(file.path, "utf-8");
      if (computeIntegrity(content) !== file.expectedHash) {
        throw new Error(`Copied hook changed during integration migration: "${file.path}".`);
      }
      rmSync(file.path);
      removedFiles.push({ path: file.path, content });
    }
  } catch (error) {
    try {
      restoreRemovedFiles(removedFiles, plan.hooksPath);
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Integration migration failed and rollback was incomplete.",
      );
    }
    throw error;
  }
  return { removedFiles };
}

function restoreRemovedFiles(
  files: Array<{ path: string; content: string }>,
  hooksPath: string,
): void {
  const failures: unknown[] = [];
  for (const file of [...files].reverse()) {
    try {
      ensureWithinDir(file.path, hooksPath);
      atomicWriteFile(file.path, file.content);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, "Failed to restore copied hooks.");
  }
}

export function rollbackIntegrationModeMigration(
  plan: IntegrationModeMigrationPlan,
  applied: AppliedIntegrationModeMigration | undefined,
): void {
  const failures: unknown[] = [];
  try {
    restoreRemovedFiles(applied?.removedFiles ?? [], plan.hooksPath);
  } catch (error) {
    failures.push(error);
  }
  try {
    atomicWriteFile(plan.manifestPath, plan.manifestSnapshot);
  } catch (error) {
    failures.push(error);
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, "Failed to roll back integration migration.");
  }
}
