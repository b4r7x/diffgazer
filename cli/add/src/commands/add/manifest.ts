import { existsSync, readFileSync } from "node:fs";
import { computeIntegrity } from "@diffgazer/registry";
import type { FileOp } from "@diffgazer/registry/cli";
import type {
  DiffgazerAddConfig,
  ManifestInstallMetadata,
  ManifestOwnedFile,
} from "../../context.js";
import { ctx, getRegistry, VERSION } from "../../context.js";
import { toPosixPath } from "../../utils/paths.js";
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
  const merged = new Set<string>([...(existing?.cssChunks ?? []), ...(newChunks ?? [])]);
  return merged.size > 0 ? [...merged] : undefined;
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
  cwd: string,
  writeResult: { results: Array<{ op: FileOp; result: "written" | "skipped" | "overwritten" }> },
  mode: ResolvedIntegrationSelection["mode"],
): Map<string, ManifestOwnedFile[]> {
  const registryIntegrity = getRegistry().integrity;
  const byItem = new Map<string, ManifestOwnedFile[]>();
  const writtenHashByTargetPath = new Map<string, string>();
  const existingManifest = ctx.config.getManifestItems(cwd) ?? {};

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

export interface OwnedManifestUpdate {
  writeResult: { results: Array<{ op: FileOp; result: "written" | "skipped" | "overwritten" }> };
  metadata: ManifestInstallMetadata;
  explicitNames: Set<string>;
  cssChunksByItem: Map<string, string[]>;
}

export function updateOwnedManifestEntries(cwd: string, update: OwnedManifestUpdate): void {
  const { writeResult, metadata, explicitNames, cssChunksByItem } = update;
  const filesByItem = buildOwnedFilesByItem(cwd, writeResult, metadata.integrationMode ?? "none");
  const existingManifest = ctx.config.getManifestItems(cwd) ?? {};
  const allItemNames = new Set<string>([...filesByItem.keys(), ...cssChunksByItem.keys()]);

  for (const name of allItemNames) {
    const installedAs = preservedInstallAs(existingManifest[name], explicitNames.has(name));
    const cssChunks = preservedCssChunks(existingManifest[name], cssChunksByItem.get(name));
    const itemMetadata: ManifestInstallMetadata = {
      ...metadata,
      installedAs,
      files: filesByItem.get(name) ?? existingManifest[name]?.files ?? [],
    };
    if (cssChunks) itemMetadata.cssChunks = cssChunks;
    ctx.config.updateManifest(cwd, [name], undefined, itemMetadata);
  }
}
