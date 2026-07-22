export interface RemoveWorkflowFile {
  absolutePath: string;
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
  resolveTransactionFiles?: (ctx: { cwd: string; config: TConfig }) => string[];
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
  }) => DerivedRemovalPlan | undefined;
}
