import type { Result } from "@diffgazer/core/result";

/**
 * Serializes async mutations through a promise chain so each one observes the
 * settled state of the previous mutation before it begins. Concurrent callers
 * queue rather than interleave at their `await` points.
 */
export function createMutex(): { run<T>(fn: () => Promise<T>): Promise<T> } {
  let tail: Promise<unknown> = Promise.resolve();

  const run = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = tail.then(fn, fn);
    // Keep the chain alive even if a mutation rejects, without surfacing the
    // settled rejection to the next queued caller.
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return { run };
}

interface ConfigTransactionDeps<State, E> {
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
