import { ctx, type ManifestItem, type ResolvedConfig } from "../../context.js";
import { readInstalledCssChunkHashes, removeCssChunks } from "../../utils/css-chunks.js";
import { loadManifest } from "./dependencies.js";

interface OwnedCssRemovalPlan {
  writes: Array<{ targetPath: string; content: string }>;
  preservedNotices: string[];
  // Removed items whose drifted chunk was preserved; kept in the manifest so the
  // leftover block stays targetable by a later `remove <item> --force`.
  retainedNames: string[];
  // Per retained item, the chunk hashes actually preserved on disk, used to trim
  // `cssChunks` so a deleted pristine sibling chunk is dropped, not reported as drift.
  retainedChunkHashesByName: Map<string, string[]>;
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
  const label = owners.length > 0 ? owners.join(", ") : "CSS chunk";
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
    retainedNames: [],
    retainedChunkHashesByName: new Map(),
  };
  if (removedNames.length === 0) return empty;
  const stylesPath = config.tailwind?.css;
  if (!stylesPath) return empty;
  const installedHashes = readInstalledCssChunkHashes(cwd, config);
  if (installedHashes.size === 0) return empty;

  // onAfterRemove fires before updateManifest, so the live manifest still lists
  // the removed items; derive kept vs removed chunks from the pre-removal snapshot.
  const removedSet = new Set(removedNames);
  const keptChunkHashes = new Set<string>();
  const chunksOfRemovedItems = new Set<string>();
  for (const [name, hashes] of preRemovalChunksByItem) {
    const target = removedSet.has(name) ? chunksOfRemovedItems : keptChunkHashes;
    for (const hash of hashes) target.add(hash);
  }

  const candidates = new Set<string>();
  for (const hash of installedHashes) {
    if (chunksOfRemovedItems.has(hash) && !keptChunkHashes.has(hash)) {
      candidates.add(hash);
    }
  }
  if (candidates.size === 0) return empty;

  const result = removeCssChunks(candidates, cwd, config, force);
  const preservedNotices = result.modifiedHashes.map((hash) =>
    cssDriftNotice(hash, preRemovalChunksByItem, stylesPath),
  );
  const modifiedHashes = new Set(result.modifiedHashes);
  const retainedChunkHashesByName = new Map<string, string[]>();
  const retainedNames = removedNames.filter((name) => {
    const preserved = (preRemovalChunksByItem.get(name) ?? []).filter((hash) =>
      modifiedHashes.has(hash),
    );
    if (preserved.length === 0) return false;
    retainedChunkHashesByName.set(name, preserved);
    return true;
  });
  const writes = result.fileOp
    ? [{ targetPath: result.fileOp.targetPath, content: result.fileOp.content }]
    : [];
  return { writes, preservedNotices, retainedNames, retainedChunkHashesByName };
}

// The registry command factory cannot thread a per-call context through its
// phased callbacks (getAllItems runs with no cwd; onAfterRemove runs before
// updateManifest), so state lives in one object rather than module-level
// bindings. `beginInvocation` MUST reset it on the first callback (requireConfig)
// so a previous `dgadd remove` run cannot bleed cwd or chunk snapshots into the
// next within a long-lived process.
export interface RemoveWorkflowContext {
  readonly activeCwd: string | null;
  readonly preRemovalChunksByItem: Map<string, string[]>;
  readonly retainedChunkHashesByName: Map<string, string[]>;
  beginInvocation(cwd: string): void;
  snapshotPreRemovalChunks(chunksByItem: Map<string, string[]>): void;
  retainDriftedChunkHashes(chunkHashesByName: Map<string, string[]>): void;
}

export function createRemoveWorkflowContext(): RemoveWorkflowContext {
  let activeCwd: string | null = null;
  let preRemovalChunksByItem = new Map<string, string[]>();
  let retainedChunkHashesByName = new Map<string, string[]>();
  return {
    get activeCwd() {
      return activeCwd;
    },
    get preRemovalChunksByItem() {
      return preRemovalChunksByItem;
    },
    get retainedChunkHashesByName() {
      return retainedChunkHashesByName;
    },
    beginInvocation(cwd) {
      activeCwd = cwd;
      preRemovalChunksByItem = new Map();
      retainedChunkHashesByName = new Map();
    },
    snapshotPreRemovalChunks(chunksByItem) {
      preRemovalChunksByItem = chunksByItem;
    },
    retainDriftedChunkHashes(chunkHashesByName) {
      retainedChunkHashesByName = chunkHashesByName;
    },
  };
}

export function readPreRemovalChunks(cwd: string): Map<string, string[]> {
  const manifest = loadManifest(cwd);
  const snapshot = new Map<string, string[]>();
  for (const [name, record] of Object.entries(manifest)) {
    const hashes = record.cssChunks ?? [];
    if (hashes.length > 0) snapshot.set(name, [...hashes]);
  }
  return snapshot;
}

// Trims records kept only for a drifted CSS chunk down to chunk tracking plus
// provenance. Their source files were deleted, so keeping `files` would make
// `dgadd diff` report spurious drift; `cssChunks` is narrowed to the hashes
// actually preserved on disk so a deleted pristine sibling chunk is dropped too.
export function retainCssChunkTrackingOnly(
  cwd: string,
  preservedChunksByName: Map<string, string[]>,
): void {
  if (preservedChunksByName.size === 0) return;
  const result = ctx.config.loadConfig(cwd);
  if (!result.ok) return;
  const manifest = result.config.installedComponents;
  if (!manifest) return;
  for (const [name, preservedHashes] of preservedChunksByName) {
    const record = manifest[name];
    if (!record) continue;
    const trimmed: ManifestItem = { installedAt: record.installedAt };
    if (record.installedAs) trimmed.installedAs = record.installedAs;
    if (record.integrationMode) trimmed.integrationMode = record.integrationMode;
    const preserved = new Set(preservedHashes);
    const retainedChunks = (record.cssChunks ?? []).filter((hash) => preserved.has(hash));
    if (retainedChunks.length > 0) trimmed.cssChunks = retainedChunks;
    manifest[name] = trimmed;
  }
  ctx.config.writeConfig(cwd, result.config);
}
