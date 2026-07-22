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
