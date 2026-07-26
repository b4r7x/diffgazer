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
