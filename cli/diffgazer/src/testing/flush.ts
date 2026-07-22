// Yield across a few macrotask (setImmediate) boundaries so pending ink render
// commits and React Query microtask chains settle before assertions run.
export async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}
