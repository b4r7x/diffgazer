export interface RemoveWorkflowFile {
  absolutePath: string;
}

export interface BlockedRemoval {
  name: string;
  dependents: string[];
}

export interface RemoveInvocation<TConfig> {
  cwd: string;
  config: TConfig;
}

// The dependency edges selected during removal planning. Values are the
// authoritative install-time edges when present, or the live registry edges
// selected for legacy records. Consumers must use this snapshot rather than
// re-deriving edges after file-removability checks.
export type RemoveDependencyGraph = ReadonlyMap<string, readonly string[]>;

type ExpandRequestedNamesResult = {
  toRemove: string[];
  blocked: BlockedRemoval[];
  dependencyGraph: RemoveDependencyGraph;
};

// "unowned" — the file has no ownership record, so removal cannot be verified.
// "modified" — the file is tracked but its content drifted from the recorded hash.
export type FileRemovalVerdict = "removable" | "unowned" | "modified";

export interface DerivedRemovalPlan<TMetadata = undefined> {
  // Files to rewrite (e.g. styles.css with removed chunks stripped). Applied
  // only after validation against the allowed base dirs.
  writes: Array<{ targetPath: string; content: string }>;
  // Notices for artifacts kept because their on-disk content drifted.
  preservedNotices: string[];
  // Names kept tracked because a derived artifact was preserved; excluded from
  // the "Removed …" summary so it does not contradict the preservation notice.
  retainedNames?: string[];
  // Adapter-owned data that must reach updateManifest with this invocation.
  metadata?: TMetadata;
}

export interface RunRemoveWorkflowOptions<TItem, TConfig, TMetadata = undefined> {
  cwd: string;
  names: string[];
  yes: boolean;
  dryRun: boolean;
  force: boolean;
  itemPlural: string;
  requireConfig: (cwd: string) => TConfig;
  validateNames: (names: string[], invocation: RemoveInvocation<TConfig>) => void;
  getAllItems: (invocation: RemoveInvocation<TConfig>) => TItem[];
  getItemOrThrow: (name: string, invocation: RemoveInvocation<TConfig>) => TItem;
  getItemName: (item: TItem) => string;
  isInstalled: (ctx: { cwd: string; config: TConfig; item: TItem }) => boolean;
  resolveFilesForItem: (ctx: { cwd: string; config: TConfig; item: TItem }) => RemoveWorkflowFile[];
  checkFileRemoval?: (ctx: {
    cwd: string;
    config: TConfig;
    item: TItem;
    file: RemoveWorkflowFile;
    force: boolean;
    requestedNames: string[];
  }) => FileRemovalVerdict;
  resolveAllowedBaseDirs: (ctx: { cwd: string; config: TConfig }) => string[];
  resolveTransactionFiles?: (ctx: { cwd: string; config: TConfig }) => string[];
  // Must throw on failure so finalizeRemoval can roll back file snapshots.
  updateManifest: (ctx: {
    cwd: string;
    config: TConfig;
    removedNames: string[];
    retainedNames: string[];
    metadata?: TMetadata;
  }) => void;
  // Runs after confirmation and before any file deletion. Adapters can reject
  // a plan when the invocation snapshot no longer matches the project.
  validateTransaction?: (ctx: { cwd: string; config: TConfig }) => void;
  findOrphanedDeps?: (ctx: { removedNames: string[]; cwd: string; config: TConfig }) => string[];
  // Expands requested names with cascade-orphaned transitives; items still
  // depended on keep their files and are reported as kept rather than failed to
  // remove, but the command still exits non-zero because the request was not met.
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
  }) => DerivedRemovalPlan<TMetadata> | undefined;
}
