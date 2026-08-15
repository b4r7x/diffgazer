export type ExecutionDeadline = Readonly<{
  signal: AbortSignal;
  /** Milliseconds left before the admitted wall time is spent. */
  remainingMs: () => number;
  /** True only when the wall-time budget aborted, never for caller cancellation. */
  expired: () => boolean;
  dispose: () => void;
}>;

/**
 * Composes one absolute wall-time deadline with optional caller cancellation.
 * Adapters must pass only the remaining budget through discovery, fetch, and
 * child-process phases. The clock is the real one: an adapter's injected `now`
 * exists to stamp receipts deterministically, not to schedule timers.
 */
export function composeExecutionDeadline(
  wallTimeMs: number,
  parentSignal?: AbortSignal,
): ExecutionDeadline {
  const deadlineAt = Date.now() + wallTimeMs;
  const controller = new AbortController();
  let expired = false;

  const remainingMs = () => Math.max(0, deadlineAt - Date.now());

  const abortFromParent = () => {
    if (!controller.signal.aborted) {
      controller.abort(parentSignal?.reason);
    }
  };

  const abortFromTimeout = () => {
    if (controller.signal.aborted) return;
    expired = true;
    controller.abort(new DOMException("Execution deadline exceeded", "TimeoutError"));
  };

  parentSignal?.addEventListener("abort", abortFromParent, { once: true });

  const timeout = setTimeout(abortFromTimeout, remainingMs());
  timeout.unref?.();

  const dispose = () => {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abortFromParent);
  };

  // Self-disposal is wired before the already-aborted check so a parent that was
  // cancelled before construction still clears the timer instead of leaving it armed.
  controller.signal.addEventListener("abort", dispose, { once: true });
  if (parentSignal?.aborted) abortFromParent();

  return Object.freeze({
    signal: controller.signal,
    remainingMs,
    expired: () => expired,
    dispose,
  });
}
