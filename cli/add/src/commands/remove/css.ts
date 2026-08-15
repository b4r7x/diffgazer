import {
  ctx,
  type DiffgazerAddConfig,
  type ManifestItem,
  type ResolvedConfig,
} from "../../context.js";
import {
  findCorruptedCssChunkHashes,
  readCssChunkHashBoundaries,
  readInstalledCssChunkHashes,
  removeCssChunks,
} from "../../utils/css-chunks.js";

interface OwnedCssRemovalPlan {
  writes: Array<{ targetPath: string; content: string }>;
  preservedNotices: string[];
  // Per removed item whose drifted chunk was preserved, the chunk hashes actually
  // kept on disk. Keys are the retained items: they stay in the manifest so the
  // leftover block is still targetable by a later `remove <item> --force`, and the
  // hashes trim `cssChunks` so a deleted pristine sibling chunk is dropped rather
  // than reported as drift.
  retainedChunkHashesByName: Map<string, string[]>;
}

function cssCorruptionNotice(hash: string, stylesPath: string, force: boolean): string {
  const repair = `Restore exactly one /* dgadd:css ${hash} */ and one /* dgadd:css-end ${hash} */ marker in the correct order in ${stylesPath}.`;
  if (force) {
    return `Cannot force-remove CSS chunk ${hash}: managed block markers are malformed. ${repair}`;
  }
  return (
    `Skipping CSS chunk ${hash}: managed block markers are malformed in ${stylesPath}. ` +
    `Ownership is preserved so the block stays targetable after repair. ${repair}`
  );
}

function planCorruptedCssChunkRetention(
  removedNames: string[],
  preRemovalChunksByItem: Map<string, string[]>,
  corruptedHashes: Set<string>,
  stylesPath: string,
  force: boolean,
): OwnedCssRemovalPlan | null {
  const retainedChunkHashesByName = new Map<string, string[]>();
  const preservedNotices: string[] = [];

  for (const name of removedNames) {
    const preserved = (preRemovalChunksByItem.get(name) ?? []).filter((hash) =>
      corruptedHashes.has(hash),
    );
    if (preserved.length === 0) continue;
    retainedChunkHashesByName.set(name, preserved);
    for (const hash of preserved) {
      preservedNotices.push(cssCorruptionNotice(hash, stylesPath, force));
    }
  }

  if (retainedChunkHashesByName.size === 0) return null;
  if (force) {
    throw new Error(preservedNotices.join("\n"));
  }

  return {
    writes: [],
    preservedNotices,
    retainedChunkHashesByName,
  };
}

// Surfaces a preserved (drifted) CSS chunk with the same "use --force to
// override" guidance the remove workflow emits for edited owned source files.
function cssDriftNotice(
  hash: string,
  preRemovalChunksByItem: Map<string, string[]>,
  stylesPath: string,
): string {
  const owners = [...preRemovalChunksByItem]
    .filter(([, hashes]) => hashes.includes(hash))
    .map(([name]) => name);
  const label = owners.join(", ");
  return `Skipping ${label}: ${stylesPath} chunk has been modified (use --force to override). Keeping ${label} tracked so the edited chunk is not orphaned; re-run remove with --force to delete it.`;
}

// Plans the styles.css mutation without touching disk so the workflow can
// preview it under --dry-run. Without `force`, a drifted chunk is preserved and
// reported via a skip notice.
export function planOwnedCssChunkRemoval(
  cwd: string,
  config: ResolvedConfig,
  removedNames: string[],
  preRemovalChunksByItem: Map<string, string[]>,
  force: boolean,
): OwnedCssRemovalPlan {
  const empty: OwnedCssRemovalPlan = {
    writes: [],
    preservedNotices: [],
    retainedChunkHashesByName: new Map(),
  };
  if (removedNames.length === 0) return empty;
  const stylesPath = config.tailwind?.css;
  if (!stylesPath) return empty;

  const removedSet = new Set(removedNames);
  const keptChunkHashes = new Set<string>();
  const chunksOfRemovedItems = new Set<string>();
  for (const [name, hashes] of preRemovalChunksByItem) {
    const target = removedSet.has(name) ? chunksOfRemovedItems : keptChunkHashes;
    for (const hash of hashes) target.add(hash);
  }

  const corruptedHashes = findCorruptedCssChunkHashes(readCssChunkHashBoundaries(cwd, config));
  const corruptedRetention = planCorruptedCssChunkRetention(
    removedNames,
    preRemovalChunksByItem,
    corruptedHashes,
    stylesPath,
    force,
  );

  const installedHashes = readInstalledCssChunkHashes(cwd, config);
  if (installedHashes.size === 0) return corruptedRetention ?? empty;

  // onAfterRemove fires before updateManifest, so the live manifest still lists
  // the removed items; derive kept vs removed chunks from the pre-removal snapshot.

  const candidates = new Set<string>();
  for (const hash of installedHashes) {
    if (chunksOfRemovedItems.has(hash) && !keptChunkHashes.has(hash)) {
      candidates.add(hash);
    }
  }
  if (candidates.size === 0) return corruptedRetention ?? empty;

  const result = removeCssChunks(candidates, cwd, config, force);
  const preservedNotices = [
    ...(corruptedRetention?.preservedNotices ?? []),
    ...result.modifiedHashes.map((hash) =>
      cssDriftNotice(hash, preRemovalChunksByItem, stylesPath),
    ),
  ];
  const modifiedHashes = new Set(result.modifiedHashes);
  const retainedChunkHashesByName = new Map(corruptedRetention?.retainedChunkHashesByName ?? []);
  for (const name of removedNames) {
    const preserved = (preRemovalChunksByItem.get(name) ?? []).filter((hash) =>
      modifiedHashes.has(hash),
    );
    const corrupted = retainedChunkHashesByName.get(name) ?? [];
    const retained = [...new Set([...corrupted, ...preserved])];
    if (retained.length > 0) retainedChunkHashesByName.set(name, retained);
  }
  const writes = result.fileOp
    ? [{ targetPath: result.fileOp.targetPath, content: result.fileOp.content }]
    : [];
  return { writes, preservedNotices, retainedChunkHashesByName };
}

export function readPreRemovalChunks(
  manifest: Readonly<Record<string, ManifestItem>>,
): Map<string, string[]> {
  const snapshot = new Map<string, string[]>();
  for (const [name, record] of Object.entries(manifest)) {
    const hashes = record.cssChunks ?? [];
    if (hashes.length > 0) snapshot.set(name, [...hashes]);
  }
  return snapshot;
}

function trimRetainedManifestRecord(record: ManifestItem, preservedHashes: string[]): ManifestItem {
  // The manifest is deliberately extensible. Keep every field from the raw
  // record while removing only source-file ownership and narrowing the CSS
  // chunks to the blocks that remain on disk.
  const trimmed: ManifestItem = { ...record };
  delete trimmed.files;
  const preserved = new Set(preservedHashes);
  const retainedChunks = (record.cssChunks ?? []).filter((hash) => preserved.has(hash));
  if (retainedChunks.length > 0) trimmed.cssChunks = retainedChunks;
  else delete trimmed.cssChunks;
  return trimmed;
}

// One write cycle for entry removal plus retained-chunk trimming. Throws on
// missing/invalid config or a retained name with no manifest record so the remove
// workflow can roll back its file snapshots.
export function applyRemovalManifestUpdate(
  cwd: string,
  capturedConfig: DiffgazerAddConfig,
  namesToRemove: string[],
  preservedChunksByName: Map<string, string[]>,
): void {
  if (namesToRemove.length === 0 && preservedChunksByName.size === 0) return;

  const config = { ...capturedConfig };
  const manifest = { ...(capturedConfig.installedItems ?? {}) };

  for (const name of namesToRemove) {
    delete manifest[name];
  }

  for (const [name, preservedHashes] of preservedChunksByName) {
    const record = manifest[name];
    if (!record) {
      throw new Error(
        `Could not trim manifest for retained CSS chunks: missing record for ${name}.`,
      );
    }
    manifest[name] = trimRetainedManifestRecord(record, preservedHashes);
  }

  if (Object.keys(manifest).length > 0) {
    config.installedItems = manifest;
  } else {
    delete config.installedItems;
  }
  ctx.config.writeConfig(cwd, config);
}
