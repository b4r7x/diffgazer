export interface WaitUntilOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

// The ceiling is wall-clock time, not a poll count: on a starved CI runner one
// React/Ink/React Query turn between two polls can outlast a whole attempt
// budget, and a correct test must not time out for it. 10 s is far beyond any
// real transition, yet well inside this package's 45 s vitest testTimeout, so
// a genuinely stuck wait still reports through this diagnostic (elapsed time
// and attempts) instead of vitest's opaque one.
export const WAIT_TIMEOUT_MS = 10_000;

export async function waitUntil(
  predicate: () => boolean,
  { timeoutMs = WAIT_TIMEOUT_MS, intervalMs = 10 }: WaitUntilOptions = {},
): Promise<void> {
  const startedAt = Date.now();
  let attempts = 0;
  for (;;) {
    attempts += 1;
    if (predicate()) return;
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= timeoutMs) {
      throw new Error(
        `Timed out waiting for condition after ${elapsedMs}ms (attempts: ${attempts})`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
