import { existsSync, readFileSync, rmSync } from "node:fs";
import { computeIntegrity } from "@diffgazer/registry";
import type { FileOp } from "@diffgazer/registry/cli";
import { atomicWriteFile } from "@diffgazer/registry/cli";
import type {
  DiffgazerAddConfig,
  ManifestInstallMetadata,
  ManifestOwnedFile,
} from "../../context.js";
import { ctx, getRegistry, VERSION } from "../../context.js";
import { resolveProjectPath, toPosixPath } from "../../utils/paths.js";
import { isOwnedFileOp } from "./file-ops.js";
import type { ResolvedIntegrationSelection } from "./integration.js";

export function buildManifestMetadata(
  mode: ResolvedIntegrationSelection["mode"],
  keysVersionSpec: string,
): ManifestInstallMetadata {
  const metadata: ManifestInstallMetadata = { integrationMode: mode };
  if (mode === "@diffgazer/keys" && keysVersionSpec !== "latest") {
    metadata.keysVersion = keysVersionSpec;
  }
  return metadata;
}

function preservedInstallAs(
  existing: NonNullable<DiffgazerAddConfig["installedComponents"]>[string] | undefined,
  isExplicit: boolean,
): "explicit" | "transitive" {
  if (isExplicit) return "explicit";
  return existing?.installedAs === "explicit" ? "explicit" : "transitive";
}

function preservedCssChunks(
  existing: NonNullable<DiffgazerAddConfig["installedComponents"]>[string] | undefined,
  newChunks: string[] | undefined,
): string[] | undefined {
  const chunks = newChunks === undefined ? existing?.cssChunks : [...new Set(newChunks)];
  return chunks && chunks.length > 0 ? chunks : undefined;
}

// A skipped file is adopted only when an existing manifest entry owns the same
// path with the SAME registryIntegrity; a mismatch MUST refuse adoption rather
// than claim files written by an older CLI/registry combination.
function isManifestTrusted(
  manifestPath: string,
  manifest: NonNullable<DiffgazerAddConfig["installedComponents"]>,
  registryIntegrity: string | undefined,
): boolean {
  if (!registryIntegrity) return false;
  for (const record of Object.values(manifest)) {
    for (const file of record.files ?? []) {
      if (file.path !== manifestPath) continue;
      if (file.registryIntegrity === registryIntegrity) return true;
    }
  }
  return false;
}

function toManifestPath(op: FileOp): string {
  return toPosixPath(`${op.installDir}/${op.relativePath}`);
}

function getSourceNames(op: FileOp): string[] {
  const sourceNames = isOwnedFileOp(op) ? (op.sourceNames ?? []) : [];
  return [
    ...new Set(
      [op.sourceName, ...sourceNames].filter((name): name is string => name !== undefined),
    ),
  ];
}

function buildOwnedFile(
  op: FileOp,
  sourceName: string,
  registryIntegrity: string | undefined,
  mode: ResolvedIntegrationSelection["mode"],
): ManifestOwnedFile {
  return {
    path: toManifestPath(op),
    hash: computeIntegrity(op.content),
    item: sourceName,
    registryIntegrity,
    cliVersion: VERSION,
    integrationMode: mode,
  };
}

function ownedFileFor(
  manifest: NonNullable<DiffgazerAddConfig["installedComponents"]>,
  sourceName: string,
  manifestPath: string,
): ManifestOwnedFile | undefined {
  return manifest[sourceName]?.files?.find((file) => file.path === manifestPath);
}

function buildOwnedFilesByItem(
  writeResult: { results: Array<{ op: FileOp; result: "written" | "skipped" | "overwritten" }> },
  mode: ResolvedIntegrationSelection["mode"],
  existingManifest: NonNullable<DiffgazerAddConfig["installedComponents"]>,
): Map<string, ManifestOwnedFile[]> {
  const registryIntegrity = getRegistry().integrity;
  const byItem = new Map<string, ManifestOwnedFile[]>();
  const writtenHashByTargetPath = new Map<string, string>();

  function pushOwnedFile(sourceName: string, path: string, file: ManifestOwnedFile): void {
    const existingFiles = byItem.get(sourceName) ?? [];
    if (existingFiles.some((entry) => entry.path === path)) return;
    existingFiles.push(file);
    byItem.set(sourceName, existingFiles);
  }

  function addOwnedFile(sourceName: string, op: FileOp): void {
    const path = toManifestPath(op);
    pushOwnedFile(sourceName, path, buildOwnedFile(op, sourceName, registryIntegrity, mode));
  }

  for (const { op, result } of writeResult.results) {
    const sourceNames = getSourceNames(op);
    if (result === "skipped" || sourceNames.length === 0) continue;
    for (const sourceName of sourceNames) {
      addOwnedFile(sourceName, op);
    }
    writtenHashByTargetPath.set(op.targetPath, computeIntegrity(op.content));
  }

  for (const { op, result } of writeResult.results) {
    const sourceNames = getSourceNames(op);
    if (result !== "skipped" || sourceNames.length === 0) continue;

    const manifestPath = toManifestPath(op);
    const expectedHash = computeIntegrity(op.content);
    if (writtenHashByTargetPath.get(op.targetPath) === expectedHash) {
      for (const sourceName of sourceNames) {
        addOwnedFile(sourceName, op);
      }
      continue;
    }

    // For paths this item already owns, preserve the recorded ownership entry
    // verbatim even if the on-disk body drifted, so a locally modified owned file
    // is not stripped from the manifest. Unowned pre-existing files still go
    // through the stricter hash-matched adoption below.
    const ownedEntries = sourceNames
      .map(
        (sourceName) =>
          [sourceName, ownedFileFor(existingManifest, sourceName, manifestPath)] as const,
      )
      .filter((entry): entry is [string, ManifestOwnedFile] => entry[1] !== undefined);
    for (const [sourceName, existingFile] of ownedEntries) {
      pushOwnedFile(sourceName, manifestPath, existingFile);
    }
    const ownedNames = new Set(ownedEntries.map(([sourceName]) => sourceName));
    const unowned = sourceNames.filter((sourceName) => !ownedNames.has(sourceName));
    if (unowned.length === 0) continue;

    if (!existsSync(op.targetPath)) continue;
    const onDiskHash = computeIntegrity(readFileSync(op.targetPath, "utf-8"));
    if (onDiskHash !== expectedHash) continue;

    if (!isManifestTrusted(manifestPath, existingManifest, registryIntegrity)) continue;

    for (const sourceName of unowned) {
      addOwnedFile(sourceName, op);
    }
  }
  return byItem;
}

export interface RetiredOwnershipReconciliation {
  removedFiles: Array<{ path: string; content: string }>;
  retainedFilesByItem: Map<string, ManifestOwnedFile[]>;
  notices: string[];
}

export function reconcileRetiredOwnership(
  cwd: string,
  writeResult: OwnedManifestUpdate["writeResult"],
  mode: ResolvedIntegrationSelection["mode"],
  updatedNames: ReadonlySet<string>,
): RetiredOwnershipReconciliation {
  const existingManifest = ctx.config.getManifestItems(cwd) ?? {};
  const nextFilesByItem = buildOwnedFilesByItem(writeResult, mode, existingManifest);
  const nextOwnersByPath = new Map<string, Set<string>>();

  function addNextOwner(path: string, owner: string): void {
    const owners = nextOwnersByPath.get(path) ?? new Set<string>();
    owners.add(owner);
    nextOwnersByPath.set(path, owners);
  }

  for (const [name, record] of Object.entries(existingManifest)) {
    if (updatedNames.has(name)) continue;
    for (const file of record.files ?? []) addNextOwner(file.path, name);
  }
  for (const [name, files] of nextFilesByItem) {
    for (const file of files) addNextOwner(file.path, name);
  }

  const retiredByPath = new Map<string, Array<{ owner: string; file: ManifestOwnedFile }>>();
  for (const name of updatedNames) {
    const nextPaths = new Set((nextFilesByItem.get(name) ?? []).map((file) => file.path));
    for (const file of existingManifest[name]?.files ?? []) {
      if (nextPaths.has(file.path)) continue;
      const retired = retiredByPath.get(file.path) ?? [];
      retired.push({ owner: name, file });
      retiredByPath.set(file.path, retired);
    }
  }

  const result: RetiredOwnershipReconciliation = {
    removedFiles: [],
    retainedFilesByItem: new Map(),
    notices: [],
  };

  try {
    for (const [manifestPath, retiredEntries] of retiredByPath) {
      if ((nextOwnersByPath.get(manifestPath)?.size ?? 0) > 0) continue;
      const absolutePath = resolveProjectPath(cwd, manifestPath);
      if (!existsSync(absolutePath)) continue;

      const content = readFileSync(absolutePath, "utf-8");
      const currentHash = computeIntegrity(content);
      if (retiredEntries.every(({ file }) => file.hash === currentHash)) {
        rmSync(absolutePath);
        result.removedFiles.push({ path: absolutePath, content });
        continue;
      }

      for (const { owner, file } of retiredEntries) {
        const retained = result.retainedFilesByItem.get(owner) ?? [];
        retained.push({ ...file, retired: true });
        result.retainedFilesByItem.set(owner, retained);
      }
      result.notices.push(
        `Preserving retired file ${manifestPath}: local content differs from the installed version. ` +
          "It remains tracked as retired drift for dgadd diff and dgadd remove --force.",
      );
    }
  } catch (error) {
    try {
      rollbackRetiredOwnership(result);
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Retired ownership reconciliation failed and rollback was incomplete.",
      );
    }
    throw error;
  }

  return result;
}

export function rollbackRetiredOwnership(result: RetiredOwnershipReconciliation): void {
  const failures: unknown[] = [];
  for (const file of [...result.removedFiles].reverse()) {
    try {
      atomicWriteFile(file.path, file.content);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, "Failed to restore retired owned files.");
  }
}

export interface OwnedManifestUpdate {
  writeResult: { results: Array<{ op: FileOp; result: "written" | "skipped" | "overwritten" }> };
  metadata: ManifestInstallMetadata;
  explicitNames: Set<string>;
  cssChunksByItem: Map<string, string[]>;
  removeNames?: string[];
  updatedNames?: ReadonlySet<string>;
  retainedFilesByItem?: ReadonlyMap<string, ManifestOwnedFile[]>;
}

export function updateOwnedManifestEntries(cwd: string, update: OwnedManifestUpdate): void {
  const {
    writeResult,
    metadata,
    explicitNames,
    cssChunksByItem,
    removeNames = [],
    updatedNames = new Set<string>(),
    retainedFilesByItem = new Map<string, ManifestOwnedFile[]>(),
  } = update;
  const loaded = ctx.config.loadConfig(cwd);
  if (!loaded.ok) {
    throw new Error(`Cannot update diffgazer.json: ${loaded.message ?? loaded.error}`);
  }
  const manifestPath = resolveProjectPath(cwd, "diffgazer.json");
  const manifestSnapshot = readFileSync(manifestPath, "utf-8");
  const existingManifest = loaded.config.installedComponents ?? {};
  const filesByItem = buildOwnedFilesByItem(
    writeResult,
    metadata.integrationMode ?? "none",
    existingManifest,
  );
  const nextManifest = { ...existingManifest };
  const allItemNames = new Set<string>([
    ...filesByItem.keys(),
    ...cssChunksByItem.keys(),
    ...updatedNames,
    ...retainedFilesByItem.keys(),
  ]);
  const installedAt = new Date().toISOString();

  for (const name of allItemNames) {
    const installedAs = preservedInstallAs(existingManifest[name], explicitNames.has(name));
    const cssChunks = preservedCssChunks(existingManifest[name], cssChunksByItem.get(name));
    const currentFiles = filesByItem.get(name) ?? [];
    const retainedFiles = retainedFilesByItem.get(name) ?? [];
    const files =
      updatedNames.has(name) || retainedFiles.length > 0
        ? [...currentFiles, ...retainedFiles]
        : (existingManifest[name]?.files ?? []);
    if (files.length === 0 && !cssChunks) {
      delete nextManifest[name];
      continue;
    }
    const itemMetadata: ManifestInstallMetadata = {
      ...metadata,
      installedAs,
    };
    if (files.length > 0) itemMetadata.files = files;
    if (cssChunks) itemMetadata.cssChunks = cssChunks;
    nextManifest[name] = { installedAt, ...itemMetadata };
  }

  for (const name of removeNames) delete nextManifest[name];

  const nextConfig: DiffgazerAddConfig = { ...loaded.config };
  if (Object.keys(nextManifest).length > 0) {
    nextConfig.installedComponents = nextManifest;
  } else {
    delete nextConfig.installedComponents;
  }

  try {
    ctx.config.writeConfig(cwd, nextConfig);
  } catch (error) {
    try {
      atomicWriteFile(manifestPath, manifestSnapshot);
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Manifest update failed and rollback was incomplete.",
      );
    }
    throw error;
  }
}
