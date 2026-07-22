import type { Result } from "@diffgazer/core/result";

export interface ConfigTransactionDeps<State, E> {
  /** Reload from disk so the mutation sees state another process may have written. */
  refresh: () => void;
  /** Capture a deep copy of the current in-memory state for rollback. */
  snapshot: () => State;
  /** Restore the in-memory state from a snapshot (no persistence). */
  restore: (snapshot: State) => void;
  /** Persist the mutated state to disk. */
  persist: () => Promise<Result<void, E>>;
}

/**
 * Runs one config/trust mutation under the shared transactional discipline:
 * refresh from disk → snapshot for rollback → mutate → persist → on persist
 * failure restore the snapshot and surface the error. The mutation runs inside
 * the caller-provided mutex so two concurrent mutators never interleave.
 */
export async function runConfigTransaction<State, T, E>(
  deps: ConfigTransactionDeps<State, E>,
  mutate: () => Result<T, E>,
): Promise<Result<T, E>> {
  deps.refresh();
  const backup = deps.snapshot();

  const mutateResult = mutate();
  if (!mutateResult.ok) {
    deps.restore(backup);
    return mutateResult;
  }

  const persistResult = await deps.persist();
  if (!persistResult.ok) {
    deps.restore(backup);
    return persistResult;
  }

  return mutateResult;
}
