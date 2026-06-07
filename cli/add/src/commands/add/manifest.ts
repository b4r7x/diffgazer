import { existsSync, readFileSync } from "node:fs";
import type { FileOp } from "@diffgazer/registry/cli";
import type {
  DiffgazerAddConfig,
  ManifestInstallMetadata,
  ManifestOwnedFile,
} from "../../context.js";
import { ctx, getRegistry, VERSION } from "../../context.js";
import { sha256 } from "../../utils/hashing.js";
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

// Adoption policy: a skipped file is only adopted into a new item's ownership
// when an existing manifest entry already owns the same path with the SAME
// registryIntegrity. A version mismatch refuses adoption rather than silently
// claiming files written by an older CLI/registry combination.
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
    hash: sha256(op.content),
    item: sourceName,
    registryIntegrity,
    cliVersion: VERSION,
    integrationMode: mode,
  };
}

function buildOwnedFilesByItem(
  cwd: string,
  writeResult: { results: Array<{ op: FileOp; result: "written" | "skipped" | "overwritten" }> },
  mode: ResolvedIntegrationSelection["mode"],
): Map<string, ManifestOwnedFile[]> {
  const registryIntegrity = getRegistry().integrity;
  const byItem = new Map<string, ManifestOwnedFile[]>();
  const writtenHashByTargetPath = new Map<string, string>();
  const existingManifest = (ctx.config.getManifestItems(cwd) ?? {}) as NonNullable<
    DiffgazerAddConfig["installedComponents"]
  >;

  function addOwnedFile(sourceName: string, op: FileOp): void {
    const path = toManifestPath(op);
    const existingFiles = byItem.get(sourceName) ?? [];
    if (existingFiles.some((file) => file.path === path)) return;

    existingFiles.push(buildOwnedFile(op, sourceName, registryIntegrity, mode));
    byItem.set(sourceName, existingFiles);
  }

  for (const { op, result } of writeResult.results) {
    const sourceNames = getSourceNames(op);
    if (result === "skipped" || sourceNames.length === 0) continue;
    for (const sourceName of sourceNames) {
      addOwnedFile(sourceName, op);
    }
    writtenHashByTargetPath.set(op.targetPath, sha256(op.content));
  }

  for (const { op, result } of writeResult.results) {
    const sourceNames = getSourceNames(op);
    if (result !== "skipped" || sourceNames.length === 0) continue;

    const expectedHash = sha256(op.content);
    if (writtenHashByTargetPath.get(op.targetPath) === expectedHash) {
      for (const sourceName of sourceNames) {
        addOwnedFile(sourceName, op);
      }
      continue;
    }

    if (!existsSync(op.targetPath)) continue;
    const onDiskHash = sha256(readFileSync(op.targetPath, "utf-8"));
    if (onDiskHash !== expectedHash) continue;

    if (!isManifestTrusted(toManifestPath(op), existingManifest, registryIntegrity)) continue;

    for (const sourceName of sourceNames) {
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
  const existingManifest = (ctx.config.getManifestItems(cwd) ?? {}) as NonNullable<
    DiffgazerAddConfig["installedComponents"]
  >;
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
