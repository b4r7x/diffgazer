export type Cleanup = () => void;

export interface EffectScope {
  signal: AbortSignal;
  active(): boolean;
  addCleanup(cleanup: Cleanup | undefined): void;
  cleanup(): void;
}

export function createEffectScope(externalSignal?: AbortSignal): EffectScope {
  const controller = new AbortController();
  const cleanups: Cleanup[] = [];
  let disposed = false;

  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    externalSignal?.removeEventListener("abort", cleanup);
    controller.abort();
    for (const dispose of cleanups.splice(0)) dispose();
  };

  if (externalSignal?.aborted) cleanup();
  else externalSignal?.addEventListener("abort", cleanup, { once: true });

  return {
    signal: controller.signal,
    active: () => !disposed,
    addCleanup: (dispose) => {
      if (!dispose) return;
      if (disposed) dispose();
      else cleanups.push(dispose);
    },
    cleanup,
  };
}
